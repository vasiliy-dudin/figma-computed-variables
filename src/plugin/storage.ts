import { TokenJSON } from '@core/types';

const FILE_ID_KEY = 'computed-variables-file-id';
const STORAGE_KEY_PREFIX = 'computed-variables-json';

// clientStorage is shared across every file the user opens with this plugin,
// not scoped per file. figma.fileKey needs enablePrivatePluginApi (org-only)
// and figma.root.id is constant ("0:0") in every file, so neither can tell
// files apart. Instead we persist our own id inside the file via pluginData
// (which is embedded in the .fig document) and use it to namespace clientStorage.
// Synchronous end-to-end (no `await` inside), so concurrent saveJSON/loadJSON
// calls can't interleave mid-generation — whichever runs first always finishes
// writing the id before the next one reads it.
function getFileId(): string {
	const existing = figma.root.getPluginData(FILE_ID_KEY);
	if (existing) return existing;

	const generated = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	figma.root.setPluginData(FILE_ID_KEY, generated);
	return generated;
}

function getStorageKey(): string {
	return `${STORAGE_KEY_PREFIX}:${getFileId()}`;
}

/**
 * Save token JSON to Figma clientStorage, scoped to the current file
 */
export async function saveJSON(json: TokenJSON): Promise<void> {
	try {
		await figma.clientStorage.setAsync(getStorageKey(), JSON.stringify(json));
	} catch (err) {
		throw new Error(`Failed to save JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Load token JSON from Figma clientStorage, scoped to the current file
 */
export async function loadJSON(): Promise<TokenJSON | null> {
	try {
		const stored = await figma.clientStorage.getAsync(getStorageKey());
		if (!stored) return null;

		return JSON.parse(stored) as TokenJSON;
	} catch (err) {
		throw new Error(`Failed to load JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}
