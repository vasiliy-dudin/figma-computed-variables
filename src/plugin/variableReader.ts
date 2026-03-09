import { TokenJSON } from '@core/types';
import { FIGMA_TYPE_MAP } from '@core/constants';
import { rgbaToHex } from '@core/resolver';

/**
 * Import all Figma Variables and convert to TokenJSON format
 */
export async function importVariablesToJSON(): Promise<TokenJSON> {
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	const result: TokenJSON = {};
	
	for (const collection of collections) {
		result[collection.name] = {};
		
		// Get all variables in this collection
		const variables = collection.variableIds.map(id => figma.variables.getVariableById(id)!).filter(Boolean);
		
		for (const variable of variables) {
			const modes: Record<string, string | number> = {};
			
			// Get values for each mode
			for (const mode of collection.modes) {
				const value = variable.valuesByMode[mode.modeId];
				modes[mode.name] = formatValue(value, variable.resolvedType);
			}
			
			const tokenType = FIGMA_TYPE_MAP[variable.resolvedType];
			result[collection.name][variable.name] = {
				$type: (tokenType === 'color' || tokenType === 'number' || tokenType === 'string') ? tokenType : 'string',
				$value: modes
			};
		}
	}
	
	return result;
}

/**
 * Format a Figma variable value to token format
 */
function formatValue(value: VariableValue, type: VariableResolvedDataType): string | number {
	if (value !== null && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
		const target = figma.variables.getVariableById(value.id);
		if (!target) return '';
		
		return `{${target.name}}`;
	}
	
	switch (type) {
		case 'COLOR':
			if (value !== null && typeof value === 'object' && 'r' in value) {
				return rgbaToHex(value as RGBA);
			}
			return '#000000';
			
		case 'FLOAT':
			return typeof value === 'number' ? value : 0;
			
		case 'STRING':
			return typeof value === 'string' ? value : '';
			
		default:
			return String(value);
	}
}
