import { TokenJSONSchema, TokenJSON, ValidationError, TokenMap, Token, ColorModifyFn } from './types';
import { createTokenMap, detectAmbiguousAliases, extractTokenReferences, flattenTokenGroup, isExcluded } from './tokenUtils';
import { PATTERNS } from './constants';
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
		if (isExcluded(collectionName)) continue;
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
		if (isExcluded(collectionName)) continue;
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
	const modifierSyntaxErrors = validateModifierSyntax(tokenJson, tokenMap);
	
	// 3. Circular dependency detection
	const circularErrors = detectCircularDependencies(tokenJson, tokenMap);

	// 4. Ambiguous alias detection
	const ambiguousErrors = detectAmbiguousAliases(tokenJson);

	const allErrors = [...referenceErrors, ...modifierSyntaxErrors, ...circularErrors, ...ambiguousErrors];
	
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

function validateModifierSyntax(json: TokenJSON, tokenMap: TokenMap): ValidationError[] {
	const errors: ValidationError[] = [];

	for (const [collectionName, group] of Object.entries(json)) {
		if (isExcluded(collectionName)) continue;
		for (const [tokenPath, token] of flattenTokenGroup(group)) {
			const values: Array<[string, string | number]> =
				typeof token.$value === 'string' || typeof token.$value === 'number'
					? [['', token.$value]]
					: Object.entries(token.$value);

			for (const [mode, rawValue] of values) {
				if (typeof rawValue !== 'string') continue;
				errors.push(
					...collectModifierSyntaxErrors({
						value: rawValue,
						collectionName,
						tokenPath,
						mode: mode || undefined,
						tokenMap,
					})
				);
			}
		}
	}

	return errors;
}

interface ModifierValidationContext {
	value: string;
	collectionName: string;
	tokenPath: string;
	mode?: string;
	tokenMap: TokenMap;
}

function collectModifierSyntaxErrors(ctx: ModifierValidationContext): ValidationError[] {
	const { value, collectionName, tokenPath, mode, tokenMap } = ctx;
	const trimmed = value.trim();
	const refCtx = { collectionName, tokenPath, mode, tokenMap };

	const alphaErrors = matchAndValidateModifier(trimmed, PATTERNS.alphaFunction, PATTERNS.alphaFunctionRef, () => 'alpha', 1, 2, refCtx);
	if (alphaErrors) return alphaErrors;
	if (PATTERNS.alphaFunctionPrefix.test(trimmed)) {
		return [createSyntaxError(collectionName, tokenPath, mode, 'alpha() requires a percentage amount (alpha({token}, 15%)) or a token reference (alpha({token}, {opacityToken})).')];
	}

	const percentErrors = matchAndValidateModifier(trimmed, PATTERNS.colorPercentFunction, PATTERNS.colorPercentFunctionRef, m => m[1] as ColorModifyFn, 2, 3, refCtx);
	if (percentErrors) return percentErrors;

	const hueErrors = matchAndValidateModifier(trimmed, PATTERNS.hueShiftFunction, PATTERNS.hueShiftFunctionRef, () => 'hueShift', 1, 2, refCtx);
	if (hueErrors) return hueErrors;

	if (PATTERNS.colorFunctionPrefix.test(trimmed)) {
		return [createSyntaxError(collectionName, tokenPath, mode, 'Color modifiers require percentages (10%) or degrees (30deg) depending on the function, or a token reference such as darken({token}, {amountToken}).')];
	}

	return [];
}

/**
 * Try a literal-amount pattern and its token-reference counterpart for one
 * modifier function. Returns null when neither pattern matches (so the caller
 * can fall through to try the next function), or the validation errors for the
 * base color reference and — when matched via the reference pattern — the
 * amount reference, when one of them does match.
 */
function matchAndValidateModifier(
	trimmed: string,
	literalPattern: RegExp,
	refPattern: RegExp,
	getFn: (match: RegExpMatchArray) => 'alpha' | ColorModifyFn,
	refPathGroup: number,
	amountGroup: number,
	ctx: Omit<ModifierReferenceContext, 'fn' | 'refPath'>
): ValidationError[] | null {
	const literalMatch = trimmed.match(literalPattern);
	const refMatch = trimmed.match(refPattern);
	const match = literalMatch ?? refMatch;
	if (!match) return null;

	const fn = getFn(match);
	const errors = validateModifierReference({ fn, refPath: match[refPathGroup], ...ctx });
	if (refMatch) {
		errors.push(...validateAmountReference({ fn, amountPath: refMatch[amountGroup], ...ctx }));
	}
	return errors;
}

interface ModifierReferenceContext {
	fn: 'alpha' | ColorModifyFn;
	refPath: string;
	collectionName: string;
	tokenPath: string;
	mode?: string;
	tokenMap: TokenMap;
}

function validateModifierReference(ctx: ModifierReferenceContext): ValidationError[] {
	const { fn, refPath, collectionName, tokenPath, mode, tokenMap } = ctx;
	const errors: ValidationError[] = [];
	const referencedToken = tokenMap.get(refPath);
	if (!referencedToken) {
		return errors;
	}

	if (referencedToken.$type !== 'color') {
		errors.push(createSyntaxError(collectionName, tokenPath, mode, `${fn}() can reference only color tokens (found "${refPath}" of type "${referencedToken.$type}").`));
	}

	return errors;
}

interface AmountReferenceContext {
	fn: 'alpha' | ColorModifyFn;
	amountPath: string;
	collectionName: string;
	tokenPath: string;
	mode?: string;
	tokenMap: TokenMap;
}

/**
 * Validate that an amount reference (the second argument of alpha()/colorModify()
 * when written as a token reference) does not point at a color token. It does not
 * check that the referenced value actually parses as a percentage/decimal/degrees —
 * that is validated at apply-time in resolver.ts's resolveAmount, since it may
 * require following an alias chain.
 */
function validateAmountReference(ctx: AmountReferenceContext): ValidationError[] {
	const { fn, amountPath, collectionName, tokenPath, mode, tokenMap } = ctx;
	const errors: ValidationError[] = [];
	const referencedToken = tokenMap.get(amountPath);
	if (!referencedToken) {
		return errors;
	}

	if (referencedToken.$type === 'color') {
		errors.push(createSyntaxError(collectionName, tokenPath, mode, `${fn}() amount reference "${amountPath}" must be a number or percentage token, not a color token.`));
	}

	return errors;
}

function createSyntaxError(collection: string, token: string, mode: string | undefined, message: string): ValidationError {
	return {
		collection,
		token,
		mode,
		errorType: 'syntax',
		message,
	};
}
