import { TokenJSONSchema, TokenJSON, ValidationError, TokenMap } from './types';
import { createTokenMap } from './tokenUtils';
import { ZodIssue } from 'zod';

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
export function detectCircularDependencies(json: TokenJSON): ValidationError[] {
	const errors: ValidationError[] = [];
	const tokenMap = createTokenMap(json);
	
	for (const [collectionName, collection] of Object.entries(json)) {
		for (const [tokenPath, token] of Object.entries(collection)) {
			for (const [mode, value] of Object.entries(token.$value)) {
				const visited = new Set<string>();
				const fullPath = `${collectionName}.${tokenPath}`;
				
				try {
					checkCircular(String(value), fullPath, mode, tokenMap, visited);
				} catch (err) {
					if (err instanceof CircularDependencyError) {
						errors.push({
							collection: collectionName,
							token: tokenPath,
							mode,
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
			// Reference error will be caught separately
			continue;
		}
		
		const referencedToken = tokenMap.get(ref);
		if (!referencedToken) continue;
		
		const referencedValue = referencedToken.$value[mode];
		if (referencedValue !== undefined) {
			checkCircular(String(referencedValue), ref, mode, tokenMap, new Set(visited));
		}
	}
}

/**
 * Extract token references from a value string
 */
function extractTokenReferences(value: string): string[] {
	const references: string[] = [];
	const regex = /\{([^}]+)\}/g;
	let match;
	
	while ((match = regex.exec(value)) !== null) {
		references.push(match[1]);
	}
	
	return references;
}

/**
 * Validate token references exist
 */
export function validateReferences(json: TokenJSON): ValidationError[] {
	const errors: ValidationError[] = [];
	const tokenMap = createTokenMap(json);
	
	for (const [collectionName, collection] of Object.entries(json)) {
		for (const [tokenPath, token] of Object.entries(collection)) {
			for (const [mode, value] of Object.entries(token.$value)) {
				const references = extractTokenReferences(String(value));
				
				for (const ref of references) {
					if (!tokenMap.has(ref)) {
						errors.push({
							collection: collectionName,
							token: tokenPath,
							mode,
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
	
	// 2. Reference validation
	const referenceErrors = validateReferences(tokenJson);
	
	// 3. Circular dependency detection
	const circularErrors = detectCircularDependencies(tokenJson);
	
	const allErrors = [...referenceErrors, ...circularErrors];
	
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
