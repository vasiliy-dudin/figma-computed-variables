import { TokenJSON, ResolvedValue, RGBA } from '@core/types';
import { TYPE_MAP } from '@core/constants';
import { createTokenMap, flattenTokenGroup } from '@core/tokenUtils';
import { resolveToken, hexToRgba } from '@core/resolver';

/**
 * Apply token JSON to Figma Variables
 * Updates existing collections/variables, creates missing ones, merges modes
 */
export async function applyToVariables(json: TokenJSON): Promise<string> {
	let totalVariables = 0;
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
			for (const mode of Object.keys(token.$value)) {
				modes.add(mode);
			}
		}
		
		const existingModes = collection.modes.map(m => m.name);
		for (const modeName of modes) {
			if (!existingModes.includes(modeName)) {
				collection.addMode(modeName);
			}
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
				console.warn(`Unknown token type: ${token.$type} for ${tokenPath}`);
				continue;
			}
			
			// Figma uses '/' for variable groups; dot-path maps to slash-path
			const figmaVarName = tokenPath.replace(/\./g, '/');
			
			// Find or create variable
			let variable = collectionVariables.find(v => v.name === figmaVarName);
			if (!variable) {
				variable = figma.variables.createVariable(figmaVarName, collection, figmaType);
			}
			
			// Set values for each mode
			for (const mode of collection.modes) {
				const modeValue = token.$value[mode.name];
				if (modeValue === undefined) continue;
				
				try {
					const fullPath = `${collectionName}.${tokenPath}`;
					const resolved = resolveToken(fullPath, mode.name, tokenMap);
					
					setVariableValue(variable, mode.modeId, resolved, figmaType);
				} catch (err) {
					console.error(`Error setting value for ${collectionName}.${tokenPath} (${mode.name}):`, err);
				}
			}
			
			totalVariables++;
		}
	}
	
	return `Applied ${totalVariables} variables across ${Object.keys(json).length} collections`;
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
			console.warn(`Alias target not found: ${resolved.targetPath}`);
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
	const dotIndex = path.indexOf('.');
	const collectionName = dotIndex !== -1 ? path.substring(0, dotIndex) : null;
	// Convert dot-path to slash-path to match Figma variable names
	const tokenDotPath = dotIndex !== -1 ? path.substring(dotIndex + 1) : path;
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
