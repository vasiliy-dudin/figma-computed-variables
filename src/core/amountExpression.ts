import { arithmeticSyntaxError, evaluateArithmetic } from './arithmetic';
import { AmountUnit } from './arithmeticTokens';
import { PATTERNS } from './constants';

export type AmountScale = 'percent' | 'degrees';

const UNIT_BY_SCALE: Record<AmountScale, AmountUnit> = {
	percent: '%',
	degrees: 'deg',
};

/**
 * Evaluates a colour function amount written as arithmetic, e.g. {hover-opacity} * 2, and
 * returns it on the function's scale (raw percent or degrees), unclamped. Each reference is
 * converted to that scale by `resolveReference` before the arithmetic runs.
 */
export function evaluateAmountExpression(
	expression: string,
	scale: AmountScale,
	resolveReference: (tokenPath: string) => number
): number {
	// References first, so their errors (which name the token) take precedence over syntax errors
	const referenceValues = new Map<string, number>();
	for (const match of expression.matchAll(PATTERNS.tokenReference)) {
		const tokenPath = match[1];
		if (!referenceValues.has(tokenPath)) {
			referenceValues.set(tokenPath, resolveReference(tokenPath));
		}
	}

	let result: number;
	try {
		result = evaluateArithmetic(expression, referenceValues, { amountUnit: UNIT_BY_SCALE[scale] });
	} catch (err) {
		throw new Error(`Invalid amount expression "${expression}": ${err instanceof Error ? err.message : String(err)}`);
	}
	if (!isFinite(result)) {
		throw new Error(`Invalid amount expression "${expression}": the result is not a finite number.`);
	}
	return result;
}

/** The syntax error of an amount expression on this scale, or null when it parses. */
export function amountSyntaxError(expression: string, scale: AmountScale): string | null {
	return arithmeticSyntaxError(expression, { amountUnit: UNIT_BY_SCALE[scale] });
}
