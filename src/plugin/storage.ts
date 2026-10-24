import { JSON_EDITOR_INDENT } from '@core/orderedJson';
import { SavedTokens, TokenJSON } from '@core/types';

const FILE_ID_KEY = 'computed-variables-file-id';
const STORAGE_KEY_PREFIX = 'computed-variables-json';

// The text is kept as written, because parsing it reorders integer-like keys. It is wrapped
// in an object to tell it apart from older entries, which were compact JSON strings.
interface StoredTokens {
	jsonText: string;
}

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
 * Save token JSON text to Figma clientStorage, scoped to the current file, exactly as written
 */
export async function saveJSON(jsonText: string): Promise<void> {
	try {
		const stored: StoredTokens = { jsonText };
		await figma.clientStorage.setAsync(getStorageKey(), stored);
	} catch (err) {
		throw new Error(`Failed to save JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Load token JSON from Figma clientStorage, scoped to the current file; returns null if nothing is saved
 */
export async function loadJSON(): Promise<SavedTokens | null> {
	try {
		const stored: unknown = await figma.clientStorage.getAsync(getStorageKey());
		if (!stored) return null;

		const jsonText = readStoredText(stored);
		return { json: JSON.parse(jsonText) as TokenJSON, jsonText };
	} catch (err) {
		throw new Error(`Failed to load JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}

function readStoredText(stored: unknown): string {
	if (isStoredTokens(stored)) return stored.jsonText;
	// Older versions stored compact JSON; format it the way the editor used to show it.
	if (typeof stored === 'string') return JSON.stringify(JSON.parse(stored), null, JSON_EDITOR_INDENT);
	throw new Error('unexpected stored format');
}

function isStoredTokens(value: unknown): value is StoredTokens {
	return typeof value === 'object' && value !== null && 'jsonText' in value && typeof value.jsonText === 'string';
}
