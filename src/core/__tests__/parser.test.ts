import { describe, it, expect } from 'vitest';
import { parseExpression } from '../parser.ts';

describe('parseExpression — alias', () => {
	it('detects bare alias', () => {
		expect(parseExpression('{foundation.color.primary}', 'color')).toEqual({
			type: 'alias',
			path: 'foundation.color.primary',
		});
	});

	it('detects alias for number type', () => {
		expect(parseExpression('{foundation.spacing.base}', 'number')).toEqual({
			type: 'alias',
			path: 'foundation.spacing.base',
		});
	});
});

describe('parseExpression — alpha()', () => {
	it('parses alpha() with percentage', () => {
		expect(parseExpression('alpha({foundation.color.primary}, 15%)', 'color')).toEqual({
			type: 'alpha',
			tokenPath: 'foundation.color.primary',
			amount: { kind: 'literal', amount: 15 },
		});
	});

	it('parses alpha() with 100%', () => {
		const result = parseExpression('alpha({token}, 100%)', 'color');
		expect(result).toMatchObject({ type: 'alpha', amount: { kind: 'literal', amount: 100 } });
	});

	it('parses alpha() with 0%', () => {
		const result = parseExpression('alpha({token}, 0%)', 'color');
		expect(result).toMatchObject({ type: 'alpha', amount: { kind: 'literal', amount: 0 } });
	});

	it('throws on decimal (non-percent) alpha syntax', () => {
		expect(() => parseExpression('alpha({token}, 0.5)', 'color')).toThrow();
	});

	it('parses alpha() with a token-reference amount', () => {
		expect(parseExpression('alpha({foundation.color.primary}, {foundation.opacity.subtle})', 'color')).toEqual({
			type: 'alpha',
			tokenPath: 'foundation.color.primary',
			amount: { kind: 'reference', tokenPath: 'foundation.opacity.subtle' },
		});
	});
});

describe('parseExpression — color modifiers', () => {
	it('parses darken()', () => {
		expect(parseExpression('darken({foundation.color.primary}, 20%)', 'color')).toEqual({
			type: 'colorModify',
			fn: 'darken',
			tokenPath: 'foundation.color.primary',
			amount: { kind: 'literal', amount: 20 },
		});
	});

	it('parses lighten()', () => {
		expect(parseExpression('lighten({foundation.color.primary}, 10%)', 'color')).toEqual({
			type: 'colorModify',
			fn: 'lighten',
			tokenPath: 'foundation.color.primary',
			amount: { kind: 'literal', amount: 10 },
		});
	});

	it('parses saturate()', () => {
		expect(parseExpression('saturate({foundation.color.accent}, 30%)', 'color')).toEqual({
			type: 'colorModify',
			fn: 'saturate',
			tokenPath: 'foundation.color.accent',
			amount: { kind: 'literal', amount: 30 },
		});
	});

	it('parses desaturate()', () => {
		expect(parseExpression('desaturate({foundation.color.accent}, 25%)', 'color')).toEqual({
			type: 'colorModify',
			fn: 'desaturate',
			tokenPath: 'foundation.color.accent',
			amount: { kind: 'literal', amount: 25 },
		});
	});

	it('parses hueShift() with positive degrees', () => {
		expect(parseExpression('hueShift({foundation.color.accent}, 45deg)', 'color')).toEqual({
			type: 'colorModify',
			fn: 'hueShift',
			tokenPath: 'foundation.color.accent',
			amount: { kind: 'literal', amount: 45 },
		});
	});

	it('parses hueShift() with negative degrees', () => {
		expect(parseExpression('hueShift({foundation.color.accent}, -30deg)', 'color')).toEqual({
			type: 'colorModify',
			fn: 'hueShift',
			tokenPath: 'foundation.color.accent',
			amount: { kind: 'literal', amount: -30 },
		});
	});

	it('parses darken() with a token-reference amount', () => {
		expect(parseExpression('darken({foundation.color.primary}, {foundation.amount.subtle})', 'color')).toEqual({
			type: 'colorModify',
			fn: 'darken',
			tokenPath: 'foundation.color.primary',
			amount: { kind: 'reference', tokenPath: 'foundation.amount.subtle' },
		});
	});

	it('parses hueShift() with a token-reference amount', () => {
		expect(parseExpression('hueShift({foundation.color.accent}, {foundation.amount.shift})', 'color')).toEqual({
			type: 'colorModify',
			fn: 'hueShift',
			tokenPath: 'foundation.color.accent',
			amount: { kind: 'reference', tokenPath: 'foundation.amount.shift' },
		});
	});

	it('throws on wrong unit for color modifier', () => {
		expect(() => parseExpression('darken({token}, 20px)', 'color')).toThrow();
	});
});

describe('parseExpression — expression amounts', () => {
	const expressions = ['{a} * 2', '({a} + {b}) / 2', '50% / 2', '-{deg}', 'Math.min({a}, 50%)'];

	it.each(expressions)('parses alpha() with amount %j', expression => {
		expect(parseExpression(`alpha({base}, ${expression})`, 'color')).toEqual({
			type: 'alpha',
			tokenPath: 'base',
			amount: { kind: 'expression', expression },
		});
	});

	it.each(['darken', 'lighten', 'saturate', 'desaturate', 'hueShift'] as const)('parses %s() with an expression amount', fn => {
		expect(parseExpression(`${fn}({base}, {a} * 2)`, 'color')).toEqual({
			type: 'colorModify',
			fn,
			tokenPath: 'base',
			amount: { kind: 'expression', expression: '{a} * 2' },
		});
	});

	it('trims spaces around the expression', () => {
		expect(parseExpression('alpha({base},   {a} * 2  )', 'color')).toMatchObject({
			amount: { kind: 'expression', expression: '{a} * 2' },
		});
	});

	it('keeps a single literal or reference in its existing form', () => {
		expect(parseExpression('alpha({base}, 15%)', 'color')).toMatchObject({ amount: { kind: 'literal', amount: 15 } });
		expect(parseExpression('alpha({base}, {a})', 'color')).toMatchObject({ amount: { kind: 'reference', tokenPath: 'a' } });
		expect(parseExpression('hueShift({base}, -30deg)', 'color')).toMatchObject({ amount: { kind: 'literal', amount: -30 } });
	});

	it.each([
		'alpha({base}, 50)',
		'alpha({base}, -5%)',
		'alpha({base}, 50deg)',
		'darken({base}, 20deg)',
		'darken({base}, 20px)',
		'hueShift({base}, 30%)',
	])('still rejects a single number with a wrong or missing unit: %j', value => {
		expect(() => parseExpression(value, 'color')).toThrow();
	});
});

describe('parseExpression — math', () => {
	it('parses math expression with token reference', () => {
		expect(parseExpression('{foundation.spacing.base} * 2', 'number')).toEqual({
			type: 'math',
			expression: '{foundation.spacing.base} * 2',
		});
	});

	it('parses math expression with arithmetic only', () => {
		expect(parseExpression('8 + 4', 'number')).toEqual({
			type: 'math',
			expression: '8 + 4',
		});
	});

	it('reads a signed number with a unit as a literal, like an unsigned one', () => {
		expect(parseExpression('-30deg', 'number')).toEqual({ type: 'literal', value: -30 });
		expect(parseExpression('+30deg', 'number')).toEqual({ type: 'literal', value: 30 });
		expect(parseExpression('30deg', 'number')).toEqual({ type: 'literal', value: 30 });
		expect(parseExpression('-8%', 'number')).toEqual({ type: 'literal', value: '-8%' });
	});

	it('still reads a sign without a unit, or next to other terms, as math', () => {
		expect(parseExpression('-30', 'number')).toEqual({ type: 'math', expression: '-30' });
		expect(parseExpression('{a} - 30deg', 'number')).toEqual({ type: 'math', expression: '{a} - 30deg' });
	});
});

describe('parseExpression — string concat', () => {
	it('parses string concatenation with embedded token', () => {
		const result = parseExpression('Hello {tokens.name}!', 'string');
		expect(result.type).toBe('concat');
		if (result.type === 'concat') {
			expect(result.parts).toEqual([
				'Hello ',
				{ type: 'token', path: 'tokens.name' },
				'!',
			]);
		}
	});

	it('parses string with only a token reference as concat', () => {
		const result = parseExpression('{tokens.label}', 'string');
		// A plain token ref with no surrounding text is an alias, not concat
		expect(result.type).toBe('alias');
	});
});

describe('parseExpression — literals', () => {
	it('returns literal for plain hex color', () => {
		expect(parseExpression('#3478F6', 'color')).toEqual({
			type: 'literal',
			value: '#3478F6',
		});
	});

	it('returns literal for oklch color', () => {
		expect(parseExpression('oklch(0.65 0.2 250)', 'color')).toEqual({
			type: 'literal',
			value: 'oklch(0.65 0.2 250)',
		});
	});

	it('returns literal number from numeric input', () => {
		expect(parseExpression(16, 'number')).toEqual({
			type: 'literal',
			value: 16,
		});
	});

	it('returns literal number from plain string number', () => {
		expect(parseExpression('16', 'number')).toEqual({
			type: 'literal',
			value: 16,
		});
	});

	it('returns literal for plain string', () => {
		expect(parseExpression('hello world', 'string')).toEqual({
			type: 'literal',
			value: 'hello world',
		});
	});
});
