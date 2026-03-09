import { TokenJSONSchema, TokenJSON, ValidationError, TokenMap } from './types';
import { createTokenMap, detectAmbiguousAliases, extractTokenReferences, flattenTokenGroup } from './tokenUtils';
import { ZodIssue } from 'zod';

const SCALAR_MODE_SENTINEL = '';

/**
 * Validate token JSON schema
 */
export function validateSchema(json: unknown): { valid: true; data: TokenJSON } | { valid: false; errors: ValidationError[] } {
	const result = TokenJSONSchema.safeParse(json);
	
	if (!result.success) {
		const errors: ValidationError[] = result.error.issues.map((err: ZodIssue) => ({
			collection: 'unknown',
			token: 'unknown',
			errorType: 'schema' as const,
			message: `${err.path.join('.')}: ${err.message}`
		}));
		
		return { valid: false, errors };
	}
	
	return { valid: true, data: result.data };
}

/**
 * Detect circular dependencies in token references
 */
export function detectCircularDependencies(json: TokenJSON, tokenMap: TokenMap = createTokenMap(json)): ValidationError[] {
	const errors: ValidationError[] = [];
	
	for (const [collectionName, group] of Object.entries(json)) {
		for (const [tokenPath, token] of flattenTokenGroup(group)) {
			const fullPath = `${collectionName}.${tokenPath}`;
			const modeEntries: Array<[string, string | number]> =
				typeof token.$value === 'string' || typeof token.$value === 'number'
					? [['', token.$value]]
					: Object.entries(token.$value);

			for (const [mode, value] of modeEntries) {
				const visited = new Set<string>();
				try {
					checkCircular(String(value), fullPath, mode, tokenMap, visited);
				} catch (err) {
					if (err instanceof CircularDependencyError) {
						errors.push({
							collection: collectionName,
							token: tokenPath,
							mode: mode || undefined,
							errorType: 'circular',
							message: err.message
						});
					}
				}
			}
		}
	}
	
	return errors;
}

/**
 * Recursively check for circular dependencies
 */
function checkCircular(
	value: string,
	currentPath: string,
	mode: string,
	tokenMap: TokenMap,
	visited: Set<string>
): void {
	if (visited.has(currentPath)) {
		throw new CircularDependencyError(`Circular dependency: ${[...visited, currentPath].join(' → ')}`);
	}
	
	visited.add(currentPath);
	
	// Extract token references from value
	const references = extractTokenReferences(String(value));
	
	for (const ref of references) {
		if (!tokenMap.has(ref)) {
			// Covers both missing refs and ambiguous bare refs (tokenMap.has returns false for
			// ambiguous paths). Reference/ambiguity errors are reported by their own validators.
			continue;
		}
		
		const referencedToken = tokenMap.get(ref);
		if (!referencedToken) continue;
		
		const rawRef = referencedToken.$value;
		if (typeof rawRef === 'string' || typeof rawRef === 'number') {
			checkCircular(String(rawRef), ref, mode, tokenMap, new Set(visited));
		} else if (mode === SCALAR_MODE_SENTINEL) {
			for (const modeValue of Object.values(rawRef)) {
				checkCircular(String(modeValue), ref, mode, tokenMap, new Set(visited));
			}
		} else {
			const referencedValue = rawRef[mode];
			if (referencedValue !== undefined) {
				checkCircular(String(referencedValue), ref, mode, tokenMap, new Set(visited));
			}
		}
	}
}

/**
 * Validate token references exist
 */
export function validateReferences(json: TokenJSON, tokenMap: TokenMap = createTokenMap(json)): ValidationError[] {
	const errors: ValidationError[] = [];

	for (const [collectionName, group] of Object.entries(json)) {
		for (const [tokenPath, token] of flattenTokenGroup(group)) {
			const modeEntries: Array<[string, string | number]> =
				typeof token.$value === 'string' || typeof token.$value === 'number'
					? [['', token.$value]]
					: Object.entries(token.$value);

			for (const [mode, value] of modeEntries) {
				const references = extractTokenReferences(String(value));
				
				for (const ref of references) {
					if (tokenMap.isAmbiguous(ref)) continue;
					if (!tokenMap.has(ref)) {
						errors.push({
							collection: collectionName,
							token: tokenPath,
							mode: mode || undefined,
							errorType: 'reference',
							message: `Reference "{${ref}}" does not exist`
						});
					}
				}
			}
		}
	}
	
	return errors;
}

/**
 * Run full validation
 */
export function validate(data: unknown): 
	| { valid: true; data: TokenJSON; errors?: never } 
	| { valid: false; errors: ValidationError[]; data?: never } {
	// 1. Schema validation
	const schemaResult = validateSchema(data);
	if (!schemaResult.valid) {
		return schemaResult;
	}
	
	const tokenJson = schemaResult.data;
	const tokenMap = createTokenMap(tokenJson);

	// 2. Reference validation
	const referenceErrors = validateReferences(tokenJson, tokenMap);
	
	// 3. Circular dependency detection
	const circularErrors = detectCircularDependencies(tokenJson, tokenMap);

	// 4. Ambiguous alias detection
	const ambiguousErrors = detectAmbiguousAliases(tokenJson);

	const allErrors = [...referenceErrors, ...circularErrors, ...ambiguousErrors];
	
	if (allErrors.length > 0) {
		return { valid: false, errors: allErrors };
	}
	
	return { valid: true, data: tokenJson };
}

/**
 * Custom error for circular dependencies
 */
export class CircularDependencyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CircularDependencyError';
	}
}
