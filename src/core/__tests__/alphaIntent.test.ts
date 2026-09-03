import { describe, it, expect } from 'vitest';
import { resolveAlphaIntent } from '../resolver.ts';
import { createTokenMap } from '../tokenUtils.ts';
import type { TokenJSON } from '../types';

const MODE = 'Light';

const json: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: '#3478F6' },
			translucent: { $type: 'color', $value: '#3478F680' },
		},
		opacity: {
			subtle: { $type: 'number', $value: 0.12 },
			asPercent: { $type: 'number', $value: '15%' },
		},
	},
	semantic: {
		literalAmount: { $type: 'color', $value: 'alpha({foundation.color.primary}, 50%)' },
		referencedAmount: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.subtle})' },
		percentTokenAmount: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.asPercent})' },
		fractionalAmount: { $type: 'color', $value: 'alpha({foundation.color.primary}, 12.5%)' },
		overHundred: { $type: 'color', $value: 'alpha({foundation.color.primary}, 150%)' },
		bareAlias: { $type: 'color', $value: '{foundation.color.primary}' },
		flatColor: { $type: 'color', $value: '#FF0000' },
		darkened: { $type: 'color', $value: 'darken({foundation.color.primary}, 20%)' },
		perMode: {
			$type: 'color',
			$value: { Light: 'alpha({foundation.color.primary}, 40%)', Dark: '#101010' },
		},
		danglingAmount: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.missing})' },
	},
};

const tokenMap = createTokenMap(json);

function intent(path: string, mode: string = MODE) {
	return resolveAlphaIntent(path, mode, tokenMap);
}

describe('resolveAlphaIntent', () => {
	it('reports a literal percentage amount', () => {
		expect(intent('semantic.literalAmount')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 50,
		});
	});

	it('resolves an amount that references a decimal token', () => {
		expect(intent('semantic.referencedAmount')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 12,
		});
	});

	it('resolves an amount that references a percentage-suffixed token', () => {
		expect(intent('semantic.percentTokenAmount')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 15,
		});
	});

	it('preserves a fractional percentage', () => {
		expect(intent('semantic.fractionalAmount')?.percent).toBe(12.5);
	});

	it('returns an out-of-range percentage unclamped', () => {
		expect(intent('semantic.overHundred')?.percent).toBe(150);
	});

	it('returns null for a bare alias', () => {
		expect(intent('semantic.bareAlias')).toBeNull();
	});

	it('returns null for a flat color', () => {
		expect(intent('semantic.flatColor')).toBeNull();
	});

	it('returns null for a different color modifier', () => {
		expect(intent('semantic.darkened')).toBeNull();
	});

	it('reports intent per mode, not per token', () => {
		expect(intent('semantic.perMode', 'Light')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 40,
		});
		expect(intent('semantic.perMode', 'Dark')).toBeNull();
	});

	it('returns null for an unknown token', () => {
		expect(intent('semantic.doesNotExist')).toBeNull();
	});

	it('returns null for a mode the token does not define', () => {
		expect(intent('semantic.perMode', 'Contrast')).toBeNull();
	});

	it('returns null when the amount reference cannot be resolved', () => {
		expect(intent('semantic.danglingAmount')).toBeNull();
	});
});
