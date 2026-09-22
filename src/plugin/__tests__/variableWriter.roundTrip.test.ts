import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenJSON } from '@core/types';
import { validate } from '@core/validator';
import { applyToVariables } from '../variableWriter';
import { importVariablesToJSON } from '../variableReader';
import { activateEmptyFileMock, snapshot, EmptyFileCollection, EmptyFileVariable } from './writerTestKit';

type FigmaVariablesApi = {
	createVariableCollection: (name: string) => EmptyFileCollection;
	createVariable: (name: string, collection: EmptyFileCollection, type: VariableResolvedDataType) => EmptyFileVariable;
};

function figmaVariables(): FigmaVariablesApi {
	return (globalThis as unknown as { figma: { variables: FigmaVariablesApi } }).figma.variables;
}

/** Import, check the JSON is valid, then Apply it back. */
async function importThenApply(): Promise<TokenJSON> {
	const imported = await importVariablesToJSON();
	expect(validate(imported).valid).toBe(true);
	const result = await applyToVariables(imported);
	expect(result.errors).toEqual([]);
	return imported;
}

describe('Import → Apply round trips with alpha() chains', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// Figma replaces a base's alpha, so {glass, 42} with glass = {brand, 50} paints brand at 42 %.
	// The reference moves from glass to brand, as planned; what it paints must not change.
	it('keeps the paint of a composed colour authored in Figma over another composed colour', async () => {
		const file = activateEmptyFileMock();
		const api = figmaVariables();
		const tokens = api.createVariableCollection('tokens');
		const modeId = tokens.modes[0].modeId;
		const brand = api.createVariable('brand', tokens, 'COLOR');
		brand.setValueForMode(modeId, { r: 0, g: 0, b: 1, a: 1 });
		const glass = api.createVariable('glass', tokens, 'COLOR');
		glass.setValueForMode(modeId, { color: { type: 'VARIABLE_ALIAS', id: brand.id }, opacity: 50 });
		const frost = api.createVariable('frost', tokens, 'COLOR');
		frost.setValueForMode(modeId, { color: { type: 'VARIABLE_ALIAS', id: glass.id }, opacity: 42 });

		const imported = await importThenApply();

		expect((imported.tokens as Record<string, { $value: unknown }>).frost.$value).toBe('alpha({brand}, 42%)');
		expect(snapshot(file)['tokens/frost']['Mode 1']).toEqual({ color: { alias: 'tokens/brand' }, opacity: 42 });
		expect(snapshot(file)['tokens/glass']['Mode 1']).toEqual({ color: { alias: 'tokens/brand' }, opacity: 50 });
	});

	it('does not drift over repeated JSON → Apply → Import → Apply cycles', async () => {
		const file = activateEmptyFileMock();
		await applyToVariables({
			foundation: {
				color: {
					brand: { $type: 'color', $value: '#0066FF' },
					glass: { $type: 'color', $value: 'alpha({color.brand}, 50%)' },
				},
			},
			semantic: {
				onGlass: { $type: 'color', $value: 'alpha({color.glass}, 50%)' },
			},
		});
		const afterFirstApply = snapshot(file);
		expect(afterFirstApply['semantic/onGlass']['Mode 1']).toEqual({ color: { alias: 'foundation/color/brand' }, opacity: 25 });

		const first = await importThenApply();
		expect(snapshot(file)).toEqual(afterFirstApply);
		const second = await importThenApply();
		expect(snapshot(file)).toEqual(afterFirstApply);

		const onGlass = (json: TokenJSON): unknown => (json.semantic as Record<string, { $value: unknown }>).onGlass.$value;
		expect(onGlass(first)).toBe('alpha({color.brand}, 25%)');
		expect(second).toEqual(first);
	});
});
