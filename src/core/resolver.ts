import { formatHex, formatRgb, parse as parseColor, converter } from 'culori';
import { ResolvedValue, TokenMap, RGBA, ColorModifyFn } from './types';
import { parseExpression } from './parser';
import { CircularDependencyError } from './validator';
import { PATTERNS } from './constants';

const toRgb = converter('rgb');
const toOklch = converter('oklch');

/**
 * Parse any color string to a culori Color object.
 * Handles CSS oklch() syntax which culori's parse() does not support natively.
 */
function parseColorString(str: string): ReturnType<typeof parseColor> {
	const oklchMatch = str.match(PATTERNS.oklchColor);
	if (oklchMatch) {
		return {
			mode: 'oklch',
			l: parseFloat(oklchMatch[1]),
			c: parseFloat(oklchMatch[2]),
			h: parseFloat(oklchMatch[3]),
			alpha: oklchMatch[4] !== undefined ? parseFloat(oklchMatch[4]) : 1,
		};
	}
	return parseColor(str);
}

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

		case 'colorModify': {
			// Computed value (perceptual color modification)
			const baseColor = resolveToken(expr.tokenPath, mode, tokenMap, new Set(visited));
			if (baseColor.isAlias) {
				throw new Error(`Cannot apply ${expr.fn}() to alias: ${expr.tokenPath}`);
			}
			return { isAlias: false, value: applyColorModify(baseColor.value, expr.fn, expr.amount) };
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
	
	// Parse color string and normalise to sRGB
	const parsed = parseColorString(String(value));
	if (!parsed) {
		throw new Error(`Invalid color for alpha(): ${value}`);
	}
	const color = toRgb(parsed);
	
	return {
		r: color.r ?? 0,
		g: color.g ?? 0,
		b: color.b ?? 0,
		a: (color.alpha ?? 1) * alpha
	};
}

/**
 * Apply a perceptual colour modification using oklch space
 * @param amount - Numeric amount based on function type:
 *   - darken/lighten/saturate/desaturate: 0-100 (percentage, 20 = 20% change)
 *   - hueShift: -360 to 360 (degrees, 30 = subtle shift, -30 = opposite direction, 180 = complementary)
 */
function applyColorModify(value: string | number | RGBA, fn: ColorModifyFn, amount: number): RGBA {
	const rgba: RGBA = typeof value === 'object' && 'r' in value
		? value
		: hexToRgba(String(value));

	const rgbColor = { mode: 'rgb' as const, r: rgba.r, g: rgba.g, b: rgba.b, alpha: rgba.a };
	const oklch = toOklch(rgbColor);

	// Convert percentage to decimal for 4 functions (20% → 0.20), degrees unchanged for hueShift
	const effectiveAmount = (fn === 'hueShift') ? amount : amount / 100;

	const modified = { ...oklch };
	switch (fn) {
		case 'darken':
			// Reduce lightness (l) by percentage: 20 = 20% darker
			modified.l = Math.max(0, (oklch.l ?? 0) - effectiveAmount);
			break;
		case 'lighten':
			// Increase lightness (l) by percentage: 20 = 20% lighter
			modified.l = Math.min(1, (oklch.l ?? 0) + effectiveAmount);
			break;
		case 'saturate':
			// Increase chroma (c) by relative percentage: 10% → c * 1.10
			modified.c = (oklch.c ?? 0) * (1 + effectiveAmount);
			break;
		case 'desaturate':
			// Decrease chroma (c) by relative percentage: 10% → c * 0.90
			modified.c = Math.max(0, (oklch.c ?? 0) * (1 - effectiveAmount));
			break;
		case 'hueShift': {
			// Achromatic colors (grays, black, white) have no meaningful hue — skip
			const ACHROMATIC_CHROMA_EPSILON = 0.001;
			if ((oklch.c ?? 0) < ACHROMATIC_CHROMA_EPSILON) {
				return rgba;
			}
			// Rotate hue (h) by degrees: 30 = subtle shift, 180 = complementary color
			modified.h = ((oklch.h ?? 0) + effectiveAmount) % 360;
			break;
		}
	}

	const rgb = toRgb(modified);
	return {
		r: Math.max(0, Math.min(1, rgb.r ?? 0)),
		g: Math.max(0, Math.min(1, rgb.g ?? 0)),
		b: Math.max(0, Math.min(1, rgb.b ?? 0)),
		a: rgb.alpha ?? 1
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
	const parsed = parseColorString(hex);
	if (!parsed) {
		throw new Error(`Invalid color: ${hex}`);
	}
	const color = toRgb(parsed);
	
	// Clamp to [0,1]: oklch colors may be out of sRGB gamut, producing values outside this range
	return {
		r: Math.max(0, Math.min(1, color.r ?? 0)),
		g: Math.max(0, Math.min(1, color.g ?? 0)),
		b: Math.max(0, Math.min(1, color.b ?? 0)),
		a: color.alpha ?? 1
	};
}
