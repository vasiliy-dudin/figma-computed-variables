import { TokenJSON } from '@core/types';

const STORAGE_KEY = 'computed-variables-json';

/**
 * Save token JSON to Figma clientStorage
 */
export async function saveJSON(json: TokenJSON): Promise<void> {
	try {
		await figma.clientStorage.setAsync(STORAGE_KEY, JSON.stringify(json));
	} catch (err) {
		throw new Error(`Failed to save JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Load token JSON from Figma clientStorage
 */
export async function loadJSON(): Promise<TokenJSON | null> {
	try {
		const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
		if (!stored) return null;
		
		return JSON.parse(stored) as TokenJSON;
	} catch (err) {
		throw new Error(`Failed to load JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}
