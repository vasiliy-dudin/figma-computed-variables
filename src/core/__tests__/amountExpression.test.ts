import { describe, it, expect } from 'vitest';
import { resolveToken } from '../resolver.ts';
import { createTokenMap } from '../tokenUtils.ts';
import type { ResolvedValue, TokenJSON } from '../types';

const MODE = 'light';

const BASE: TokenJSON = {
	color: {
		blue: { $type: 'color', $value: '#0066FF' },
	},
	amount: {
		percent: { $type: 'number', $value: '8%' },
		decimal: { $type: 'number', $value: 0.08 },
		scoped: { $type: 'number', $value: 8, $scope: 'COLOR_OPACITY' },
		degrees: { $type: 'number', $value: '30deg' },
		word: { $type: 'string', $value: 'abc' },
	},
};

function resolveColor(value: string): ResolvedValue {
	const json: TokenJSON = { ...BASE, test: { subject: { $type: 'color', $value: value } } };
	return resolveToken('test.subject', MODE, createTokenMap(json));
}

describe('colour function amounts written as expressions', () => {
	it.each(['percent', 'decimal', 'scoped'])('reads a %s amount token on the percent scale before the arithmetic', name => {
		expect(resolveColor(`alpha({color.blue}, {amount.${name}} * 2)`)).toEqual(resolveColor('alpha({color.blue}, 16%)'));
	});

	it('computes literals with units', () => {
		expect(resolveColor('alpha({color.blue}, 50% / 2)')).toEqual(resolveColor('alpha({color.blue}, 25%)'));
		expect(resolveColor('darken({color.blue}, 10% + 5%)')).toEqual(resolveColor('darken({color.blue}, 15%)'));
		expect(resolveColor('hueShift({color.blue}, 10deg * 3)')).toEqual(resolveColor('hueShift({color.blue}, 30deg)'));
	});

	it('reads a degrees amount token on the degrees scale', () => {
		expect(resolveColor('hueShift({color.blue}, {amount.degrees} * -1)')).toEqual(resolveColor('hueShift({color.blue}, -30deg)'));
		expect(resolveColor('hueShift({color.blue}, -{amount.degrees})')).toEqual(resolveColor('hueShift({color.blue}, -30deg)'));
	});

	it('supports Math functions', () => {
		expect(resolveColor('alpha({color.blue}, Math.min({amount.percent} * 10, 50%))')).toEqual(resolveColor('alpha({color.blue}, 50%)'));
	});

	it('clamps an out-of-range result the same way as a literal', () => {
		expect(resolveColor('alpha({color.blue}, 100% + 50%)')).toEqual(resolveColor('alpha({color.blue}, 150%)'));
		expect(resolveColor('darken({color.blue}, 0% - 20%)')).toEqual(resolveColor('darken({color.blue}, 0%)'));
	});

	it('names the token when a reference is not an amount', () => {
		expect(() => resolveColor('alpha({color.blue}, {amount.word} * 2)')).toThrow('{amount.word}');
	});

	it.each([
		['alpha({color.blue}, {amount.percent} % 2)', 'only marks a percentage'],
		['alpha({color.blue}, 30deg * 2)', 'Use % in this amount'],
		['hueShift({color.blue}, 30% * 2)', 'Use deg in this amount'],
		['alpha({color.blue}, {amount.percent} *)', 'Invalid amount expression'],
		['alpha({color.blue}, {amount.percent} / 0)', 'not a finite number'],
		['alpha({color.blue}, foo * 2)', 'Unknown name "foo"'],
	])('rejects %j', (value, message) => {
		expect(() => resolveColor(value)).toThrow(message);
	});
});
