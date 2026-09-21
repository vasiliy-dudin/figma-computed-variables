import { describe, expect, it } from 'vitest';
import { readComposedColor } from '../composeColor';

const BASE_ALIAS = { type: 'VARIABLE_ALIAS', id: 'VariableID:9:80' };
const OPACITY_ALIAS = { type: 'VARIABLE_ALIAS', id: 'VariableID:9:82' };

describe('readComposedColor', () => {
	// Captured verbatim from real Figma on 2026-09-21: opacity set to 42 by hand in the UI.
	it('reads a value set by hand in the Figma UI', () => {
		expect(readComposedColor({ color: BASE_ALIAS, opacity: 42 })).toEqual({
			color: { kind: 'alias', id: 'VariableID:9:80' },
			opacity: { kind: 'percent', value: 42 },
		});
	});

	it('reads a referenced colour with a literal percentage', () => {
		expect(readComposedColor({ color: BASE_ALIAS, opacity: 50 })).toEqual({
			color: { kind: 'alias', id: 'VariableID:9:80' },
			opacity: { kind: 'percent', value: 50 },
		});
	});

	it('reads a referenced colour with a referenced opacity', () => {
		expect(readComposedColor({ color: BASE_ALIAS, opacity: OPACITY_ALIAS })).toEqual({
			color: { kind: 'alias', id: 'VariableID:9:80' },
			opacity: { kind: 'alias', id: 'VariableID:9:82' },
		});
	});

	it('reads a literal colour with a referenced opacity', () => {
		expect(readComposedColor({ color: { r: 1, g: 0, b: 0 }, opacity: OPACITY_ALIAS })).toEqual({
			color: { kind: 'rgb', value: { r: 1, g: 0, b: 0 } },
			opacity: { kind: 'alias', id: 'VariableID:9:82' },
		});
	});

	it('keeps a fractional percentage unchanged', () => {
		expect(readComposedColor({ color: BASE_ALIAS, opacity: 12.5 })?.opacity).toEqual({ kind: 'percent', value: 12.5 });
	});

	// Figma returned this shape before update 139. It no longer does, even for values set by
	// hand in the UI (checked 2026-09-21), so it is deliberately not supported.
	it('does not read the pre-139 VARIABLE_EXPRESSION shape', () => {
		expect(readComposedColor({
			type: 'VARIABLE_EXPRESSION',
			expressionFunction: 'COMPOSE_COLOR',
			expressionArguments: [BASE_ALIAS, 50],
		})).toBeNull();
	});
});

describe('readComposedColor — values that are not composed colours', () => {
	it('returns null for a plain alias', () => {
		expect(readComposedColor(BASE_ALIAS)).toBeNull();
	});

	it('returns null for a flat colour', () => {
		expect(readComposedColor({ r: 0, g: 0, b: 1, a: 1 })).toBeNull();
	});

	it('returns null for primitives and null', () => {
		expect(readComposedColor(42)).toBeNull();
		expect(readComposedColor('#0000ff')).toBeNull();
		expect(readComposedColor(null)).toBeNull();
	});

	it('returns null when a side has the wrong type', () => {
		expect(readComposedColor({ color: BASE_ALIAS, opacity: '50' })).toBeNull();
		expect(readComposedColor({ color: '#0000ff', opacity: 50 })).toBeNull();
		expect(readComposedColor({ color: BASE_ALIAS })).toBeNull();
		expect(readComposedColor({ color: BASE_ALIAS, opacity: Number.NaN })).toBeNull();
	});
});
