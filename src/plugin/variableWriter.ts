import { TokenJSON, ResolvedValue, RGBA, TokenMap, ValidationError, ApplyResult, AlphaIntent } from '@core/types';
import { createTokenMap, normalizeModeValues } from '@core/tokenUtils';
import { resolveToken, hexToRgba } from '@core/resolver';
import { resolveAlphaIntent } from '@core/alphaIntent';
import { readComposedColor, writeComposedColor } from '@plugin/composeColor';
import { buildVariableIndex, VariableIndex } from '@plugin/variableIndex';
import { prepareVariables, PreparedVariable } from '@plugin/prepareVariables';

// Tolerance for comparing opacity percentages. resolveAmount derives a percentage from
// a decimal token by multiplying by 100, which drifts in float64 — 0.07 becomes
// 7.000000000000001, 0.29 becomes 28.999999999999996. Comparing those strictly against
// the whole number Figma stores would miss the match and destroy the reference. Far
// smaller than any percentage difference a user could intend.
const PERCENT_MATCH_EPSILON = 1e-9;

type ModeWriteOutcome =
	| { kind: 'written' }
	// Left as it was: a composed colour over a translucent base that still matches its token.
	| { kind: 'preserved' }
	// The computed colour was written because Figma refused the composed colour.
	| { kind: 'composed-rejected'; error: unknown };

const WRITTEN: ModeWriteOutcome = { kind: 'written' };
const PRESERVED: ModeWriteOutcome = { kind: 'preserved' };

interface WriteTally {
	preserved: number;
	rejected: number;
	firstRejection?: unknown;
}

/**
 * Apply token JSON to Figma Variables: creates what is missing, merges modes, then writes
 * values. Two passes, so every variable exists before any value refers to it.
 */
export async function applyToVariables(json: TokenJSON): Promise<ApplyResult> {
	const errors: ValidationError[] = [];
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	const index = await buildVariableIndex(collections);
	const prepared = prepareVariables(json, collections, index, errors);

	const tokenMap = createTokenMap(json);
	const tally: WriteTally = { preserved: 0, rejected: 0 };
	for (const entry of prepared) {
		await writeValues(entry, tokenMap, index, errors, tally);
	}
	warnAboutRejections(tally);

	return { errors, preservedComposedColors: tally.preserved, rejectedComposedColors: tally.rejected };
}

/** One warning per Apply: a refusal usually applies to every token, so one line each would drown the console. */
function warnAboutRejections(tally: WriteTally): void {
	if (tally.rejected === 0) return;
	console.warn(
		`[applyToVariables] Figma refused ${tally.rejected} composed colour write(s); those values were written as computed colours. First error:`,
		tally.firstRejection
	);
}

/** Second pass: writes every mode of one variable and records what happened to each in the tally. */
async function writeValues(
	entry: PreparedVariable,
	tokenMap: TokenMap,
	index: VariableIndex,
	errors: ValidationError[],
	tally: WriteTally
): Promise<void> {
	const { collection, collectionName, tokenPath, token } = entry;
	// Normalize a shorthand scalar to a per-mode record first
	const normalizedValue = normalizeModeValues(token.$value, collection.modes.map(m => m.name));
	const fullPath = `${collectionName}.${tokenPath}`;

	for (const mode of collection.modes) {
		if (normalizedValue[mode.name] === undefined) continue;
		try {
			const outcome = await writeModeValue(entry, mode, fullPath, tokenMap, index);
			if (outcome.kind === 'preserved') {
				tally.preserved++;
			} else if (outcome.kind === 'composed-rejected') {
				tally.rejected++;
				if (tally.rejected === 1) tally.firstRejection = outcome.error;
			}
		} catch (err) {
			errors.push({
				collection: collectionName,
				token: tokenPath,
				mode: mode.name,
				errorType: 'schema',
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}
}

async function writeModeValue(
	entry: PreparedVariable,
	mode: { modeId: string; name: string },
	fullPath: string,
	tokenMap: TokenMap,
	index: VariableIndex
): Promise<ModeWriteOutcome> {
	const intent = resolveAlphaIntent(fullPath, mode.name, tokenMap);

	// A native composed colour keeps the token linked to its base.
	if (intent?.eligible) {
		const composed = writeComposedColor(entry.variable, mode.modeId, intent, index);
		if (composed.status === 'written') return WRITTEN;

		writeComputedValue(entry, mode, fullPath, tokenMap, index);
		return composed.status === 'rejected' ? { kind: 'composed-rejected', error: composed.error } : WRITTEN;
	}

	// Over a translucent base the computed colour would paint differently and cut the reference.
	if (intent && await isComposedColorUnchanged(entry.variable.valuesByMode[mode.modeId], intent)) {
		return PRESERVED;
	}

	writeComputedValue(entry, mode, fullPath, tokenMap, index);
	return WRITTEN;
}

function writeComputedValue(
	entry: PreparedVariable,
	mode: { modeId: string; name: string },
	fullPath: string,
	tokenMap: TokenMap,
	index: VariableIndex
): void {
	const resolved = resolveToken(fullPath, mode.name, tokenMap);
	setVariableValue(entry.variable, mode.modeId, resolved, entry.figmaType, index);
}

/**
 * True when the mode already holds a composed colour expressing exactly what this token
 * asks for, so Apply should leave it alone. Only asked for tokens the writer cannot write as
 * a composed colour — a translucent base. Figma replaces the base's alpha where alpha()
 * multiplies it, so rewriting such a value as the computed colour would change what it
 * paints and cut its reference; typically it was authored in Figma and then imported.
 */
async function isComposedColorUnchanged(current: unknown, intent: AlphaIntent): Promise<boolean> {
	const stored = readComposedColor(current);
	if (stored?.color.kind !== 'alias') return false;
	if (!await targetMatchesPath(stored.color.id, intent.targetPath)) return false;

	if (stored.opacity.kind === 'alias') {
		return intent.opacityTokenPath !== null && targetMatchesPath(stored.opacity.id, intent.opacityTokenPath);
	}
	return Math.abs(stored.opacity.value - intent.percent) <= PERCENT_MATCH_EPSILON;
}

/**
 * Resolve a stored alias target back to a token path and compare it with the one the
 * expression names, working in reverse — id to path.
 *
 * Accepts both the bare path and the collection-prefixed form. Note this is not an
 * exact mirror of the forward lookup in variableIndex.ts: that splits on the *first* dot
 * to guess a collection prefix, so it fails to resolve a collection whose own name
 * contains a dot. Comparing whole strings here handles that case correctly instead.
 */
async function targetMatchesPath(targetId: string, path: string): Promise<boolean> {
	const target = await figma.variables.getVariableByIdAsync(targetId);
	if (!target) return false;

	// Figma uses '/' for variable groups; the plugin's token paths use '.'
	const barePath = target.name.replace(/\//g, '.');
	if (path === barePath) return true;

	const collection = await figma.variables.getVariableCollectionByIdAsync(target.variableCollectionId);
	return collection !== null && path === `${collection.name}.${barePath}`;
}

/**
 * Set a variable value (handles both aliases and computed values)
 */
function setVariableValue(
	variable: Variable,
	modeId: string,
	resolved: ResolvedValue,
	figmaType: VariableResolvedDataType,
	index: VariableIndex
): void {
	if (resolved.isAlias) {
		// Set as native Figma alias
		const targetVariable = index.find(resolved.targetPath);
		if (targetVariable) {
			variable.setValueForMode(modeId, {
				type: 'VARIABLE_ALIAS',
				id: targetVariable.id
			});
		} else {
			throw new Error(`Alias target not found: "${resolved.targetPath}"`);
		}
	} else {
		// Set computed value
		const value = convertValueForFigma(resolved.value, figmaType);
		variable.setValueForMode(modeId, value);
	}
}

/**
 * Convert resolved value to Figma format
 */
function convertValueForFigma(value: string | number | RGBA, figmaType: VariableResolvedDataType): VariableValue {
	switch (figmaType) {
		case 'COLOR':
			if (typeof value === 'object' && 'r' in value) {
				return value;
			}
			return hexToRgba(String(value));
			
		case 'FLOAT':
			return typeof value === 'number' ? value : parseFloat(String(value));
			
		case 'STRING':
			return String(value);
			
		default:
			return String(value);
	}
}
