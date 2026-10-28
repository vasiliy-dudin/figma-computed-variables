import { describe, it, expect } from 'vitest';
import { validate } from '../validator.ts';
import type { TokenJSON, ValidationError } from '../types';

const MODE = 'Light';

function errorsFor(value: string): ValidationError[] {
	const json: TokenJSON = {
		base: {
			blue: { $type: 'color', $value: '#0066FF' },
			hover: { $type: 'number', $value: '8%' },
			degrees: { $type: 'number', $value: '30deg' },
			gap: { $type: 'number', $value: 8 },
		},
		test: {
			subject: { $type: 'color', $value: { [MODE]: value } },
		},
	};
	const result = validate(json);
	return result.valid ? [] : result.errors;
}

describe('validate — expression amounts', () => {
	it.each([
		'alpha({base.blue}, {base.hover} * 2)',
		'alpha({base.blue}, ({base.hover} + 2%) / 2)',
		'alpha({base.blue}, Math.min({base.hover} * 10, 50%))',
		'darken({base.blue}, 10% + 5%)',
		'lighten({base.blue}, {base.hover} * 2)',
		'saturate({base.blue}, {base.hover} * 2)',
		'desaturate({base.blue}, {base.hover} * 2)',
		'hueShift({base.blue}, {base.degrees} * -1)',
		'hueShift({base.blue}, -{base.degrees})',
	])('accepts %j', value => {
		expect(errorsFor(value)).toEqual([]);
	});

	it.each([
		['alpha({base.blue}, {base.hover} *)', 'ends too early'],
		['alpha({base.blue}, {base.hover} % 2)', 'only marks a percentage'],
		['alpha({base.blue}, 30deg * 2)', 'Use % in this amount'],
		['hueShift({base.blue}, 30% * 2)', 'Use deg in this amount'],
		['darken({base.blue}, foo * 2)', 'Unknown name "foo"'],
		['alpha({base.blue}, {base.blue} * 2)', 'must be a number or percentage token, not a color token'],
		['alpha({base.gap}, {base.hover} * 2)', 'can reference only color tokens'],
	])('reports %j', (value, message) => {
		const errors = errorsFor(value);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ collection: 'test', token: 'subject', mode: MODE, errorType: 'syntax' });
		expect(errors[0].message).toContain(message);
	});

	it('names the function and the amount in a syntax error', () => {
		expect(errorsFor('alpha({base.blue}, {base.hover} *)')[0].message).toMatch(/^alpha\(\) amount "\{base\.hover\} \*" is invalid: /);
	});

	it.each([
		'alpha({base.blue}, 50)',
		'alpha({base.blue}, -5%)',
		'darken({base.blue}, 20deg)',
		'hueShift({base.blue}, 30%)',
	])('still reports a single number with a wrong or missing unit: %j', value => {
		const errors = errorsFor(value);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('or an expression');
	});

	it('reports a missing token inside the amount as a reference error', () => {
		expect(errorsFor('alpha({base.blue}, {base.missing} * 2)')).toEqual([
			expect.objectContaining({ errorType: 'reference', message: 'Reference "{base.missing}" does not exist' }),
		]);
	});
});
