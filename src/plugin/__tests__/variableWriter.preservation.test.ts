import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyToVariables } from '../variableWriter';
import { MODE_ID, COLLECTION_NAME, BASE_ID, OVERLAY_ID, createVariable, composeColor, activateFigmaMock, json, TRANSLUCENT_ALPHA, OPACITY_VARIABLE_ID, OPACITY_TOKEN, translucentJson, expectComputedAlpha } from './writerTestKit';

// Figma replaces the base's alpha where alpha() multiplies it, so a composed colour over a
// translucent base paints something alpha() cannot reproduce. Apply leaves it alone as long
// as it still matches the token, and rewrites it as the computed colour once it does not.
describe('applyToVariables — preserving composed colours over a translucent base', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const BLUE = { r: 0, g: 0, b: 1, a: 1 };

	it('leaves an unchanged composed colour untouched and counts it', async () => {
		const stored = composeColor(BASE_ID, 50);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		const result = await applyToVariables(translucentJson('alpha({base}, 50%)'));

		expect(result.errors).toEqual([]);
		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
		expect(result.preservedComposedColors).toBe(1);
	});

	it('matches a collection-prefixed target path too', async () => {
		const stored = composeColor(BASE_ID, 50);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(translucentJson(`alpha({${COLLECTION_NAME}.base}, 50%)`));

		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
	});

	it('leaves one whose opacity is the variable the token names untouched', async () => {
		const stored = { color: { type: 'VARIABLE_ALIAS', id: BASE_ID }, opacity: { type: 'VARIABLE_ALIAS', id: OPACITY_VARIABLE_ID } };
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), createVariable(OPACITY_VARIABLE_ID, 'op', 60, 'FLOAT'), overlay]);

		const result = await applyToVariables(translucentJson('alpha({base}, {op})', OPACITY_TOKEN));

		expect(result.errors).toEqual([]);
		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
	});

	it('rewrites one whose opacity is a different variable', async () => {
		const stored = { color: { type: 'VARIABLE_ALIAS', id: BASE_ID }, opacity: { type: 'VARIABLE_ALIAS', id: 'VariableID:other-op' } };
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([
			createVariable(BASE_ID, 'base', BLUE),
			createVariable(OPACITY_VARIABLE_ID, 'op', 60, 'FLOAT'),
			createVariable('VariableID:other-op', 'otherOp', 60, 'FLOAT'),
			overlay,
		]);

		const result = await applyToVariables(translucentJson('alpha({base}, {op})', { ...OPACITY_TOKEN, otherOp: { $type: 'number', $value: 60 } }));

		expect(result.errors).toEqual([]);
		expectComputedAlpha(overlay.valuesByMode[MODE_ID], TRANSLUCENT_ALPHA * 0.6);
	});

	// resolveAmount turns a decimal token into a percentage by multiplying by 100, which
	// drifts in float64: 0.07 * 100 === 7.000000000000001. A strict comparison against the
	// whole number Figma stores would miss the match and destroy the reference.
	it.each([[0.07, 7], [0.29, 29], [0.57, 57]])('preserves when the amount comes from the decimal token %s', async (decimal, storedPercent) => {
		const stored = composeColor(BASE_ID, storedPercent);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(translucentJson('alpha({base}, {faint})', { faint: { $type: 'number', $value: decimal } }));

		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
	});

	it('rewrites as the computed colour when the percentage changed', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		const result = await applyToVariables(translucentJson('alpha({base}, 30%)'));

		expectComputedAlpha(overlay.valuesByMode[MODE_ID], TRANSLUCENT_ALPHA * 0.3);
		expect(result.preservedComposedColors).toBe(0);
	});

	it('rewrites as the computed colour when the percentage differs by a real amount', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 7));
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(translucentJson('alpha({base}, 7.5%)'));

		expectComputedAlpha(overlay.valuesByMode[MODE_ID], TRANSLUCENT_ALPHA * 0.075);
	});

	it('rewrites as the computed colour when the target changed', async () => {
		const other = createVariable('VariableID:other', 'other', { r: 1, g: 0, b: 0, a: 1 });
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor('VariableID:other', 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), other, overlay]);

		await applyToVariables(translucentJson('alpha({base}, 50%)'));

		expectComputedAlpha(overlay.valuesByMode[MODE_ID], TRANSLUCENT_ALPHA * 0.5);
	});
});

describe('applyToVariables — composed colours over an opaque base', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const BLUE = { r: 0, g: 0, b: 1, a: 1 };

	it('rewrites an unchanged composed colour as the same value, without counting it as kept', async () => {
		const stored = composeColor(BASE_ID, 50);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		const result = await applyToVariables(json('alpha({base}, 50%)'));

		expect(result.errors).toEqual([]);
		expect(overlay.valuesByMode[MODE_ID]).toEqual(stored);
		expect(result.preservedComposedColors).toBe(0);
	});

	it('writes the new percentage when it changed', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(json('alpha({base}, 30%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 30));
	});

	it('points at the new target when it changed', async () => {
		const other = createVariable('VariableID:other', 'other', { r: 1, g: 0, b: 0, a: 1 });
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor('VariableID:other', 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), other, overlay]);

		await applyToVariables(json('alpha({base}, 50%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 50));
	});

	it('writes a flat colour once the token is no longer an alpha() expression', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(json('#FF0000'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 1, g: 0, b: 0, a: 1 });
	});

	it('replaces a flat colour with a composed one', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', { r: 1, g: 1, b: 1, a: 1 });
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(json('alpha({base}, 50%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 50));
	});
});
