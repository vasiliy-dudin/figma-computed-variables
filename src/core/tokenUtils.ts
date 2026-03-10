import { TokenJSON, Token, TokenGroup, TokenMap, TokenValue, ModeValues, ValidationError } from './types';

/**
 * Type guard: returns true if value is a Token (has $type), not a nested group
 */
export function isToken(value: Token | TokenGroup): value is Token {
	return '$type' in value;
}

/**
 * Recursively flatten a TokenGroup into a map of dot-separated paths → Token.
 * e.g. { color: { primary: { $type, $value } } } → Map { "color.primary" → Token }
 */
export function flattenTokenGroup(group: TokenGroup, prefix: string = ''): Map<string, Token> {
	const result = new Map<string, Token>();
	const traverse = (node: TokenGroup, currentPath: string) => {
		if (node.$self && currentPath) {
			result.set(currentPath, node.$self);
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === '$self' || value === undefined) continue;
			const nextPath = currentPath ? `${currentPath}.${key}` : key;
			if (isToken(value)) {
				result.set(nextPath, value);
			} else {
				traverse(value, nextPath);
			}
		}
	};
	traverse(group, prefix);
	return result;
}

/**
 * Convert a flat Map<dotPath, Token> back into a nested TokenGroup.
 * e.g. Map { "color.primary" → Token } → { color: { primary: Token } }
 */
export function nestifyFlatPaths(flat: Map<string, Token>): TokenGroup {
	const result: TokenGroup = {};
	for (const [path, token] of flat) {
		const parts = path.split('.');
		let current = result;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isLeaf = i === parts.length - 1;
			const existing = current[part];
			if (isLeaf) {
				if (!existing) {
					current[part] = token;
				} else if (isToken(existing)) {
					current[part] = token;
				} else {
					(existing as TokenGroup).$self = token;
				}
			} else {
				if (!existing) {
					current[part] = {};
				} else if (isToken(existing)) {
					current[part] = { $self: existing };
				}
				current = current[part] as TokenGroup;
			}
		}
	}
	return result;
}

/**
 * Expand a token $value to a full mode-keyed record.
 * If value is already a record, return it as-is.
 * If value is a scalar shorthand, replicate it for each mode name.
 */
export function normalizeModeValues(value: TokenValue, modeNames: string[]): ModeValues {
	if (typeof value === 'string' || typeof value === 'number') {
		const result: ModeValues = {};
		for (const mode of modeNames) {
			result[mode] = value;
		}
		return result;
	}
	return value;
}

/** Collapse ModeValues with ≤1 entry back to TokenValue form. */
export function condenseModeValues(value: ModeValues): TokenValue {
	const entries = Object.entries(value);
	if (entries.length === 0) {
		return {};
	}
	if (entries.length === 1) {
		return entries[0][1];
	}
	return value;
}

/**
 * Build a map from bare token path → list of collection names that define it.
 * Used to detect ambiguous bare-path aliases.
 */
function buildBarePathCollectionsMap(json: TokenJSON): Map<string, string[]> {
	const result = new Map<string, string[]>();
	for (const [collectionName, group] of Object.entries(json)) {
		for (const tokenPath of flattenTokenGroup(group).keys()) {
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

	for (const [collectionName, group] of Object.entries(json)) {
		for (const [tokenPath, token] of flattenTokenGroup(group)) {
			map.set(`${collectionName}.${tokenPath}`, token);
			if (!ambiguousBare.has(tokenPath)) {
				bareMap.set(tokenPath, token);
			}
		}
	}

	return {
		isAmbiguous(path: string) {
			return ambiguousBare.has(path);
		},
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
	
	for (const group of Object.values(json)) {
		for (const token of flattenTokenGroup(group).values()) {
			if (typeof token.$value === 'string' || typeof token.$value === 'number') continue;
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

	for (const [collectionName, group] of Object.entries(json)) {
		for (const [tokenPath, token] of flattenTokenGroup(group)) {
			const rawValues =
				typeof token.$value === 'string' || typeof token.$value === 'number'
					? [token.$value]
					: Object.values(token.$value);
			for (const ref of extractBareAliases(rawValues.map(String).join(' '))) {
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
 * Count total tokens across all collections
 */
export function countTokens(json: TokenJSON): number {
	let count = 0;
	for (const group of Object.values(json)) {
		count += flattenTokenGroup(group).size;
	}
	return count;
}
