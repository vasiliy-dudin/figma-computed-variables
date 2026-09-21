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
			oklchOpaque: { $type: 'color', $value: 'oklch(0.65 0.2 250)' },
			aliasOfPrimary: { $type: 'color', $value: '{foundation.color.primary}' },
			opaqueInLightOnly: { $type: 'color', $value: { Light: '#FF0000', Dark: '#FF000080' } },
		},
		opacity: {
			subtle: { $type: 'number', $value: 0.12 },
			asPercent: { $type: 'number', $value: '15%' },
			figmaPercent: { $type: 'number', $value: 60, $scope: 'COLOR_OPACITY' },
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
		figmaPercentAmount: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.opacity.figmaPercent})' },
		onTranslucent: { $type: 'color', $value: 'alpha({foundation.color.translucent}, 50%)' },
		onOklch: { $type: 'color', $value: 'alpha({foundation.color.oklchOpaque}, 50%)' },
		onAliasOfOpaque: { $type: 'color', $value: 'alpha({foundation.color.aliasOfPrimary}, 50%)' },
		onAlpha: { $type: 'color', $value: 'alpha({semantic.literalAmount}, 50%)' },
		aliasOfAlpha: { $type: 'color', $value: '{semantic.literalAmount}' },
		onAliasOfAlpha: { $type: 'color', $value: 'alpha({semantic.aliasOfAlpha}, 50%)' },
		onModeDependentBase: { $type: 'color', $value: 'alpha({foundation.color.opaqueInLightOnly}, 50%)' },
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
			opacityTokenPath: null,
			eligible: true,
		});
	});

	// 0.12 means 12 % to alpha() but 0.12 % to Figma, so the token must not be referenced.
	it('resolves a decimal amount token but does not reference it', () => {
		expect(intent('semantic.referencedAmount')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 12,
			opacityTokenPath: null,
			eligible: true,
		});
	});

	// Written to Figma as 15, which Figma reads as 15 % — the same colour.
	it('references a percentage-suffixed amount token', () => {
		expect(intent('semantic.percentTokenAmount')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 15,
			opacityTokenPath: 'foundation.opacity.asPercent',
			eligible: true,
		});
	});

	it('references a COLOR_OPACITY amount token', () => {
		expect(intent('semantic.figmaPercentAmount')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 60,
			opacityTokenPath: 'foundation.opacity.figmaPercent',
			eligible: true,
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
			opacityTokenPath: null,
			eligible: true,
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

// Figma replaces the base's alpha; alpha() multiplies it. They agree only on an opaque base.
describe('resolveAlphaIntent — eligibility for a native composed colour', () => {
	it('accepts an opaque hex base', () => {
		expect(intent('semantic.literalAmount')?.eligible).toBe(true);
	});

	it('accepts an opaque oklch base', () => {
		expect(intent('semantic.onOklch')?.eligible).toBe(true);
	});

	it('accepts a base that is an alias of an opaque colour', () => {
		expect(intent('semantic.onAliasOfOpaque')?.eligible).toBe(true);
	});

	it('rejects a translucent base', () => {
		expect(intent('semantic.onTranslucent')?.eligible).toBe(false);
	});

	it('rejects alpha over an alpha token', () => {
		expect(intent('semantic.onAlpha')?.eligible).toBe(false);
	});

	it('rejects alpha over an alias of an alpha token', () => {
		expect(intent('semantic.onAliasOfAlpha')?.eligible).toBe(false);
	});

	it('decides per mode', () => {
		expect(intent('semantic.onModeDependentBase', 'Light')?.eligible).toBe(true);
		expect(intent('semantic.onModeDependentBase', 'Dark')?.eligible).toBe(false);
	});
});
