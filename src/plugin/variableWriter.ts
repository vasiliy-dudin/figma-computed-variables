import { TokenJSON, ResolvedValue, RGBA, ValidationError, ApplyResult } from '@core/types';
import { TYPE_MAP } from '@core/constants';
import { createTokenMap, flattenTokenGroup, normalizeModeValues } from '@core/tokenUtils';
import { resolveToken, hexToRgba } from '@core/resolver';

/**
 * Apply token JSON to Figma Variables
 * Updates existing collections/variables, creates missing ones, merges modes
 */
export async function applyToVariables(json: TokenJSON): Promise<ApplyResult> {
	let totalVariables = 0;
	const collectionErrors: ValidationError[] = [];
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	
	for (const [collectionName, tokens] of Object.entries(json)) {
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
		const collectionVariables = collection.variableIds
			.map(id => figma.variables.getVariableById(id))
			.filter(Boolean) as Variable[];
		
		for (const [tokenPath, token] of flatTokens) {
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

				// Set values for each mode — normalize shorthand scalar to per-mode record first
				const modeNames = collection.modes.map(m => m.name);
				const normalizedValue = normalizeModeValues(token.$value, modeNames);
				for (const mode of collection.modes) {
					if (normalizedValue[mode.name] === undefined) continue;

					try {
						const fullPath = `${collectionName}.${tokenPath}`;
						const resolved = resolveToken(fullPath, mode.name, tokenMap);

						setVariableValue(variable, mode.modeId, resolved, figmaType);
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

				totalVariables++;
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
		message: `Applied ${totalVariables} variables across ${Object.keys(json).length} collections`,
		errors: collectionErrors,
	};
}

/**
 * Set a variable value (handles both aliases and computed values)
 */
function setVariableValue(
	variable: Variable,
	modeId: string,
	resolved: ResolvedValue,
	figmaType: VariableResolvedDataType
): void {
	if (resolved.isAlias) {
		// Set as native Figma alias
		const targetVariable = findVariableByPath(resolved.targetPath);
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
function findVariableByPath(path: string): Variable | null {
	const collections = figma.variables.getLocalVariableCollections();
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
			const variable = figma.variables.getVariableById(varId);
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
