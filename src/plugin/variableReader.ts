import { TokenJSON, Token, ModeValues } from '@core/types';
import { condenseModeValues, nestifyFlatPaths } from '@core/tokenUtils';
import { FIGMA_TYPE_MAP } from '@core/constants';
import { rgbaToHex } from '@core/resolver';
import { isComposeColorValue, readComposeColor, ComposeColorValue } from '@plugin/composeColor';

// Prefix for a placeholder alias path when a Composed Color's target variable
// cannot be resolved locally (e.g. it lives in a library not available to this
// plugin). Guaranteed not to collide with a real dot-path, so the existing
// reference validator reports it as a clear "token not found" error at Apply
// time instead of the color silently vanishing.
const UNRESOLVED_COMPOSE_COLOR_TARGET_PREFIX = 'unresolved-variable:';

/**
 * Import all Figma Variables and convert to TokenJSON format
 */
export async function importVariablesToJSON(): Promise<TokenJSON> {
	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	const result: TokenJSON = {};
	
	for (const collection of collections) {
		// Get all variables in this collection
		const variables = (await Promise.all(
			collection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
		)).filter(Boolean) as Variable[];
		
		// Build flat map: dot-path → Token
		const flatTokens = new Map<string, Token>();
		
		for (const variable of variables) {
			const modes: ModeValues = {};

			// Get values for each mode
			for (const mode of collection.modes) {
				const value = variable.valuesByMode[mode.modeId];
				modes[mode.name] = await formatValue(value, variable.resolvedType);
			}

			const tokenType = FIGMA_TYPE_MAP[variable.resolvedType];
			// Figma uses '/' for groups; convert to dot-path for plugin JSON
			const dotPath = variable.name.replace(/\//g, '.');

			const tokenDef: Token = {
				$type: (tokenType === 'color' || tokenType === 'number' || tokenType === 'string') ? tokenType : 'string',
				$value: condenseModeValues(modes),
			};

			if (variable.description) {
				tokenDef.$description = variable.description;
			}
			// Omit $scope when the default ALL_SCOPES is set — keeps JSON clean
			// Guard against undefined scopes on variables created before scopes API
			const scopes: VariableScope[] = variable.scopes ?? [];
			if (scopes.length > 0 && !scopes.includes('ALL_SCOPES')) {
				tokenDef.$scope = scopes.length === 1
					? scopes[0]
					: [...scopes];
			}

			flatTokens.set(dotPath, tokenDef);
		}
		
		// Convert flat map to nested structure
		result[collection.name] = nestifyFlatPaths(flatTokens);
	}
	
	return result;
}

/**
 * Format a Figma variable value to token format
 */
async function formatValue(value: VariableValue, type: VariableResolvedDataType): Promise<string | number> {
	if (isComposeColorValue(value)) {
		return formatComposeColor(value);
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
			return parseFloat(value.toFixed(4));
		}
			
		case 'STRING':
			return typeof value === 'string' ? value : '';

		default:
			return String(value);
	}
}

/**
 * Format a Composed Color (a native Figma alias carrying its own opacity, e.g. the
 * result of Figma's "Set opacity" on a referenced color variable) as the plugin's
 * own alpha() syntax. The plugin cannot recreate this native shape on Apply — see
 * PLANNING.md — so this is purely a faithful, round-trippable *reading* of it.
 */
async function formatComposeColor(value: ComposeColorValue): Promise<string> {
	const { targetId, percent } = readComposeColor(value);
	const target = await figma.variables.getVariableByIdAsync(targetId);
	const path = target
		? target.name.replace(/\//g, '.')
		: `${UNRESOLVED_COMPOSE_COLOR_TARGET_PREFIX}${targetId}`;

	return `alpha({${path}}, ${percent}%)`;
}
