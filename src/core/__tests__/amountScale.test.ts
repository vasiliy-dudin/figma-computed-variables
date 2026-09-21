import { describe, it, expect } from 'vitest';
import { resolveToken, resolveAlphaIntent } from '../resolver.ts';
import { createTokenMap } from '../tokenUtils.ts';
import type { TokenJSON, RGBA } from '../types';

const MODE = 'Light';

// Figma's opacity variables for composed colours hold a percentage (60 = 60 %) and carry the
// COLOR_OPACITY scope; everywhere else the plugin reads a bare number as a fraction (0.6 = 60 %).
const json: TokenJSON = {
	foundation: {
		color: { primary: { $type: 'color', $value: '#0000FF' } },
		opacity: {
			figmaPercent: { $type: 'number', $value: 60, $scope: 'COLOR_OPACITY' },
			figmaPercentInList: { $type: 'number', $value: 60, $scope: ['COLOR_OPACITY', 'OPACITY'] },
			fraction: { $type: 'number', $value: 0.6 },
			fractionOtherScope: { $type: 'number', $value: 0.6, $scope: 'OPACITY' },
			unscopedLarge: { $type: 'number', $value: 60 },
			aliasOfFigmaPercent: { $type: 'number', $value: '{foundation.opacity.figmaPercent}' },
			suffixed: { $type: 'number', $value: '15%', $scope: 'COLOR_OPACITY' },
			darkenAmount: { $type: 'number', $value: 20, $scope: 'COLOR_OPACITY' },
		},
	},
	semantic: {
		figmaPercent: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.figmaPercent})' },
		figmaPercentInList: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.figmaPercentInList})' },
		fraction: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.fraction})' },
		fractionOtherScope: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.fractionOtherScope})' },
		unscopedLarge: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.unscopedLarge})' },
		aliasOfFigmaPercent: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.aliasOfFigmaPercent})' },
		suffixed: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.suffixed})' },
		darkenedByScoped: { $type: 'color', $value: 'darken({foundation.color.primary}, {foundation.opacity.darkenAmount})' },
		darkenedByLiteral: { $type: 'color', $value: 'darken({foundation.color.primary}, 20%)' },
	},
};

const tokenMap = createTokenMap(json);

function alphaOf(path: string): number {
	const resolved = resolveToken(path, MODE, tokenMap);
	if (resolved.isAlias) throw new Error('expected a computed colour');
	return (resolved.value as RGBA).a;
}

describe('amount scale — COLOR_OPACITY tokens are percentages', () => {
	it('reads 60 in a COLOR_OPACITY token as 60 %', () => {
		expect(alphaOf('semantic.figmaPercent')).toBeCloseTo(0.6);
		expect(resolveAlphaIntent('semantic.figmaPercent', MODE, tokenMap)?.percent).toBe(60);
	});

	it('recognises the scope inside a list of scopes', () => {
		expect(alphaOf('semantic.figmaPercentInList')).toBeCloseTo(0.6);
	});

	it('keeps an explicit % suffix unchanged', () => {
		expect(alphaOf('semantic.suffixed')).toBeCloseTo(0.15);
	});

	it('applies to colour-modifier amounts too', () => {
		const scoped = resolveToken('semantic.darkenedByScoped', MODE, tokenMap);
		const literal = resolveToken('semantic.darkenedByLiteral', MODE, tokenMap);
		expect(scoped).toEqual(literal);
	});
});

describe('amount scale — every other token keeps today\'s rule', () => {
	it('reads 0.6 without a scope as 60 %', () => {
		expect(alphaOf('semantic.fraction')).toBeCloseTo(0.6);
	});

	it('reads 0.6 with an unrelated scope as 60 %', () => {
		expect(alphaOf('semantic.fractionOtherScope')).toBeCloseTo(0.6);
	});

	it('reads 60 without the scope as 6000 %, clamped to opaque — unchanged from before', () => {
		expect(alphaOf('semantic.unscopedLarge')).toBe(1);
	});

	it('checks the token named in the expression, not the end of its alias chain', () => {
		// The alias itself has no scope, so its 60 is read the old way.
		expect(alphaOf('semantic.aliasOfFigmaPercent')).toBe(1);
	});
});
