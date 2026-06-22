import { Expression, TokenType, ColorModifyFn } from './types';
import { PATTERNS } from './constants';

/**
 * Parse a token value expression based on its type
 */
export function parseExpression(input: string | number, type: TokenType): Expression {
	// Convert number to string for parsing
	const valueStr = String(input);
	
	// 1. Detect bare alias: {collection.token}
	const aliasMatch = valueStr.match(PATTERNS.bareAlias);
	if (aliasMatch) {
		return { type: 'alias', path: aliasMatch[1] };
	}
	
	// 2. Detect alpha() function: alpha({token}, 15%) or alpha({token}, {amountToken})
	const alphaMatch = valueStr.match(PATTERNS.alphaFunction);
	if (alphaMatch) {
		return {
			type: 'alpha',
			tokenPath: alphaMatch[1],
			amount: { kind: 'literal', amount: parseFloat(alphaMatch[2]) }
		};
	}
	const alphaRefMatch = valueStr.match(PATTERNS.alphaFunctionRef);
	if (alphaRefMatch) {
		return {
			type: 'alpha',
			tokenPath: alphaRefMatch[1],
			amount: { kind: 'reference', tokenPath: alphaRefMatch[2] }
		};
	}
	if (PATTERNS.alphaFunctionPrefix.test(valueStr)) {
		throw new Error('Invalid alpha() syntax: use a percentage (alpha({token}, 15%)) or a token reference (alpha({token}, {opacityToken})).');
	}

	// 3. Detect color modifier functions: darken({token}, 20%), lighten(...), hueShift({token}, 50deg),
	// or a token-reference amount: darken({token}, {amountToken}), hueShift({token}, {amountToken})
	const colorPercentMatch = valueStr.match(PATTERNS.colorPercentFunction);
	if (colorPercentMatch) {
		return {
			type: 'colorModify',
			fn: colorPercentMatch[1] as ColorModifyFn,
			tokenPath: colorPercentMatch[2],
			amount: { kind: 'literal', amount: parseFloat(colorPercentMatch[3]) }
		};
	}

	const colorPercentRefMatch = valueStr.match(PATTERNS.colorPercentFunctionRef);
	if (colorPercentRefMatch) {
		return {
			type: 'colorModify',
			fn: colorPercentRefMatch[1] as ColorModifyFn,
			tokenPath: colorPercentRefMatch[2],
			amount: { kind: 'reference', tokenPath: colorPercentRefMatch[3] }
		};
	}

	const hueShiftMatch = valueStr.match(PATTERNS.hueShiftFunction);
	if (hueShiftMatch) {
		return {
			type: 'colorModify',
			fn: 'hueShift',
			tokenPath: hueShiftMatch[1],
			amount: { kind: 'literal', amount: parseFloat(hueShiftMatch[2]) }
		};
	}

	const hueShiftRefMatch = valueStr.match(PATTERNS.hueShiftFunctionRef);
	if (hueShiftRefMatch) {
		return {
			type: 'colorModify',
			fn: 'hueShift',
			tokenPath: hueShiftRefMatch[1],
			amount: { kind: 'reference', tokenPath: hueShiftRefMatch[2] }
		};
	}

	if (PATTERNS.colorFunctionPrefix.test(valueStr)) {
		throw new Error('Invalid color modifier syntax: use percentages (10%) / degrees (30deg) depending on the function, or a token reference such as darken({token}, {amountToken}).');
	}

	// 4. Type-specific parsing
	switch (type) {
		case 'color':
			return { type: 'literal', value: valueStr };
      
    case 'number':
			// Check if contains math operators or token references
			if (containsMathOrTokens(valueStr)) {
				return { type: 'math', expression: valueStr };
			}
			// Preserve a trailing "%" as a string literal — parseFloat would silently drop it
			// (e.g. "50%" -> 50), losing the percentage meaning for amount-reference resolution.
			if (typeof input === 'string' && valueStr.endsWith('%')) {
				return { type: 'literal', value: valueStr };
			}
			return { type: 'literal', value: typeof input === 'number' ? input : parseFloat(valueStr) };
			
		case 'string':
			// Check if contains token references for concatenation
			if (new RegExp(PATTERNS.tokenReference.source).test(valueStr)) {
				return parseStringConcat(valueStr);
			}
			return { type: 'literal', value: valueStr };
			
		default:
			return { type: 'literal', value: valueStr };
	}
}

/**
 * Check if a string contains math operators or token references
 */
function containsMathOrTokens(value: string): boolean {
	// Contains token references
	const tokenReferenceRegex = new RegExp(PATTERNS.tokenReference);
	if (tokenReferenceRegex.test(value)) return true;
	
	// Contains math operators
	if (/[+\-*/()]/.test(value)) return true;
	
	return false;
}

/**
 * Parse string concatenation expression
 */
function parseStringConcat(value: string): Expression {
	const parts: Array<string | { type: 'token'; path: string }> = [];
	let lastIndex = 0;
	const regex = new RegExp(PATTERNS.tokenReference);
	let match;
	
	while ((match = regex.exec(value)) !== null) {
		// Add text before the token reference
		if (match.index > lastIndex) {
			parts.push(value.substring(lastIndex, match.index));
		}
		
		// Add token reference
		parts.push({ type: 'token', path: match[1] });
		
		lastIndex = regex.lastIndex;
	}
	
	// Add remaining text
	if (lastIndex < value.length) {
		parts.push(value.substring(lastIndex));
	}
	
	return { type: 'concat', parts };
}
