import { TokenJSON, Token, ModeValues } from '@core/types';
import { condenseModeValues, nestifyFlatPaths } from '@core/tokenUtils';
import { FIGMA_TYPE_MAP, COLOR_OPACITY_SCOPE } from '@core/constants';
import { rgbaToHex } from '@core/resolver';
import { readComposedColor, ComposedColorParts, ComposedOpacity } from '@plugin/composeColor';

// Prefix for a placeholder path when a variable referenced by a composed colour (its colour
// or its opacity) cannot be resolved locally, e.g. it lives in a library not available to
// this plugin. Guaranteed not to collide with a real dot-path, so the existing reference
// validator reports it as a clear "token not found" error at Apply time instead of the
// value silently vanishing.
const UNRESOLVED_REFERENCE_PREFIX = 'unresolved-variable:';

// Figma stores composed-colour opacity as a percentage; RGBA alpha is a 0-1 fraction.
const PERCENT_SCALE = 100;

/**
 * Import all Figma Variables and convert to TokenJSON format
 */
export async function importVariablesToJSON(): Promise<TokenJSON> {
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	const variablesByCollection = new Map<string, Variable[]>();
	for (const collection of collections) {
		const variables = await Promise.all(collection.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
		variablesByCollection.set(collection.id, variables.filter((v): v is Variable => v !== null));
	}

	const percentVariableIds = findPercentVariables([...variablesByCollection.values()].flat());
	const result: TokenJSON = {};
	for (const collection of collections) {
		const flatTokens = new Map<string, Token>();
		for (const variable of variablesByCollection.get(collection.id) ?? []) {
			// Figma uses '/' for groups; convert to dot-path for plugin JSON
			const dotPath = variable.name.replace(/\//g, '.');
			flatTokens.set(dotPath, await toToken(variable, collection, percentVariableIds.has(variable.id)));
		}
		result[collection.name] = nestifyFlatPaths(flatTokens);
	}
	return result;
}

async function toToken(variable: Variable, collection: VariableCollection, asPercent: boolean): Promise<Token> {
	const modes: ModeValues = {};
	for (const mode of collection.modes) {
		modes[mode.name] = await formatValue(variable.valuesByMode[mode.modeId], variable.resolvedType, asPercent);
	}

	const tokenType = FIGMA_TYPE_MAP[variable.resolvedType];
	const token: Token = {
		$type: (tokenType === 'color' || tokenType === 'number' || tokenType === 'string') ? tokenType : 'string',
		$value: condenseModeValues(modes),
	};

	if (variable.description) {
		token.$description = variable.description;
	}
	// Omit $scope when the default ALL_SCOPES is set — keeps JSON clean
	// Guard against undefined scopes on variables created before scopes API
	const scopes: VariableScope[] = variable.scopes ?? [];
	if (scopes.length > 0 && !scopes.includes('ALL_SCOPES')) {
		token.$scope = scopes.length === 1 ? scopes[0] : [...scopes];
	}
	return token;
}

/**
 * Number variables whose value must import as a percentage string ("60%") rather than a bare
 * number. Figma stores a composed colour's opacity variable as a percentage, but does not
 * require the COLOR_OPACITY scope, and without it the plugin would read a bare 60 as a fraction
 * (6000 %). "60%" reads the same either way and is written back to Figma as 60.
 * Follows alias chains between number variables to the variable that holds the number;
 * a variable with the scope is left as it is, since the scope already says how to read it.
 */
function findPercentVariables(variables: Variable[]): Set<string> {
	const byId = new Map(variables.map(v => [v.id, v]));
	const marked = new Set<string>();
	for (const variable of variables) {
		if (variable.resolvedType !== 'COLOR') continue;
		for (const value of Object.values(variable.valuesByMode)) {
			const opacity = readComposedColor(value)?.opacity;
			if (opacity?.kind === 'alias') markPercentChain(opacity.id, byId, marked, new Set());
		}
	}
	return marked;
}

function markPercentChain(id: string, byId: Map<string, Variable>, marked: Set<string>, visited: Set<string>): void {
	const variable = byId.get(id);
	if (!variable || visited.has(id) || variable.resolvedType !== 'FLOAT') return;
	visited.add(id);
	// The scope is not in the typings' VariableScope union yet, hence the widening to string[].
	if ((variable.scopes as string[] | undefined)?.includes(COLOR_OPACITY_SCOPE)) return;

	for (const value of Object.values(variable.valuesByMode)) {
		if (typeof value === 'number') {
			marked.add(id);
		} else if (isVariableAlias(value)) {
			markPercentChain(value.id, byId, marked, visited);
		}
	}
}

function isVariableAlias(value: unknown): value is VariableAlias {
	return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'VARIABLE_ALIAS';
}

/**
 * Format a Figma variable value to token format. `asPercent` writes a number as "60%"; see
 * findPercentVariables.
 */
async function formatValue(value: VariableValue, type: VariableResolvedDataType, asPercent: boolean): Promise<string | number> {
	const composed = readComposedColor(value);
	if (composed) {
		return formatComposedColor(composed);
	}

	if (value !== null && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
		const target = await figma.variables.getVariableByIdAsync(value.id);
		if (!target) return '';

		// Convert Figma slash-path to dot-path for plugin alias syntax
		return `{${target.name.replace(/\//g, '.')}}`;
	}

	switch (type) {
		case 'COLOR':
			if (value !== null && typeof value === 'object' && 'r' in value) {
				return rgbaToHex(value as RGBA);
			}
			return '#000000';
			
		case 'FLOAT': {
			if (typeof value !== 'number' || !isFinite(value)) return 0;
			const number = parseFloat(value.toFixed(4));
			return asPercent ? `${number}%` : number;
		}
			
		case 'STRING':
			return typeof value === 'string' ? value : '';

		default:
			return String(value);
	}
}

/**
 * Format a composed colour (a colour variable value combining a colour with its own opacity)
 * as the plugin's alpha() syntax: `alpha({token}, 50%)` for a literal percentage, or
 * `alpha({token}, {opacityToken})` when the opacity is itself a variable, so that link survives.
 *
 * Paths are bare, without their collection, matching how plain aliases are imported above.
 * That inherits their ambiguity when the same path exists in two collections, which
 * validation reports on Apply; qualifying only composed colours would make the two kinds of
 * reference behave differently in the same file, which is harder to explain.
 */
async function formatComposedColor(parts: ComposedColorParts): Promise<string> {
	if (parts.color.kind === 'rgb') {
		return formatLiteralColorWithOpacity(parts.color.value, parts.opacity);
	}

	const colorPath = await referencePath(parts.color.id);
	const amount = parts.opacity.kind === 'percent'
		? `${parts.opacity.value}%`
		: `{${await referencePath(parts.opacity.id)}}`;

	return `alpha({${colorPath}}, ${amount})`;
}

/** Dot-path of a referenced variable, or a placeholder the validator will flag if it is missing. */
async function referencePath(variableId: string): Promise<string> {
	const variable = await figma.variables.getVariableByIdAsync(variableId);
	return variable ? variable.name.replace(/\//g, '.') : `${UNRESOLVED_REFERENCE_PREFIX}${variableId}`;
}

/**
 * A literal colour with an opacity cannot be written in alpha() syntax, which requires the
 * colour to be a token reference. It is imported as the flat colour it currently shows, so the
 * link to the opacity variable is lost. The opacity variable's value is taken from its own
 * collection's default mode; if that is not a plain number, the colour is imported opaque.
 */
async function formatLiteralColorWithOpacity(color: RGB, opacity: ComposedOpacity): Promise<string> {
	const percent = opacity.kind === 'percent' ? opacity.value : await readDefaultModePercent(opacity.id);
	const alpha = percent === null ? 1 : Math.min(1, Math.max(0, percent / PERCENT_SCALE));
	return rgbaToHex({ r: color.r, g: color.g, b: color.b, a: alpha });
}

async function readDefaultModePercent(variableId: string): Promise<number | null> {
	const variable = await figma.variables.getVariableByIdAsync(variableId);
	if (!variable) return null;

	const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
	const value = collection ? variable.valuesByMode[collection.defaultModeId] : undefined;
	return typeof value === 'number' ? value : null;
}
