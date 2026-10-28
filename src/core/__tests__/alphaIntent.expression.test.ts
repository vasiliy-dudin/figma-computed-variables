import { describe, it, expect } from 'vitest';
import { resolveAlphaIntent } from '../alphaIntent.ts';
import { createTokenMap } from '../tokenUtils.ts';
import type { AlphaIntent, TokenJSON } from '../types';

const MODE = 'Light';

const json: TokenJSON = {
	color: {
		brand: { $type: 'color', $value: '#0066FF' },
		translucent: { $type: 'color', $value: '#0066FF80' },
		glass: { $type: 'color', $value: 'alpha({color.brand}, {opacity.quarter} * 2)' },
	},
	opacity: {
		hover: { $type: 'number', $value: '8%' },
		scoped: { $type: 'number', $value: 8, $scope: 'COLOR_OPACITY' },
		quarter: { $type: 'number', $value: '25%' },
	},
	test: {
		doubled: { $type: 'color', $value: 'alpha({color.brand}, {opacity.hover} * 2)' },
		doubledScoped: { $type: 'color', $value: 'alpha({color.brand}, {opacity.scoped} * 2)' },
		overTranslucent: { $type: 'color', $value: 'alpha({color.translucent}, {opacity.hover} * 2)' },
		onGlass: { $type: 'color', $value: 'alpha({color.glass}, 50%)' },
		expressionOverGlass: { $type: 'color', $value: 'alpha({color.glass}, 25% * 2)' },
	},
};

function intent(path: string): AlphaIntent | null {
	return resolveAlphaIntent(path, MODE, createTokenMap(json));
}

describe('resolveAlphaIntent — expression amounts', () => {
	it('writes a computed percentage over an opaque base as a composed colour without an opacity link', () => {
		expect(intent('test.doubled')).toEqual({ targetPath: 'color.brand', percent: 16, opacityTokenPath: null, eligible: true });
	});

	// The amount token holds 8, but the opacity is 16: linking the token would paint the wrong colour.
	it('does not link a COLOR_OPACITY amount token once it is multiplied', () => {
		expect(intent('test.doubledScoped')).toEqual({ targetPath: 'color.brand', percent: 16, opacityTokenPath: null, eligible: true });
	});

	it('is not eligible over a translucent base', () => {
		expect(intent('test.overTranslucent')).toEqual({
			targetPath: 'color.translucent', percent: 16, opacityTokenPath: null, eligible: false,
		});
	});

	it('multiplies an expression step inside an alpha() chain', () => {
		expect(intent('test.onGlass')).toEqual({ targetPath: 'color.brand', percent: 25, opacityTokenPath: null, eligible: true });
	});

	it('multiplies an expression amount on top of an alpha() chain', () => {
		expect(intent('test.expressionOverGlass')).toEqual({ targetPath: 'color.brand', percent: 25, opacityTokenPath: null, eligible: true });
	});
});
