import { TokenMap, AlphaIntent, AmountValue, Expression } from './types';
import { parseExpression } from './parser';
import { resolveAmount, resolveToConcreteValue, hexToRgba } from './resolver';

// alpha() amounts are percentages; alphas are 0-1 fractions.
const PERCENT_SCALE = 100;

/** The opaque colour an alpha() base leads to, walking through alpha() and {alias} tokens. */
interface OpaqueRoot {
	path: string;
	// Alpha of the base as alpha() computes it: the steps' percentages applied from the root
	// outward, clamped to 0-1 at each step exactly as applyAlpha does. 1 when there are no steps.
	baseAlpha: number;
	// How many alpha() tokens were walked through; alias hops do not count.
	steps: number;
}

/**
 * Report what an alpha() token asks for — the token a composed colour should reference, the
 * opacity percentage, and whether a composed colour paints exactly what alpha() computes —
 * without computing the colour. Returns null when the token is not an alpha() expression, or
 * when its target or amount cannot be determined.
 *
 * Figma replaces a base's alpha where alpha() multiplies it, so only an opaque base can be
 * referenced as is. A base that is itself an alpha() token is walked down to its opaque root:
 * alpha(alpha(X, p1), p2) equals alpha(X, p1·p2), which Figma expresses as a reference to X.
 *
 * Failures resolve to null rather than throwing on purpose: the caller falls through to the
 * normal resolveToken path, where the same failure surfaces once, attributed to the right
 * collection, token and mode.
 *
 * The percentage is not clamped here: alpha({x}, 150%) yields 150. It is clamped when written.
 */
export function resolveAlphaIntent(tokenPath: string, mode: string, tokenMap: TokenMap): AlphaIntent | null {
	try {
		const expr = expressionOf(tokenPath, mode, tokenMap);
		if (expr?.type !== 'alpha') return null;

		const visited = new Set([tokenPath]);
		const percent = resolveAmount(expr.amount, mode, tokenMap, new Set(visited), 'percent');
		const directOpacityToken = referenceablePercentToken(expr.amount, percent, mode, tokenMap, new Set(visited));
		const root = walkToOpaqueRoot(expr.tokenPath, mode, tokenMap, visited);
		if (!root) {
			// Not writable as a composed colour; the intent still lets Apply recognise a value
			// authored in Figma that matches it, including by its opacity variable.
			return { targetPath: expr.tokenPath, percent, opacityTokenPath: directOpacityToken, eligible: false };
		}

		// Once percentages are multiplied the opacity is a number, so the amount token stays
		// linked only when there are no steps.
		const opacityTokenPath = root.steps === 0 ? directOpacityToken : null;
		return { targetPath: root.path, percent: percent * root.baseAlpha, opacityTokenPath, eligible: true };
	} catch {
		return null;
	}
}

/**
 * Follows the base through alpha() and {alias} tokens until it resolves to an opaque colour.
 * Returns null when the walk ends anywhere else — a translucent literal, another colour
 * function over a translucent colour, a non-colour — or loops.
 */
function walkToOpaqueRoot(basePath: string, mode: string, tokenMap: TokenMap, visited: Set<string>): OpaqueRoot | null {
	// Step percentages, outermost first.
	const stepPercents: number[] = [];
	const walked = new Set<string>();
	let path = basePath;

	while (!walked.has(path)) {
		walked.add(path);
		if (isOpaque(path, mode, tokenMap, new Set(visited))) {
			return { path, baseAlpha: alphaFromRoot(stepPercents), steps: stepPercents.length };
		}

		const expr = expressionOf(path, mode, tokenMap);
		if (expr?.type === 'alias') {
			path = expr.path;
		} else if (expr?.type === 'alpha') {
			stepPercents.push(resolveAmount(expr.amount, mode, tokenMap, new Set(visited), 'percent'));
			path = expr.tokenPath;
		} else {
			return null;
		}
	}
	return null;
}

/** Applies step percentages from the root outward, clamping at each step as applyAlpha does. */
function alphaFromRoot(stepPercentsOutermostFirst: number[]): number {
	return [...stepPercentsOutermostFirst].reverse().reduce(
		(alpha, percent) => Math.min(1, Math.max(0, alpha * percent / PERCENT_SCALE)),
		1
	);
}

/** The token's expression in this mode, or null when the token or the mode is missing. */
function expressionOf(tokenPath: string, mode: string, tokenMap: TokenMap): Expression | null {
	const token = tokenMap.get(tokenPath);
	if (!token) return null;

	const value = typeof token.$value === 'string' || typeof token.$value === 'number'
		? token.$value
		: token.$value[mode];
	return value === undefined ? null : parseExpression(value, token.$type);
}

/**
 * True when the token resolves to a fully opaque colour. Resolved the normal way, as a computed
 * value, so an alpha() token counts with its real, reduced alpha rather than the alpha of the
 * colour it points at.
 */
function isOpaque(tokenPath: string, mode: string, tokenMap: TokenMap, visited: Set<string>): boolean {
	const value = resolveToConcreteValue(tokenPath, mode, tokenMap, visited).value;
	if (typeof value === 'number') return false;
	const color = typeof value === 'object' ? value : hexToRgba(value);
	return color.a === 1;
}

/**
 * The amount token's path when a composed colour may reference it and still paint the same
 * colour: its own value, as the plugin writes it to Figma, must equal the percentage. A decimal
 * token such as 0.12 means 12 % to alpha() but 0.12 % to Figma, so it is not referenced.
 */
function referenceablePercentToken(
	amount: AmountValue,
	percent: number,
	mode: string,
	tokenMap: TokenMap,
	visited: Set<string>
): string | null {
	if (amount.kind !== 'reference') return null;

	const value = resolveToConcreteValue(amount.tokenPath, mode, tokenMap, visited).value;
	const figmaNumber = typeof value === 'number' ? value : parseFloat(String(value));
	return figmaNumber === percent ? amount.tokenPath : null;
}
