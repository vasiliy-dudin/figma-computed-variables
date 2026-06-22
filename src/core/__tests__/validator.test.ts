import { describe, it, expect } from 'vitest';
import { validate } from '../validator.ts';
import { EXAMPLE_TOKEN_JSON, generateExampleJSON } from '../constants.ts';
import type { TokenJSON } from '../types';

// --- Valid fixtures ---

const validSingleMode: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: '#3478F6' },
		},
		spacing: {
			base: { $type: 'number', $value: 8 },
		},
	},
	semantic: {
		button: {
			background: { $type: 'color', $value: '{foundation.color.primary}' },
			padding: { $type: 'number', $value: '{foundation.spacing.base} * 2' },
		},
	},
};

const validMultiMode: TokenJSON = {
	foundation: {
		color: {
			primary: { $type: 'color', $value: { light: '#0055CC', dark: '#80AFFF' } },
		},
	},
	semantic: {
		button: {
			background: {
				$type: 'color',
				$value: {
					light: '{foundation.color.primary}',
					dark: '{foundation.color.primary}',
				},
			},
			backgroundHover: {
				$type: 'color',
				$value: {
					light: 'lighten({foundation.color.primary}, 10%)',
					dark: 'lighten({foundation.color.primary}, 6%)',
				},
			},
		},
	},
};

// ---

describe('validate — valid inputs', () => {
	it('returns valid for well-formed single-mode JSON', () => {
		const result = validate(validSingleMode);
		expect(result.valid).toBe(true);
	});

	it('returns valid for the built-in EXAMPLE_TOKEN_JSON shown on first run', () => {
		const result = validate(EXAMPLE_TOKEN_JSON);
		expect(result.valid).toBe(true);
	});

	it('returns valid for generateExampleJSON output (all option combinations)', () => {
		for (const modeCount of ['1', '2'] as const) {
			for (const includeDescription of [false, true]) {
				for (const includeScope of [false, true]) {
					const json = generateExampleJSON({ modeCount, includeDescription, includeScope });
					const result = validate(json);
					expect(result.valid).toBe(true);
				}
			}
		}
	});

	it('returns valid for well-formed multi-mode JSON', () => {
		const result = validate(validMultiMode);
		expect(result.valid).toBe(true);
	});

	it('returns the parsed data when valid', () => {
		const result = validate(validSingleMode);
		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.data).toBeDefined();
		}
	});
});

describe('validate — schema errors', () => {
	it('rejects invalid $type value', () => {
		const json = { foundation: { color: { primary: { $type: 'gradient', $value: '#fff' } } } };
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'schema')).toBe(true);
		}
	});

	it('rejects missing $value', () => {
		const json = { foundation: { color: { primary: { $type: 'color' } } } };
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'schema')).toBe(true);
		}
	});

	it('rejects non-object input', () => {
		const result = validate('not an object');
		expect(result.valid).toBe(false);
	});

	it('rejects null input', () => {
		const result = validate(null);
		expect(result.valid).toBe(false);
	});
});

describe('validate — reference errors', () => {
	it('reports error for missing reference', () => {
		const json: TokenJSON = {
			semantic: {
				badge: {
					background: { $type: 'color', $value: '{foundation.color.nonexistent}' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'reference')).toBe(true);
		}
	});

	it('does not report error for valid reference', () => {
		const result = validate(validSingleMode);
		expect(result.valid).toBe(true);
	});
});

describe('validate — circular dependency errors', () => {
	it('detects direct circular dependency', () => {
		const json: TokenJSON = {
			tokens: {
				a: { $type: 'color', $value: 'alpha({tokens.b}, 50%)' },
				b: { $type: 'color', $value: 'alpha({tokens.a}, 50%)' },
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'circular')).toBe(true);
		}
	});

	it('detects self-referential token', () => {
		const json: TokenJSON = {
			tokens: {
				a: { $type: 'number', $value: '{tokens.a} * 2' },
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'circular')).toBe(true);
		}
	});
});

describe('validate — syntax errors', () => {
	it('reports error for alpha() with decimal instead of percent', () => {
		const json: TokenJSON = {
			foundation: { color: { primary: { $type: 'color', $value: '#FFAA00' } } },
			semantic: {
				badge: {
					alphaBad: { $type: 'color', $value: 'alpha({foundation.color.primary}, 0.5)' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'syntax')).toBe(true);
		}
	});

	it('accepts modifier that targets an alias color token (chained aliases are resolved)', () => {
		const json: TokenJSON = {
			foundation: {
				color: {
					primary: { $type: 'color', $value: '#3478F6' },
					alias: { $type: 'color', $value: '{foundation.color.primary}' },
				},
			},
			semantic: {
				button: {
					// darken() targets an alias — now valid; resolver follows the chain
					bg: { $type: 'color', $value: 'darken({foundation.color.alias}, 10%)' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(true);
	});

	it('accepts alpha() with a token-reference amount (e.g. a decimal opacity token)', () => {
		const json: TokenJSON = {
			vuetify: {
				'border-color': { $type: 'color', $value: '#3478F6' },
				'border-opacity': { $type: 'number', $value: 0.05 },
			},
			semantic: {
				table: {
					stripe: { $type: 'color', $value: 'alpha({vuetify.border-color}, {vuetify.border-opacity})' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(true);
	});

	it('accepts darken()/hueShift() with a token-reference amount', () => {
		const json: TokenJSON = {
			foundation: {
				color: { primary: { $type: 'color', $value: '#3478F6' } },
			},
			amounts: {
				subtle: { $type: 'number', $value: 0.2 },
				shift: { $type: 'number', $value: 30 },
			},
			semantic: {
				button: {
					dark: { $type: 'color', $value: 'darken({foundation.color.primary}, {amounts.subtle})' },
					shifted: { $type: 'color', $value: 'hueShift({foundation.color.primary}, {amounts.shift})' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(true);
	});

	it('reports error when an alpha() amount reference points at a color token', () => {
		const json: TokenJSON = {
			foundation: {
				color: {
					primary: { $type: 'color', $value: '#3478F6' },
					accent: { $type: 'color', $value: '#FF0000' },
				},
			},
			semantic: {
				badge: {
					bad: { $type: 'color', $value: 'alpha({foundation.color.primary}, {foundation.color.accent})' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'syntax' && e.message.includes('amount reference'))).toBe(true);
		}
	});

	it('reports error when modifier targets a non-color token', () => {
		const json: TokenJSON = {
			foundation: {
				spacing: { base: { $type: 'number', $value: 8 } },
			},
			semantic: {
				button: {
					bg: { $type: 'color', $value: 'darken({foundation.spacing.base}, 10%)' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'syntax')).toBe(true);
		}
	});
});

describe('validate — collision errors', () => {
	it('reports ambiguous alias when same bare (dot-free) path exists in multiple collections', () => {
		// detectAmbiguousAliases only flags dot-free bare references like {primary}
		// (not {collection.primary}), so the test uses a top-level token named 'primary'
		// present in two collections.
		const json: TokenJSON = {
			foundation: {
				primary: { $type: 'color', $value: '#3478F6' },
			},
			semantic: {
				primary: { $type: 'color', $value: '#FF0000' },
				button: {
					// {primary} is ambiguous — exists in both foundation and semantic
					bg: { $type: 'color', $value: '{primary}' },
				},
			},
		};
		const result = validate(json);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some(e => e.errorType === 'collision')).toBe(true);
		}
	});
});
