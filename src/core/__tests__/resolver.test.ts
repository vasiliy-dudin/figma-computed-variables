import { describe, it, expect } from 'vitest';
import { converter } from 'culori';
import { resolveToken, hexToRgba, rgbaToHex } from '../resolver.ts';
import { createTokenMap } from '../tokenUtils.ts';
import { CircularDependencyError } from '../validator.ts';
import type { TokenJSON, RGBA } from '../types';

const toOklch = converter('oklch');

/** Converts an RGBA to OKLch for directional assertions on color modifiers */
function rgbaToOklch(rgba: RGBA) {
	return toOklch({ mode: 'rgb' as const, r: rgba.r, g: rgba.g, b: rgba.b, alpha: rgba.a });
}

// --- Fixtures ---

const BASE_HEX = '#3478F6';
const BASE_OKLCH = 'oklch(0.65 0.2 250)';
const GRAY_HEX = '#888888';

function makeMap(json: TokenJSON) {
	return createTokenMap(json);
}

const singleColorJson: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: BASE_HEX },
			accent: { $type: 'color', $value: BASE_OKLCH },
			gray: { $type: 'color', $value: GRAY_HEX },
		},
		spacing: {
			base: { $type: 'number', $value: 4 },
		},
	},
	components: {
		label: { $type: 'string', $value: 'World' },
	},
};

// ---

describe('hexToRgba / rgbaToHex', () => {
	it('converts hex to RGBA with correct channels', () => {
		const rgba = hexToRgba(BASE_HEX);
		expect(rgba.r).toBeCloseTo(0x34 / 255, 5);
		expect(rgba.g).toBeCloseTo(0x78 / 255, 5);
		expect(rgba.b).toBeCloseTo(0xf6 / 255, 5);
		expect(rgba.a).toBe(1);
	});

	it('round-trips hex → RGBA → hex', () => {
		const rgba = hexToRgba(BASE_HEX);
		expect(rgbaToHex(rgba).toLowerCase()).toBe(BASE_HEX.toLowerCase());
	});

	it('converts oklch color string to RGBA', () => {
		const rgba = hexToRgba(BASE_OKLCH);
		expect(rgba.a).toBe(1);
		expect(rgba.r).toBeGreaterThanOrEqual(0);
		expect(rgba.r).toBeLessThanOrEqual(1);
	});
});

describe('resolveToken — literals and aliases', () => {
	it('resolves a literal color token', () => {
		const map = makeMap(singleColorJson);
		const result = resolveToken('foundation.color.primary', 'light', map);
		expect(result).toEqual({ isAlias: false, value: BASE_HEX });
	});

	it('resolves a literal number token', () => {
		const map = makeMap(singleColorJson);
		const result = resolveToken('foundation.spacing.base', 'light', map);
		expect(result).toEqual({ isAlias: false, value: 4 });
	});

	it('resolves a bare alias', () => {
		const json: TokenJSON = {
			foundation: { color: { primary: { $type: 'color', $value: BASE_HEX } } },
			semantic: { button: { background: { $type: 'color', $value: '{foundation.color.primary}' } } },
		};
		const result = resolveToken('semantic.button.background', 'light', makeMap(json));
		expect(result).toEqual({ isAlias: true, targetPath: 'foundation.color.primary' });
	});
});

describe('resolveToken — alpha()', () => {
	it('applies alpha to a hex color', () => {
		const json: TokenJSON = {
			...singleColorJson,
			computed: {
				overlay: { $type: 'color', $value: `alpha({foundation.color.primary}, 30%)` },
			},
		};
		const result = resolveToken('computed.overlay', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const rgba = result.value as RGBA;
			expect(rgba.r).toBeCloseTo(0x34 / 255, 5);
			expect(rgba.g).toBeCloseTo(0x78 / 255, 5);
			expect(rgba.b).toBeCloseTo(0xf6 / 255, 5);
			expect(rgba.a).toBeCloseTo(0.30, 5);
		}
	});

	it('applies alpha 100% — fully opaque', () => {
		const json: TokenJSON = {
			...singleColorJson,
			computed: { full: { $type: 'color', $value: `alpha({foundation.color.primary}, 100%)` } },
		};
		const result = resolveToken('computed.full', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			expect((result.value as RGBA).a).toBeCloseTo(1, 5);
		}
	});

	it('applies alpha 0% — fully transparent', () => {
		const json: TokenJSON = {
			...singleColorJson,
			computed: { empty: { $type: 'color', $value: `alpha({foundation.color.primary}, 0%)` } },
		};
		const result = resolveToken('computed.empty', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			expect((result.value as RGBA).a).toBeCloseTo(0, 5);
		}
	});
});

describe('resolveToken — darken() / lighten()', () => {
	it('darken makes the color darker (lower OKLch lightness)', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_HEX))!;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { dark: { $type: 'color', $value: `darken({foundation.color.primary}, 20%)` } },
		};
		const result = resolveToken('computed.dark', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			expect(resultOklch.l).toBeLessThan(originalOklch.l!);
		}
	});

	it('lighten makes the color lighter (higher OKLch lightness)', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_HEX))!;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { light: { $type: 'color', $value: `lighten({foundation.color.primary}, 15%)` } },
		};
		const result = resolveToken('computed.light', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			expect(resultOklch.l).toBeGreaterThan(originalOklch.l!);
		}
	});

	it('darken by 0% returns the same lightness', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_HEX))!;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { same: { $type: 'color', $value: `darken({foundation.color.primary}, 0%)` } },
		};
		const result = resolveToken('computed.same', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			expect(resultOklch.l).toBeCloseTo(originalOklch.l!, 4);
		}
	});
});

describe('resolveToken — saturate() / desaturate()', () => {
	it('saturate increases OKLch chroma', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_OKLCH))!;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { sat: { $type: 'color', $value: `saturate({foundation.color.accent}, 20%)` } },
		};
		const result = resolveToken('computed.sat', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			expect(resultOklch.c).toBeGreaterThan(originalOklch.c!);
		}
	});

	it('desaturate decreases OKLch chroma', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_OKLCH))!;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { desat: { $type: 'color', $value: `desaturate({foundation.color.accent}, 25%)` } },
		};
		const result = resolveToken('computed.desat', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			expect(resultOklch.c).toBeLessThan(originalOklch.c!);
		}
	});
});

describe('resolveToken — hueShift()', () => {
	it('shifts hue by positive degrees', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_OKLCH))!;
		const shiftDeg = 45;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { shifted: { $type: 'color', $value: `hueShift({foundation.color.accent}, ${shiftDeg}deg)` } },
		};
		const result = resolveToken('computed.shifted', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			const expectedHue = ((originalOklch.h! + shiftDeg) % 360 + 360) % 360;
			expect(resultOklch.h).toBeCloseTo(expectedHue, 1);
		}
	});

	it('shifts hue by negative degrees', () => {
		const originalOklch = rgbaToOklch(hexToRgba(BASE_OKLCH))!;
		const shiftDeg = -30;

		const json: TokenJSON = {
			...singleColorJson,
			computed: { negShifted: { $type: 'color', $value: `hueShift({foundation.color.accent}, ${shiftDeg}deg)` } },
		};
		const result = resolveToken('computed.negShifted', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const resultOklch = rgbaToOklch(result.value as RGBA)!;
			const expectedHue = ((originalOklch.h! + shiftDeg) % 360 + 360) % 360;
			// OKLch → sRGB → OKLch round-trip can introduce hue error (~10-15°) when
			// the shifted color is near the sRGB gamut boundary. Allow 20° tolerance.
			const diff = Math.min(
				Math.abs(resultOklch.h! - expectedHue),
				360 - Math.abs(resultOklch.h! - expectedHue),
			);
			expect(diff).toBeLessThan(20);
		}
	});

	it('leaves achromatic (gray) color unchanged on hueShift', () => {
		const originalRgba = hexToRgba(GRAY_HEX);

		const json: TokenJSON = {
			...singleColorJson,
			computed: { grayShifted: { $type: 'color', $value: `hueShift({foundation.color.gray}, 90deg)` } },
		};
		const result = resolveToken('computed.grayShifted', 'light', makeMap(json));
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			const rgba = result.value as RGBA;
			expect(rgba.r).toBeCloseTo(originalRgba.r, 4);
			expect(rgba.g).toBeCloseTo(originalRgba.g, 4);
			expect(rgba.b).toBeCloseTo(originalRgba.b, 4);
		}
	});
});

describe('resolveToken — math expressions', () => {
	it('resolves token reference multiplication', () => {
		const json: TokenJSON = {
			...singleColorJson,
			computed: { padding: { $type: 'number', $value: '{foundation.spacing.base} * 2' } },
		};
		const result = resolveToken('computed.padding', 'light', makeMap(json));
		expect(result).toEqual({ isAlias: false, value: 8 });
	});

	it('resolves multi-operator math', () => {
		const json: TokenJSON = {
			...singleColorJson,
			computed: { calc: { $type: 'number', $value: '{foundation.spacing.base} * 3 + 2' } },
		};
		const result = resolveToken('computed.calc', 'light', makeMap(json));
		expect(result).toEqual({ isAlias: false, value: 14 });
	});
});

describe('resolveToken — string concatenation', () => {
	it('resolves concat with surrounding text', () => {
		const json: TokenJSON = {
			...singleColorJson,
			computed: { greeting: { $type: 'string', $value: 'Hello {components.label}!' } },
		};
		const result = resolveToken('computed.greeting', 'light', makeMap(json));
		expect(result).toEqual({ isAlias: false, value: 'Hello World!' });
	});
});

describe('resolveToken — multi-mode', () => {
	it('resolves per-mode value for the given mode', () => {
		const json: TokenJSON = {
			foundation: {
				color: { primary: { $type: 'color', $value: { light: '#0055CC', dark: '#80AFFF' } } },
			},
		};
		const map = makeMap(json);
		const light = resolveToken('foundation.color.primary', 'light', map);
		const dark = resolveToken('foundation.color.primary', 'dark', map);
		expect(light).toEqual({ isAlias: false, value: '#0055CC' });
		expect(dark).toEqual({ isAlias: false, value: '#80AFFF' });
	});
});

describe('resolveToken — error cases', () => {
	it('throws on missing token', () => {
		const map = makeMap(singleColorJson);
		expect(() => resolveToken('foundation.color.nonexistent', 'light', map)).toThrow('Token not found');
	});

	it('throws on missing mode', () => {
		const json: TokenJSON = {
			foundation: { color: { primary: { $type: 'color', $value: { light: '#fff', dark: '#000' } } } },
		};
		const map = makeMap(json);
		expect(() => resolveToken('foundation.color.primary', 'mobile', map)).toThrow('Mode "mobile" not found');
	});

	it('throws CircularDependencyError on circular reference', () => {
		const json: TokenJSON = {
			tokens: {
				a: { $type: 'color', $value: 'alpha({tokens.b}, 50%)' },
				b: { $type: 'color', $value: 'alpha({tokens.a}, 50%)' },
			},
		};
		const map = makeMap(json);
		expect(() => resolveToken('tokens.a', 'light', map)).toThrow(CircularDependencyError);
	});
});
