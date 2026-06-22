import { describe, it, expect, beforeAll } from 'vitest';
import { validate } from '../validator.ts';
import { createTokenMap } from '../tokenUtils.ts';
import { resolveToken } from '../resolver.ts';
import type { TokenJSON, TokenMap, RGBA } from '../types';

// --- Helper ---

function assertResolvedShape(tokenPath: string, mode: string, map: TokenMap): void {
	const result = resolveToken(tokenPath, mode, map);
	if (result.isAlias) {
		expect(result.targetPath).toBeTruthy();
		return;
	}
	const { value } = result;
	if (typeof value === 'object' && value !== null) {
		const rgba = value as RGBA;
		for (const ch of ['r', 'g', 'b', 'a'] as const) {
			expect(rgba[ch], `${mode} :: ${tokenPath}: RGBA.${ch} out of [0,1]`).toBeGreaterThanOrEqual(0);
			expect(rgba[ch], `${mode} :: ${tokenPath}: RGBA.${ch} out of [0,1]`).toBeLessThanOrEqual(1);
		}
	} else {
		expect(['string', 'number']).toContain(typeof value);
	}
}

// --- Fixtures ---

const singleModeSample: TokenJSON = {
	foundation: {
		colors: {
			primary: { $type: 'color', $value: '#3478F6' },
			accent: { $type: 'color', $value: 'oklch(0.73 0.12 240)' },
			overlay: { $type: 'color', $value: 'alpha({foundation.colors.primary}, 30%)' },
		},
		numbers: {
			unit: { $type: 'number', $value: 4 },
			padding: { $type: 'number', $value: '{foundation.numbers.unit} * 2' },
		},
	},
	semantic: {
		badge: {
			background: { $type: 'color', $value: 'lighten({foundation.colors.primary}, 15%)' },
			foreground: { $type: 'color', $value: 'hueShift({foundation.colors.accent}, 45deg)' },
		},
	},
};

const multiModeSample: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: { light: '#0055CC', dark: '#80AFFF' } },
			accent: { $type: 'color', $value: { light: 'oklch(0.7 0.18 230)', dark: 'oklch(0.58 0.14 230)' } },
			neutral: { $type: 'color', $value: { light: 'oklch(0.85 0.02 220)', dark: 'oklch(0.35 0.02 220)' } },
		},
	},
	semantic: {
		button: {
			background: {
				$type: 'color',
				$value: { light: '{foundation.color.primary}', dark: '{foundation.color.primary}' },
			},
			backgroundHover: {
				$type: 'color',
				$value: {
					light: 'lighten({foundation.color.primary}, 10%)',
					dark: 'lighten({foundation.color.primary}, 6%)',
				},
			},
			backgroundActive: {
				$type: 'color',
				$value: {
					light: 'darken({foundation.color.primary}, 14%)',
					dark: 'darken({foundation.color.primary}, 12%)',
				},
			},
		},
		status: {
			successBase: {
				$type: 'color',
				$value: { light: 'oklch(0.78 0.14 140)', dark: 'oklch(0.6 0.12 140)' },
			},
			successOverlay: {
				$type: 'color',
				$value: {
					light: 'alpha({semantic.status.successBase}, 45%)',
					dark: 'alpha({semantic.status.successBase}, 35%)',
				},
			},
			accentShift: {
				$type: 'color',
				$value: {
					light: 'hueShift({foundation.color.accent}, -30deg)',
					dark: 'hueShift({foundation.color.accent}, 20deg)',
				},
			},
			muted: {
				$type: 'color',
				$value: {
					light: 'desaturate({foundation.color.accent}, 25%)',
					dark: 'desaturate({foundation.color.accent}, 25%)',
				},
			},
		},
	},
};

const overlappingSample: TokenJSON = {
	components: {
		button: {
			$self: { $type: 'string', $value: 'base-button' },
			fontSize: { $type: 'number', $value: 16 },
			fontWeight: { $type: 'number', $value: 600 },
		},
	},
};

const invalidSample: TokenJSON = {
	foundation: {
		color: { primary: { $type: 'color', $value: '#FFAA00' } },
	},
	semantic: {
		badge: {
			alphaBad: { $type: 'color', $value: 'alpha({foundation.color.primary}, 0.5)' },
		},
	},
};

// ---

describe('integration: single-mode scalar', () => {
	let map: TokenMap;

	beforeAll(() => {
		const result = validate(singleModeSample);
		expect(result.valid).toBe(true);
		if (result.valid) map = createTokenMap(result.data);
	});

	const tokens = [
		'foundation.colors.overlay',
		'foundation.numbers.padding',
		'semantic.badge.background',
		'semantic.badge.foreground',
	];

	it.each(tokens)('resolves "%s"', (tokenPath) => {
		assertResolvedShape(tokenPath, 'light', map);
	});

	it('padding resolves to 8', () => {
		const result = resolveToken('foundation.numbers.padding', 'light', map);
		expect(result).toEqual({ isAlias: false, value: 8 });
	});

	it('overlay resolves to RGBA with alpha 0.30', () => {
		const result = resolveToken('foundation.colors.overlay', 'light', map);
		expect(result.isAlias).toBe(false);
		if (!result.isAlias) {
			expect((result.value as RGBA).a).toBeCloseTo(0.3, 5);
		}
	});
});

describe('integration: multi-mode', () => {
	let map: TokenMap;

	beforeAll(() => {
		const result = validate(multiModeSample);
		expect(result.valid).toBe(true);
		if (result.valid) map = createTokenMap(result.data);
	});

	const tokens = [
		'semantic.button.backgroundHover',
		'semantic.button.backgroundActive',
		'semantic.status.successOverlay',
		'semantic.status.accentShift',
		'semantic.status.muted',
	];

	it.each(tokens)('resolves "%s" in light mode', (tokenPath) => {
		assertResolvedShape(tokenPath, 'light', map);
	});

	it.each(tokens)('resolves "%s" in dark mode', (tokenPath) => {
		assertResolvedShape(tokenPath, 'dark', map);
	});

	it('button.background is an alias in both modes', () => {
		const light = resolveToken('semantic.button.background', 'light', map);
		const dark = resolveToken('semantic.button.background', 'dark', map);
		expect(light).toEqual({ isAlias: true, targetPath: 'foundation.color.primary' });
		expect(dark).toEqual({ isAlias: true, targetPath: 'foundation.color.primary' });
	});

	it('successOverlay alpha differs between light and dark modes', () => {
		const light = resolveToken('semantic.status.successOverlay', 'light', map);
		const dark = resolveToken('semantic.status.successOverlay', 'dark', map);
		expect(light.isAlias).toBe(false);
		expect(dark.isAlias).toBe(false);
		if (!light.isAlias && !dark.isAlias) {
			expect((light.value as RGBA).a).toBeCloseTo(0.45, 5);
			expect((dark.value as RGBA).a).toBeCloseTo(0.35, 5);
		}
	});
});

describe('integration: overlapping $self', () => {
	let map: TokenMap;

	beforeAll(() => {
		const result = validate(overlappingSample);
		expect(result.valid).toBe(true);
		if (result.valid) map = createTokenMap(result.data);
	});

	it('resolves $self token at parent path', () => {
		expect(resolveToken('components.button', 'light', map)).toEqual({ isAlias: false, value: 'base-button' });
	});

	it('resolves child tokens alongside $self', () => {
		expect(resolveToken('components.button.fontSize', 'light', map)).toEqual({ isAlias: false, value: 16 });
		expect(resolveToken('components.button.fontWeight', 'light', map)).toEqual({ isAlias: false, value: 600 });
	});
});

describe('integration: alpha() amount as a token reference', () => {
	// Reproduces the originally reported bug: alpha()'s second argument is itself
	// a token reference (e.g. an imported Figma variable), and that referenced
	// token's value is a bare decimal rather than a percentage.
	const vuetifySample: TokenJSON = {
		'vuetify-variables': {
			'border-color': { $type: 'color', $value: '#3478F6' },
			'border-opacity': { $type: 'number', $value: 0.05 },
		},
		components: {
			colors: {
				'table.bg-striped': {
					$type: 'color',
					$value: "alpha({vuetify-variables.border-color}, {vuetify-variables.border-opacity})",
				},
			},
		},
	};

	it('passes validation with no errors', () => {
		const result = validate(vuetifySample);
		expect(result.valid).toBe(true);
	});

	it('resolves to the base color with alpha equal to the referenced decimal', () => {
		const result = validate(vuetifySample);
		expect(result.valid).toBe(true);
		if (!result.valid) return;

		const map = createTokenMap(result.data);
		const resolved = resolveToken('components.colors.table.bg-striped', 'light', map);
		expect(resolved.isAlias).toBe(false);
		if (!resolved.isAlias) {
			expect((resolved.value as RGBA).a).toBeCloseTo(0.05, 5);
		}
	});
});

describe('integration: invalid sample', () => {
	it('fails validation with a syntax error', () => {
		const result = validate(invalidSample);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'syntax')).toBe(true);
		}
	});
});
