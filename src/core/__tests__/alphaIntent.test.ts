import { describe, it, expect } from 'vitest';
import { resolveAlphaIntent } from '../alphaIntent.ts';
import { resolveToken } from '../resolver.ts';
import { createTokenMap } from '../tokenUtils.ts';
import type { TokenJSON, RGBA } from '../types';

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
		threeLevels: { $type: 'color', $value: 'alpha({semantic.onAlpha}, 50%)' },
		onOverHundred: { $type: 'color', $value: 'alpha({semantic.overHundred}, 50%)' },
		mid40: { $type: 'color', $value: 'alpha({foundation.color.primary}, 40%)' },
		mid150: { $type: 'color', $value: 'alpha({semantic.mid40}, 150%)' },
		onMid150: { $type: 'color', $value: 'alpha({semantic.mid150}, 50%)' },
		onTranslucentChain: { $type: 'color', $value: 'alpha({semantic.onTranslucent}, 50%)' },
		chainWithOpacityToken: { $type: 'color', $value: 'alpha({semantic.literalAmount}, {foundation.opacity.figmaPercent})' },
		onPerMode: { $type: 'color', $value: 'alpha({semantic.perMode}, 50%)' },
		cycleA: { $type: 'color', $value: 'alpha({semantic.cycleB}, 50%)' },
		cycleB: { $type: 'color', $value: 'alpha({semantic.cycleA}, 50%)' },
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


	it('decides per mode', () => {
		expect(intent('semantic.onModeDependentBase', 'Light')?.eligible).toBe(true);
		expect(intent('semantic.onModeDependentBase', 'Dark')?.eligible).toBe(false);
	});
});

// Figma replaces a base's alpha, so a base that is itself an alpha() token is walked down to its
// opaque root and the percentages multiplied: alpha(alpha(X, p1), p2) equals alpha(X, p1·p2).
describe('resolveAlphaIntent — walking an alpha() chain to its opaque root', () => {
	/** Alpha the computed path gives this token, as a percentage. */
	function computedPercent(path: string, mode: string = MODE): number {
		const resolved = resolveToken(path, mode, tokenMap);
		if (resolved.isAlias) throw new Error('expected a computed colour');
		return (resolved.value as RGBA).a * 100;
	}

	it('references the root with the multiplied percentage', () => {
		expect(intent('semantic.onAlpha')).toEqual({
			targetPath: 'foundation.color.primary',
			percent: 25,
			opacityTokenPath: null,
			eligible: true,
		});
	});

	it('walks through an alias to an alpha() token', () => {
		expect(intent('semantic.onAliasOfAlpha')).toMatchObject({ targetPath: 'foundation.color.primary', percent: 25, eligible: true });
	});

	it('walks three levels', () => {
		expect(intent('semantic.threeLevels')).toMatchObject({ targetPath: 'foundation.color.primary', percent: 12.5, eligible: true });
	});

	// alpha(primary, 150%) clamps to fully opaque, so the walk stops there and references it.
	it('stops at the first opaque token in the chain', () => {
		expect(intent('semantic.onOverHundred')).toMatchObject({ targetPath: 'semantic.overHundred', percent: 50, eligible: true });
	});

	// 40 % then 150 % is 60 %, still translucent, so the walk continues to the root.
	it('handles a step above 100 % over a translucent colour', () => {
		expect(intent('semantic.onMid150')).toMatchObject({ targetPath: 'foundation.color.primary', eligible: true });
		expect(intent('semantic.onMid150')?.percent).toBeCloseTo(30, 9);
	});

	it.each(['semantic.onAlpha', 'semantic.onAliasOfAlpha', 'semantic.threeLevels', 'semantic.onOverHundred', 'semantic.onMid150', 'semantic.chainWithOpacityToken'])(
		'paints exactly what alpha() computes: %s',
		(path) => {
			expect(intent(path)?.percent).toBeCloseTo(computedPercent(path), 9);
		}
	);

	it('writes the opacity as a number once percentages are multiplied', () => {
		expect(intent('semantic.chainWithOpacityToken')).toMatchObject({
			targetPath: 'foundation.color.primary',
			percent: 30,
			opacityTokenPath: null,
			eligible: true,
		});
	});

	it('walks per mode', () => {
		expect(intent('semantic.onPerMode', 'Light')).toMatchObject({ targetPath: 'foundation.color.primary', percent: 20, eligible: true });
		// In Dark the base is an opaque literal, so it is referenced directly.
		expect(intent('semantic.onPerMode', 'Dark')).toMatchObject({ targetPath: 'semantic.perMode', percent: 50, eligible: true });
	});

	it('is not eligible when the chain ends at a translucent literal', () => {
		expect(intent('semantic.onTranslucentChain')).toMatchObject({ targetPath: 'semantic.onTranslucent', percent: 50, eligible: false });
	});

	it('terminates on a cycle', () => {
		expect(intent('semantic.cycleA')).toBeNull();
	});
});
