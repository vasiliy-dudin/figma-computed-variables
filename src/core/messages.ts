import { SavedTokens, TokenJSON, ValidationError } from './types';

export type ApplyStatus = 'idle' | 'running' | 'queued';

// UI → Plugin messages
export type UIToPluginMessage =
	| { type: 'IMPORT_VARIABLES' }
	| { type: 'APPLY_TO_VARIABLES'; jsonText: string }
	| { type: 'SAVE_JSON'; jsonText: string }
	| { type: 'RESIZE_WINDOW'; width: number; height: number };

// Plugin → UI messages
export type PluginToUIMessage =
	// jsonText keeps the Figma order of tokens and groups, which json loses for integer-like names.
	// json is still sent for the stats: the editor's own check only counts valid JSON, and an
	// import with unresolved library references is not valid until the user fixes them.
	| { type: 'IMPORT_SUCCESS'; json: TokenJSON; jsonText: string }
	| { type: 'IMPORT_ERROR'; error: string }
	| { type: 'APPLY_SUCCESS'; preservedComposedColors: number; rejectedComposedColors: number }
	| { type: 'APPLY_ERROR'; errors: ValidationError[] }
	| { type: 'SAVE_SUCCESS' }
	| { type: 'SAVE_ERROR'; error: string }
	| { type: 'LOAD_JSON'; saved: SavedTokens | null }
	| { type: 'STARTUP_INFO'; hasVariables: boolean }
	| { type: 'APPLY_STATUS'; state: ApplyStatus };

// Message channel names
export const MESSAGE_CHANNELS = {
	UI_TO_PLUGIN: 'ui-to-plugin',
	PLUGIN_TO_UI: 'plugin-to-ui',
} as const;
