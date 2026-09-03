import { TokenJSON, ResolvedValue, RGBA, TokenMap, ValidationError, ApplyResult } from '@core/types';
import { TYPE_MAP } from '@core/constants';
import { createTokenMap, flattenTokenGroup, isExcluded, normalizeModeValues } from '@core/tokenUtils';
import { resolveToken, resolveAlphaIntent, hexToRgba } from '@core/resolver';
import { isComposeColorValue, readComposeColor } from '@plugin/composeColor';

// Tolerance for comparing opacity percentages. resolveAmount derives a percentage from
// a decimal token by multiplying by 100, which drifts in float64 — 0.07 becomes
// 7.000000000000001, 0.29 becomes 28.999999999999996. Comparing those strictly against
// the whole number Figma stores would miss the match and destroy the reference. Far
// smaller than any percentage difference a user could intend.
const PERCENT_MATCH_EPSILON = 1e-9;

/**
 * Apply token JSON to Figma Variables
 * Updates existing collections/variables, creates missing ones, merges modes
 */
export async function applyToVariables(json: TokenJSON): Promise<ApplyResult> {
	let preservedComposedColors = 0;
	const collectionErrors: ValidationError[] = [];
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	
	for (const [collectionName, tokens] of Object.entries(json)) {
		if (isExcluded(collectionName)) continue;
		// 1. Find or create collection
		let collection = collections.find(c => c.name === collectionName);
		if (!collection) {
			collection = figma.variables.createVariableCollection(collectionName);
		}
		
		// 2. Extract and merge modes (flatten nested structure first)
		const flatTokens = flattenTokenGroup(tokens);
		const modes = new Set<string>();
		for (const token of flatTokens.values()) {
			if (typeof token.$value !== 'string' && typeof token.$value !== 'number') {
				for (const mode of Object.keys(token.$value)) {
					modes.add(mode);
				}
			}
		}
		
		const existingModes = collection.modes.map(m => m.name);
		for (const modeName of modes) {
			if (!existingModes.includes(modeName)) {
				collection.addMode(modeName);
			}
		}
		if (modes.size === 0 && existingModes.length === 0) {
			collection.addMode('Mode 1');
		}
		
		// 3. Create token map for resolution
		const tokenMap = createTokenMap(json);
		
		// 4. Create or update variables
		const collectionVariables = (await Promise.all(
			collection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
		)).filter(Boolean) as Variable[];
		
		for (const [tokenPath, token] of flatTokens) {
			if (tokenPath.split('.').some(isExcluded)) continue;
			const figmaType = TYPE_MAP[token.$type];
			if (!figmaType) {
				collectionErrors.push({
					collection: collectionName,
					token: tokenPath,
					errorType: 'schema',
					message: `Unknown token type: "${token.$type}"`,
				});
				continue;
			}
			
			try {
				// Figma uses '/' for variable groups; dot-path maps to slash-path
				const figmaVarName = tokenPath.replace(/\./g, '/');

				// Find or create variable
				let variable = collectionVariables.find(v => v.name === figmaVarName);
				if (!variable) {
					variable = figma.variables.createVariable(figmaVarName, collection, figmaType);
				}

				if (token.$description !== undefined) {
					variable.description = token.$description;
				}
				if (token.$scope !== undefined) {
					const scopes = Array.isArray(token.$scope) ? token.$scope : [token.$scope];
					variable.scopes = scopes as VariableScope[];
				}

				// Set values for each mode — normalize shorthand scalar to per-mode record first
				const modeNames = collection.modes.map(m => m.name);
				const normalizedValue = normalizeModeValues(token.$value, modeNames);
				for (const mode of collection.modes) {
					if (normalizedValue[mode.name] === undefined) continue;

					try {
						const fullPath = `${collectionName}.${tokenPath}`;
						if (await isComposedColorUnchanged(variable, mode.modeId, fullPath, mode.name, tokenMap)) {
							preservedComposedColors++;
							continue;
						}

						const resolved = resolveToken(fullPath, mode.name, tokenMap);

						await setVariableValue(variable, mode.modeId, resolved, figmaType);
					} catch (err) {
						collectionErrors.push({
							collection: collectionName,
							token: tokenPath,
							mode: mode.name,
							errorType: 'schema',
							message: err instanceof Error ? err.message : String(err),
						});
					}
				}
			} catch (err) {
				collectionErrors.push({
					collection: collectionName,
					token: tokenPath,
					errorType: 'schema',
					message: err instanceof Error ? err.message : String(err),
				});
			}
		}
	}
	
	return {
		errors: collectionErrors,
		preservedComposedColors,
	};
}

/**
 * True when the mode already holds a Figma-native Composed Color expressing exactly
 * what this token asks for, so Apply should leave it alone.
 *
 * The plugin cannot create or restore a Composed Color — the API rejects the write
 * (see PLANNING.md) — so overwriting one with the equivalent flat colour would
 * silently destroy a reference the user cannot get back through this plugin.
 */
async function isComposedColorUnchanged(
	variable: Variable,
	modeId: string,
	tokenFullPath: string,
	modeName: string,
	tokenMap: TokenMap
): Promise<boolean> {
	const current = variable.valuesByMode[modeId];
	if (!isComposeColorValue(current)) return false;

	const intent = resolveAlphaIntent(tokenFullPath, modeName, tokenMap);
	if (!intent) return false;

	const stored = readComposeColor(current);
	if (Math.abs(stored.percent - intent.percent) > PERCENT_MATCH_EPSILON) return false;

	return targetMatchesPath(stored.targetId, intent.targetPath);
}

/**
 * Resolve a stored alias target back to a token path and compare it with the one the
 * expression names. Works in reverse — id to path — because the forward direction
 * costs a full scan of every variable in the file (see findVariableByPath).
 *
 * Accepts both the bare path and the collection-prefixed form. Note this is not an
 * exact mirror of findVariableByPath: that function splits on the *first* dot to guess
 * a collection prefix, so it fails to resolve a collection whose own name contains a
 * dot. Comparing whole strings here handles that case correctly instead.
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
async function setVariableValue(
	variable: Variable,
	modeId: string,
	resolved: ResolvedValue,
	figmaType: VariableResolvedDataType
): Promise<void> {
	if (resolved.isAlias) {
		// Set as native Figma alias
		const targetVariable = await findVariableByPath(resolved.targetPath);
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
 * Find a variable by its token path (bare "tokenName" or full "collection.tokenName")
 */
async function findVariableByPath(path: string): Promise<Variable | null> {
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	const collectionNames = new Set(collections.map(c => c.name));

	// Determine whether the path has a collection prefix by checking if
	// the segment before the first dot matches an actual collection name.
	// This handles bare token paths like "text.primary" (no collection prefix)
	// and full paths like "Semantic/Colors.text.primary" (has collection prefix).
	const dotIndex = path.indexOf('.');
	const potentialCollection = dotIndex !== -1 ? path.substring(0, dotIndex) : null;
	const hasCollectionPrefix = potentialCollection !== null && collectionNames.has(potentialCollection);

	const collectionName = hasCollectionPrefix ? potentialCollection : null;
	const tokenDotPath = hasCollectionPrefix ? path.substring(dotIndex + 1) : path;
	// Convert dot-path to slash-path to match Figma variable names
	const figmaVarName = tokenDotPath.replace(/\./g, '/');

	for (const collection of collections) {
		if (collectionName !== null && collection.name !== collectionName) continue;
		for (const varId of collection.variableIds) {
			const variable = await figma.variables.getVariableByIdAsync(varId);
			if (variable && variable.name === figmaVarName) {
				return variable;
			}
		}
	}

	return null;
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
