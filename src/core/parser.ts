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
	
	// 2. Detect alpha() function: alpha({token}, 0.5)
	const alphaMatch = valueStr.match(PATTERNS.alphaFunction);
	if (alphaMatch) {
		return {
			type: 'alpha',
			tokenPath: alphaMatch[1],
			alpha: parseFloat(alphaMatch[2])
		};
	}

	// 3. Detect color modifier functions: darken({token}, 0.2), lighten(...), etc.
	const colorModifyMatch = valueStr.match(PATTERNS.colorModifyFunction);
	if (colorModifyMatch) {
		return {
			type: 'colorModify',
			fn: colorModifyMatch[1] as ColorModifyFn,
			tokenPath: colorModifyMatch[2],
			amount: parseFloat(colorModifyMatch[3])
		};
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
			if (PATTERNS.tokenReference.test(valueStr)) {
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
	if (PATTERNS.tokenReference.test(value)) return true;
	
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
