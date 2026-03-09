import { formatHex, formatRgb, parse as parseColor } from 'culori';
import { ResolvedValue, TokenMap, RGBA } from './types';
import { parseExpression } from './parser';
import { CircularDependencyError } from './validator';

/**
 * Resolve a token value for a specific mode
 */
export function resolveToken(
	tokenPath: string,
	mode: string,
	tokenMap: TokenMap,
	visited: Set<string> = new Set()
): ResolvedValue {
	// Circular dependency check
	if (visited.has(tokenPath)) {
		throw new CircularDependencyError(`Circular dependency: ${[...visited, tokenPath].join(' → ')}`);
	}
	
	visited.add(tokenPath);
	
	const token = tokenMap.get(tokenPath);
	if (!token) {
		throw new Error(`Token not found: ${tokenPath}`);
	}
	
	const value =
		typeof token.$value === 'string' || typeof token.$value === 'number'
			? token.$value
			: token.$value[mode];
	if (value === undefined) {
		throw new Error(`Mode "${mode}" not found for token: ${tokenPath}`);
	}
	
	const expr = parseExpression(value, token.$type);
	
	switch (expr.type) {
		case 'literal':
			return { isAlias: false, value: expr.value };
		
		case 'alias':
			// Return as native Figma alias (not computed)
			return { isAlias: true, targetPath: expr.path };
		
		case 'alpha': {
			// Computed value (alpha multiplication)
			const baseColor = resolveToken(expr.tokenPath, mode, tokenMap, new Set(visited));
			if (baseColor.isAlias) {
				throw new Error(`Cannot apply alpha() to alias: ${expr.tokenPath}`);
			}
			// Type narrowing: if not alias, then it has value property
			return { isAlias: false, value: applyAlpha(baseColor.value, expr.alpha) };
		}
		
		case 'math': {
			// Computed value (math expression)
			const result = evaluateMath(expr.expression, mode, tokenMap, new Set(visited));
			return { isAlias: false, value: result };
		}
		
		case 'concat': {
			// Computed value (string concatenation)
			const result = evaluateConcat(expr.parts, mode, tokenMap, new Set(visited));
			return { isAlias: false, value: result };
		}
	}
}

/**
 * Apply alpha multiplication to a color
 */
function applyAlpha(value: string | number | RGBA, alpha: number): RGBA {
	if (typeof value === 'object' && 'r' in value) {
		// Already an RGBA object
		return { ...value, a: value.a * alpha };
	}
	
	// Parse color string
	const color = parseColor(String(value));
	if (!color) {
		throw new Error(`Invalid color for alpha(): ${value}`);
	}
	
	return {
		r: color.r ?? 0,
		g: color.g ?? 0,
		b: color.b ?? 0,
		a: (color.alpha ?? 1) * alpha
	};
}

/**
 * Evaluate a math expression, resolving token references
 */
function evaluateMath(
	expression: string,
	mode: string,
	tokenMap: TokenMap,
	visited: Set<string>
): number {
	// Replace token references with their resolved numeric values
	let resolved = expression;
	const tokenRegex = /\{([^}]+)\}/g;
	let match;
	
	while ((match = tokenRegex.exec(expression)) !== null) {
		const tokenPath = match[1];
		const tokenValue = resolveToken(tokenPath, mode, tokenMap, new Set(visited));
		
		if (tokenValue.isAlias) {
			throw new Error(`Cannot use alias in math expression: ${tokenPath}`);
		}
		
		if (typeof tokenValue.value !== 'number') {
			throw new Error(`Token ${tokenPath} is not a number (found: ${typeof tokenValue.value})`);
		}
		
		// Replace the token reference with its numeric value
		resolved = resolved.replace(`{${tokenPath}}`, String(tokenValue.value));
	}
	
	// Evaluate the expression using Function constructor (ES2017 compatible)
	try {
		const result = new Function('return (' + resolved + ')')();
		
		if (typeof result !== 'number' || !isFinite(result)) {
			throw new Error('Result is not a finite number');
		}
		
		return result;
	} catch (err) {
		throw new Error(`Math evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Evaluate string concatenation, resolving token references
 */
function evaluateConcat(
	parts: Array<string | { type: 'token'; path: string }>,
	mode: string,
	tokenMap: TokenMap,
	visited: Set<string>
): string {
	return parts.map(part => {
		if (typeof part === 'string') {
			return part;
		}
		
		const tokenValue = resolveToken(part.path, mode, tokenMap, new Set(visited));
		
		if (tokenValue.isAlias) {
			throw new Error(`Cannot use alias in string concatenation: ${part.path}`);
		}
		
		return String(tokenValue.value);
	}).join('');
}

/**
 * Convert Figma RGBA to hex string
 */
export function rgbaToHex(rgba: RGBA): string {
	const color = {
		mode: 'rgb' as const,
		r: rgba.r,
		g: rgba.g,
		b: rgba.b,
		alpha: rgba.a
	};
	
	if (rgba.a === 1) {
		return formatHex(color) ?? '#000000';
	}
	
	return formatRgb(color) ?? 'rgba(0,0,0,1)';
}

/**
 * Convert hex or rgb string to Figma RGBA
 */
export function hexToRgba(hex: string): RGBA {
	const color = parseColor(hex);
	if (!color) {
		throw new Error(`Invalid color: ${hex}`);
	}
	
	return {
		r: color.r ?? 0,
		g: color.g ?? 0,
		b: color.b ?? 0,
		a: color.alpha ?? 1
	};
}
