import { describe, it, expect } from 'vitest';
import { evaluateArithmetic } from '../arithmetic.ts';

// Test-only oracle: what number math returns today, through JS evaluation.
function evaluateWithJs(expression: string): number {
	return new Function('return (' + expression + ')')();
}

type Outcome = { value: number } | { error: true };

function outcomeOf(run: () => number): Outcome {
	try {
		return { value: run() };
	} catch {
		return { error: true };
	}
}

// Every expression here must give exactly what JS gives, including -0, NaN and errors.
const SAME_AS_JS = [
	'1', '0', '42', '.5', '5.', '1.5e3', '1E-3', '1.e2', '0.1 + 0.2', '1e21 * 2', '0x10', '0b101', '0o17',
	'1 + 2 * 3', '(1 + 2) * 3', '10 - 4 - 3', '100 / 10 / 5', '2 * 3 % 4', '7 % 3', '-7 % 3', '7.5 % 2',
	'2 ** 10', '2 ** 3 ** 2', '(2 ** 3) ** 2', '2 ** -1', '(-2) ** 2', '2 ** 0.5', '4 ** 0.5 * 3',
	'-5', '- -5', '+5', '-(3 + 4)', '8 - -4', '8 + -4', '3 * -4', '-0', '0 * -1', '1 / 0', '-1 / 0', '0 / 0',
	'10 / 4', '8 * 1.5', '((((1))))', ' 1 +\n2\t* 3 ',
	'Math.PI', 'Math.E * 2', 'Math.round(2.5)', 'Math.round(-2.5)', 'Math.floor(-1.5)', 'Math.ceil(1.2)',
	'Math.max(1, 5, 3)', 'Math.min(4, -2)', 'Math.max()', 'Math.max(1, 2,)', 'Math.abs(-7)', 'Math.pow(2, 10)',
	'Math.sqrt(2)', 'Math.floor(Math.sqrt(8) * 10) / 10', 'Math.round(8 * 1.3)', 'Math.trunc(-4.7)',
	'Math.sign(-3)', 'Math.hypot(3, 4)', 'Math.log2(8)', 'Math.cbrt(27)', 'Math.round(Math.PI * 100) / 100',
	// Errors in both.
	'', '   ', '1 +', '* 2', '(1 + 2', '1 + 2)', '()', '1 2', '8--4', '8++4', '-2 ** 2', '2 ** -2 ** 2',
	'1..5', '1e', '2px', '0b12', '8 // 2', 'foo', 'foo * 2', 'Math.PI()', 'Math.nope(1)',
];

describe('evaluateArithmetic matches JavaScript', () => {
	it.each(SAME_AS_JS)('%j', expression => {
		const expected = outcomeOf(() => evaluateWithJs(expression));
		const actual = outcomeOf(() => evaluateArithmetic(expression));
		if ('value' in expected && 'value' in actual) {
			expect(Object.is(actual.value, expected.value), `${actual.value} vs ${expected.value}`).toBe(true);
		} else {
			expect(actual).toEqual(expected);
		}
	});
});

describe('evaluateArithmetic references', () => {
	const references = new Map([['a', 8], ['b', 3], ['neg', -4], ['spacing.base', 16]]);

	it('reads a reference as its value', () => {
		expect(evaluateArithmetic('{a} + {b} * 2', references)).toBe(14);
		expect(evaluateArithmetic('{spacing.base} * 1.5', references)).toBe(24);
		expect(evaluateArithmetic('Math.max({a}, {b}, 20) - Math.min({a}, {b})', references)).toBe(17);
	});

	it('treats a negative reference as a value, not as pasted text', () => {
		expect(evaluateArithmetic('{a}-{neg}', references)).toBe(12);
		expect(evaluateArithmetic('{neg} ** 2', references)).toBe(16);
	});

	it('still rejects a sign written directly before the base of **', () => {
		expect(() => evaluateArithmetic('-{a} ** 2', references)).toThrow('parentheses');
	});

	it('throws when a reference has no value', () => {
		expect(() => evaluateArithmetic('{missing} * 2', references)).toThrow('{missing}');
	});
});

describe('evaluateArithmetic amount units', () => {
	it('drops the allowed unit after a number', () => {
		expect(evaluateArithmetic('50% / 2', new Map(), { amountUnit: '%' })).toBe(25);
		expect(evaluateArithmetic('-30deg * 2', new Map(), { amountUnit: 'deg' })).toBe(-60);
		expect(evaluateArithmetic('{a} + 10%', new Map([['a', 5]]), { amountUnit: '%' })).toBe(15);
	});

	it.each([
		['30deg', '%'],
		['30%', 'deg'],
		['{a} % 2', '%'],
		['50 %', '%'],
		['50%%', '%'],
		['30degx', 'deg'],
		['30 deg', 'deg'],
	] as const)('rejects %j with unit %s', (expression, amountUnit) => {
		expect(() => evaluateArithmetic(expression, new Map([['a', 1]]), { amountUnit })).toThrow();
	});

	it('keeps "%" as remainder and rejects units without the option', () => {
		expect(evaluateArithmetic('7 % 3')).toBe(1);
		expect(() => evaluateArithmetic('30deg')).toThrow();
	});
});

describe('evaluateArithmetic rejects non-arithmetic JavaScript', () => {
	it.each([
		'alert(1)', 'x.y', 'Math.constructor', 'Math.constructor("return 1")()', 'Math["round"](1)',
		'Math.round', 'Math', 'Math.toString()', 'figma.root', '{a} + figma.root.remove()', 'true + 1',
		'Number.EPSILON', 'parseInt("5")', '(1, 2)', '010', '1_000', '"1" + 1', '[1] * 2', '1 ? 2 : 3',
		'a = 1', 'globalThis', 'this',
	])('%j', expression => {
		expect(() => evaluateArithmetic(expression, new Map([['a', 1]]))).toThrow();
	});
});
