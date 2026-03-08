import { TokenJSON, Token, TokenMap } from './types';

/**
 * Create a TokenMap for efficient token lookups
 */
export function createTokenMap(json: TokenJSON): TokenMap {
	const map = new Map<string, Token>();
	
	for (const [collectionName, collection] of Object.entries(json)) {
		for (const [tokenPath, token] of Object.entries(collection)) {
			const fullPath = `${collectionName}.${tokenPath}`;
			map.set(fullPath, token);
		}
	}
	
	return {
		get(path: string) {
			return map.get(path);
		},
		has(path: string) {
			return map.has(path);
		},
		getFullPath(collectionName: string, tokenPath: string) {
			return `${collectionName}.${tokenPath}`;
		}
	};
}

/**
 * Parse a token reference path (e.g., "foundation.color/primary")
 * Returns { collection, tokenPath }
 */
export function parseTokenPath(path: string): { collection: string; tokenPath: string } | null {
	const dotIndex = path.indexOf('.');
	if (dotIndex === -1) return null;
	
	return {
		collection: path.substring(0, dotIndex),
		tokenPath: path.substring(dotIndex + 1)
	};
}

/**
 * Extract all mode names from a TokenJSON
 */
export function extractModes(json: TokenJSON): Set<string> {
	const modes = new Set<string>();
	
	for (const collection of Object.values(json)) {
		for (const token of Object.values(collection)) {
			for (const mode of Object.keys(token.$value)) {
				modes.add(mode);
			}
		}
	}
	
	return modes;
}

/**
 * Count total tokens across all collections
 */
export function countTokens(json: TokenJSON): number {
	let count = 0;
	for (const collection of Object.values(json)) {
		count += Object.keys(collection).length;
	}
	return count;
}
