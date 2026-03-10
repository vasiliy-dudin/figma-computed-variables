import { formatHex, formatRgb, parse as parseColor, converter } from 'culori';
import { ResolvedValue, TokenMap, RGBA, ColorModifyFn } from './types';
import { parseExpression } from './parser';
import { CircularDependencyError } from './validator';
import { PATTERNS } from './constants';

const toRgb = converter('rgb');
const toOklch = converter('oklch');

const ACHROMATIC_CHROMA_EPSILON = 0.001;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_HUE_SHIFT = -360;
const MAX_HUE_SHIFT = 360;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const clampRgbChannel = (value?: number): number => clamp01(value ?? 0);
const clampPercent = (value: number): number => clamp(value, MIN_PERCENT, MAX_PERCENT);
const normalizePercent = (value: number): number => clampPercent(value) / 100;
const clampHueShift = (value: number): number => clamp(value, MIN_HUE_SHIFT, MAX_HUE_SHIFT);
const wrapDegrees = (value: number): number => {
	const normalized = value % 360;
	return normalized < 0 ? normalized + 360 : normalized;
};

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
		return { ...value, a: clamp01(value.a * alpha) };
	}
	
	// Parse color string and normalise to sRGB
	const parsed = parseColorString(String(value));
	if (!parsed) {
		throw new Error(`Invalid color for alpha(): ${value}`);
	}
	const color = toRgb(parsed);
	
	return {
		r: clampRgbChannel(color.r),
		g: clampRgbChannel(color.g),
		b: clampRgbChannel(color.b),
		a: clamp01((color.alpha ?? 1) * alpha)
	};
}

/**
 * Apply a perceptual colour modification using oklch space
 * @param amount - Numeric amount based on function type:
 *   - darken/lighten/saturate/desaturate: 0-100 (percentage, 20 = 20% change relative to current value)
 *   - hueShift: -360 to 360 (degrees, 30 = subtle shift, -30 = opposite direction, 180 = complementary)
 */
function applyColorModify(value: string | number | RGBA, fn: ColorModifyFn, amount: number): RGBA {
	const rgba: RGBA = typeof value === 'object' && 'r' in value
		? value
		: hexToRgba(String(value));

	const rgbColor = { mode: 'rgb' as const, r: rgba.r, g: rgba.g, b: rgba.b, alpha: rgba.a };
	const oklch = toOklch(rgbColor);
	if (!oklch) {
		throw new Error('Unable to convert color to oklch for modification.');
	}

	const percentAmount = fn === 'hueShift' ? undefined : normalizePercent(amount);
	const hueShiftAmount = fn === 'hueShift' ? clampHueShift(amount) : undefined;

	const modified = { ...oklch };
	const lightness = clamp01(oklch.l ?? 0);
	const chroma = Math.max(0, oklch.c ?? 0);
	switch (fn) {
		case 'darken':
			// Reduce lightness relative to current value
			modified.l = clamp01(lightness - lightness * (percentAmount ?? 0));
			break;
		case 'lighten':
			// Increase lightness relative to remaining headroom
			const remaining = 1 - lightness;
			modified.l = clamp01(lightness + remaining * (percentAmount ?? 0));
			break;
		case 'saturate':
			// Increase chroma (c) by relative percentage: 10% → c + c*0.10
			modified.c = chroma + chroma * (percentAmount ?? 0);
			break;
		case 'desaturate':
			// Decrease chroma (c) by relative percentage: 10% → c - c*0.10
			modified.c = Math.max(0, chroma - chroma * (percentAmount ?? 0));
			if (modified.c < ACHROMATIC_CHROMA_EPSILON) {
				modified.c = 0;
				delete modified.h;
			}
			break;
		case 'hueShift': {
			// Achromatic colors (grays, black, white) have no meaningful hue — skip
			if (chroma < ACHROMATIC_CHROMA_EPSILON) {
				return rgba;
			}
			// Rotate hue (h) by degrees: 30 = subtle shift, 180 = complementary color
			const baseHue = oklch.h ?? 0;
			modified.h = wrapDegrees(baseHue + (hueShiftAmount ?? 0));
			break;
		}
	}

	const rgb = toRgb(modified);
	return {
		r: clamp01(rgb.r ?? 0),
		g: clamp01(rgb.g ?? 0),
		b: clamp01(rgb.b ?? 0),
		a: clamp01(rgb.alpha ?? 1)
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
		r: clampRgbChannel(color.r),
		g: clampRgbChannel(color.g),
		b: clampRgbChannel(color.b),
		a: clamp01(color.alpha ?? 1)
	};
}
