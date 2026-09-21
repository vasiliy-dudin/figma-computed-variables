import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyToVariables } from '../variableWriter';
import { MODE_ID, COLLECTION_NAME, BASE_ID, OVERLAY_ID, FakeVariable, createVariable, composeColor, activateFigmaMock, json } from './writerTestKit';

describe('applyToVariables — native composed colours', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const BLUE = { r: 0, g: 0, b: 1, a: 1 };
	const OPACITY_ID = 'VariableID:opacity';

	function overlayVariable(): FakeVariable {
		return createVariable(OVERLAY_ID, 'overlay', BLUE);
	}

	it('clamps an amount above 100 % to full opacity', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables(json('alpha({base}, 150%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 100));
	});

	it('links the opacity to a COLOR_OPACITY amount token', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), createVariable(OPACITY_ID, 'op', 60, 'FLOAT'), overlay]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				op: { $type: 'number', $value: 60, $scope: 'COLOR_OPACITY' },
				overlay: { $type: 'color', $value: 'alpha({base}, {op})' },
			},
		});

		expect(overlay.valuesByMode[MODE_ID]).toEqual({
			color: { type: 'VARIABLE_ALIAS', id: BASE_ID },
			opacity: { type: 'VARIABLE_ALIAS', id: OPACITY_ID },
		});
	});

	// 0.12 means 12 % to alpha() but 0.12 % to Figma, so the number is written instead of a link.
	it('writes the percentage, not a link, for a decimal amount token', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), createVariable(OPACITY_ID, 'op', 0.12, 'FLOAT'), overlay]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				op: { $type: 'number', $value: 0.12 },
				overlay: { $type: 'color', $value: 'alpha({base}, {op})' },
			},
		});

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 12));
	});

	it('writes the percentage when the amount variable is not a number variable', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), createVariable(OPACITY_ID, 'op', '15%', 'STRING'), overlay]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				op: { $type: 'number', $value: '15%' },
				overlay: { $type: 'color', $value: 'alpha({base}, {op})' },
			},
		});

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 15));
	});

	it('keeps a translucent base as the computed colour it is today', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF80' },
				overlay: { $type: 'color', $value: 'alpha({base}, 50%)' },
			},
		});

		// '#0000FF80' has alpha 128/255; alpha() multiplies it by 50 %.
		const written = overlay.valuesByMode[MODE_ID] as { a: number; color?: unknown };
		expect(written.color).toBeUndefined();
		expect(written.a).toBeCloseTo((128 / 255) * 0.5, 3);
	});

	it('falls back to the computed colour, and reports it, when Figma rejects the composed colour', async () => {
		const overlay = overlayVariable();
		overlay.setValueForMode = (modeId, value) => {
			if (value !== null && typeof value === 'object' && 'opacity' in value) throw new Error('rejected');
			overlay.valuesByMode[modeId] = value;
		};
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await applyToVariables(json('alpha({base}, 50%)'));

		expect(result.errors).toEqual([]);
		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 0, g: 0, b: 1, a: 0.5 });
		expect(result.rejectedComposedColors).toBe(1);
		warn.mockRestore();
	});

	// A refusal usually means the same thing for every token, so it is one warning, not one each.
	it('counts every rejection but warns once per Apply', async () => {
		const overlays = ['a', 'b', 'c'].map((name, i) => {
			const variable = createVariable('VariableID:' + name, name, BLUE);
			variable.setValueForMode = (modeId, value) => {
				if (value !== null && typeof value === 'object' && 'opacity' in value) throw new Error('Figma is out of date');
				variable.valuesByMode[modeId] = value;
			};
			return variable;
		});
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), ...overlays]);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				a: { $type: 'color', $value: 'alpha({base}, 10%)' },
				b: { $type: 'color', $value: 'alpha({base}, 20%)' },
				c: { $type: 'color', $value: 'alpha({base}, 30%)' },
			},
		});

		expect(result.rejectedComposedColors).toBe(3);
		expect(warn).toHaveBeenCalledOnce();
		expect(String(warn.mock.calls[0][1])).toContain('Figma is out of date');
		warn.mockRestore();
	});

	it('reports nothing when the composed colours are accepted', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await applyToVariables(json('alpha({base}, 50%)'));

		expect(result.rejectedComposedColors).toBe(0);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('falls back to the computed colour when the base variable does not exist', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([overlay]);

		const result = await applyToVariables({
			[COLLECTION_NAME]: {
				_base: { $type: 'color', $value: '#0000FF' },
				overlay: { $type: 'color', $value: 'alpha({_base}, 50%)' },
			},
		});

		expect(result.errors).toEqual([]);
		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 0, g: 0, b: 1, a: 0.5 });
		// The user excluded the base with "_", so a fixed colour is the intended result, not a refusal.
		expect(result.rejectedComposedColors).toBe(0);
	});

	it('writes the percentage when the opacity variable does not exist', async () => {
		const overlay = overlayVariable();
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), overlay]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				_op: { $type: 'number', $value: 60, $scope: 'COLOR_OPACITY' },
				overlay: { $type: 'color', $value: 'alpha({base}, {_op})' },
			},
		});

		expect(overlay.valuesByMode[MODE_ID]).toEqual(composeColor(BASE_ID, 60));
	});
});
