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
	
	// 2. Detect alpha() function: alpha({token}, 15%)
	const alphaMatch = valueStr.match(PATTERNS.alphaFunction);
	if (alphaMatch) {
		return {
			type: 'alpha',
			tokenPath: alphaMatch[1],
			alpha: parseFloat(alphaMatch[2]) / 100
		};
	}
	if (PATTERNS.alphaFunctionPrefix.test(valueStr)) {
		throw new Error('Invalid alpha() syntax: use percentages such as alpha({token}, 15%).');
	}

	// 3. Detect color modifier functions: darken({token}, 20%), lighten(...), hueShift({token}, 50deg)
	const colorPercentMatch = valueStr.match(PATTERNS.colorPercentFunction);
	if (colorPercentMatch) {
		return {
			type: 'colorModify',
			fn: colorPercentMatch[1] as ColorModifyFn,
			tokenPath: colorPercentMatch[2],
			amount: parseFloat(colorPercentMatch[3])
		};
	}

	const hueShiftMatch = valueStr.match(PATTERNS.hueShiftFunction);
	if (hueShiftMatch) {
		return {
			type: 'colorModify',
			fn: 'hueShift',
			tokenPath: hueShiftMatch[1],
			amount: parseFloat(hueShiftMatch[2])
		};
	}

	if (PATTERNS.colorFunctionPrefix.test(valueStr)) {
		throw new Error('Invalid color modifier syntax: use percentages for darken/lighten/saturate/desaturate and degrees for hueShift.');
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
