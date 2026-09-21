import { afterEach, describe, expect, it, vi } from 'vitest';
import { validate } from '@core/validator';
import { applyToVariables } from '../variableWriter';
import { importVariablesToJSON } from '../variableReader';
import { createVariable, EmptyFileVariable, EmptyFileCollection, activateEmptyFileMock, snapshot } from './writerTestKit';

describe('applyToVariables — first Apply into an empty file', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const semantic = {
		text: { $type: 'color' as const, $value: '{color.brand}' },
		overlay: { $type: 'color' as const, $value: 'alpha({color.brand}, 50%)' },
	};
	const foundation = {
		color: { brand: { $type: 'color' as const, $value: '#0066FF' } },
	};

	it('resolves references to a collection defined later in the JSON', async () => {
		const file = activateEmptyFileMock();

		const result = await applyToVariables({ semantic, foundation });

		expect(result.errors).toEqual([]);
		const values = snapshot(file);
		expect(values['semantic/text']['Mode 1']).toEqual({ alias: 'foundation/color/brand' });
		expect(values['semantic/overlay']['Mode 1']).toEqual({ color: { alias: 'foundation/color/brand' }, opacity: 50 });
	});

	it('gives the same result whatever order the collections come in', async () => {
		const laterFirst = activateEmptyFileMock();
		await applyToVariables({ semantic, foundation });
		const referencedFirst = activateEmptyFileMock();
		await applyToVariables({ foundation, semantic });

		expect(snapshot(laterFirst)).toEqual(snapshot(referencedFirst));
	});
});

describe('Import → Apply round trip of a composed colour with an opacity variable', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// Figma does not require COLOR_OPACITY on opacity variables, so this one has no scope.
	it('leaves both variables unchanged and linked', async () => {
		const file = activateEmptyFileMock();
		const figmaApi = (globalThis as unknown as { figma: { variables: {
			createVariableCollection: (name: string) => EmptyFileCollection;
			createVariable: (name: string, collection: EmptyFileCollection, type: VariableResolvedDataType) => EmptyFileVariable;
		} } }).figma.variables;
		const collection = figmaApi.createVariableCollection('tokens');
		const modeId = collection.modes[0].modeId;
		const base = figmaApi.createVariable('base', collection, 'COLOR');
		base.setValueForMode(modeId, { r: 0, g: 0, b: 1, a: 1 });
		const opacity = figmaApi.createVariable('opacity', collection, 'FLOAT');
		opacity.setValueForMode(modeId, 60);
		const overlay = figmaApi.createVariable('overlay', collection, 'COLOR');
		const composed = { color: { type: 'VARIABLE_ALIAS', id: base.id }, opacity: { type: 'VARIABLE_ALIAS', id: opacity.id } };
		overlay.setValueForMode(modeId, composed);
		const before = snapshot(file);

		const imported = await importVariablesToJSON();
		expect(validate(imported).valid).toBe(true);
		const result = await applyToVariables(imported);

		expect(result.errors).toEqual([]);
		expect(snapshot(file)).toEqual(before);
		expect(overlay.valuesByMode[modeId]).toEqual(composed);
		expect(opacity.valuesByMode[modeId]).toBe(60);
	});
});
