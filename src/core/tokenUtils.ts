import { TokenJSON, Token, TokenMap, ValidationError } from './types';

/**
 * Build a map from bare token path → list of collection names that define it.
 * Used to detect ambiguous bare-path aliases.
 */
function buildBarePathCollectionsMap(json: TokenJSON): Map<string, string[]> {
	const result = new Map<string, string[]>();
	for (const [collectionName, collection] of Object.entries(json)) {
		for (const tokenPath of Object.keys(collection)) {
			const existing = result.get(tokenPath);
			if (existing) {
				existing.push(collectionName);
			} else {
				result.set(tokenPath, [collectionName]);
			}
		}
	}
	return result;
}

/**
 * Create a TokenMap for efficient token lookups
 */
export function createTokenMap(json: TokenJSON): TokenMap {
	const map = new Map<string, Token>();
	const bareMap = new Map<string, Token>();
	const collectionsMap = buildBarePathCollectionsMap(json);
	const ambiguousBare = new Set(
		[...collectionsMap.entries()]
			.filter(([, cols]) => cols.length > 1)
			.map(([tokenPath]) => tokenPath)
	);

	for (const [collectionName, collection] of Object.entries(json)) {
		for (const [tokenPath, token] of Object.entries(collection)) {
			map.set(`${collectionName}.${tokenPath}`, token);
			if (!ambiguousBare.has(tokenPath)) {
				bareMap.set(tokenPath, token);
			}
		}
	}

	return {
		ambiguousBare,
		get(path: string) {
			return map.get(path) ?? (ambiguousBare.has(path) ? undefined : bareMap.get(path));
		},
		has(path: string) {
			return map.has(path) || (!ambiguousBare.has(path) && bareMap.has(path));
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
 * Detect ambiguous bare-path aliases — bare {name} references that match tokens
 * in more than one collection, making resolution impossible.
 */
export function detectAmbiguousAliases(json: TokenJSON): ValidationError[] {
	const collectionsMap = buildBarePathCollectionsMap(json);
	const ambiguous = new Set(
		[...collectionsMap.entries()]
			.filter(([, cols]) => cols.length > 1)
			.map(([tokenPath]) => tokenPath)
	);

	if (ambiguous.size === 0) return [];

	const errors: ValidationError[] = [];
	const seen = new Set<string>();

	for (const [collectionName, collection] of Object.entries(json)) {
		for (const [tokenPath, token] of Object.entries(collection)) {
			for (const ref of extractBareAliases(Object.values(token.$value).map(String).join(' '))) {
				const errorKey = `${collectionName}.${tokenPath}::${ref}`;
				if (!ambiguous.has(ref) || seen.has(errorKey)) continue;
				seen.add(errorKey);
				const matchingCollections = collectionsMap.get(ref)!;
				errors.push({
					collection: collectionName,
					token: tokenPath,
					errorType: 'collision',
					message: `Ambiguous alias "{${ref}}": found in collections ${matchingCollections.map(c => `"${c}"`).join(', ')}. Use the full path, e.g. "{${matchingCollections[0]}.${ref}}".`
				});
			}
		}
	}

	return errors;
}

/**
 * Extract all token reference paths from a value string, e.g. {primary} and {foundation.primary}
 */
export function extractTokenReferences(value: string): string[] {
	return [...value.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
}

/**
 * Extract only bare (dot-free) alias references from a value string, e.g. {primary} but not {foundation.primary}
 */
function extractBareAliases(value: string): string[] {
	return extractTokenReferences(value).filter(ref => !ref.includes('.'));
}

/**
 * Return the set of bare token paths that appear in more than one collection.
 */
export function getAmbiguousBareAliases(json: TokenJSON): Set<string> {
	const collectionsMap = buildBarePathCollectionsMap(json);
	return new Set(
		[...collectionsMap.entries()]
			.filter(([, cols]) => cols.length > 1)
			.map(([tokenPath]) => tokenPath)
	);
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
