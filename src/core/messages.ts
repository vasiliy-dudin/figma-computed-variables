import { TokenJSON, ValidationError } from './types';

export type ApplyStatus = 'idle' | 'running' | 'queued';

// UI → Plugin messages
export type UIToPluginMessage =
	| { type: 'IMPORT_VARIABLES' }
	| { type: 'APPLY_TO_VARIABLES'; json: TokenJSON }
	| { type: 'SAVE_JSON'; json: TokenJSON }
	| { type: 'RESIZE_WINDOW'; width: number; height: number };

// Plugin → UI messages
export type PluginToUIMessage =
	| { type: 'IMPORT_SUCCESS'; json: TokenJSON }
	| { type: 'IMPORT_ERROR'; error: string }
	| { type: 'APPLY_SUCCESS'; message: string }
	| { type: 'APPLY_ERROR'; errors: ValidationError[] }
	| { type: 'SAVE_SUCCESS' }
	| { type: 'SAVE_ERROR'; error: string }
	| { type: 'LOAD_JSON'; json: TokenJSON | null }
	| { type: 'STARTUP_INFO'; hasVariables: boolean }
	| { type: 'APPLY_STATUS'; state: ApplyStatus };

// Message channel names
export const MESSAGE_CHANNELS = {
	UI_TO_PLUGIN: 'ui-to-plugin',
	PLUGIN_TO_UI: 'plugin-to-ui',
} as const;
