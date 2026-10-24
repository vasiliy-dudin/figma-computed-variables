import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@core/types';
import { parseOrderedJson, toPlainJson } from '@core/orderedJson';
import { readWrittenOrder } from '@core/orderedTokenTree';
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

describe('applyToVariables — $scope', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function appliedScopes(scope: Token['$scope']): Promise<VariableScope[]> {
		const file = activateEmptyFileMock();
		const result = await applyToVariables({ tokens: { size: { $type: 'number', $value: 8, $scope: scope } } });
		expect(result.errors).toEqual([]);
		return [...file.variables.values()][0].scopes;
	}

	it('writes the ALL shorthand as ALL_SCOPES', async () => {
		expect(await appliedScopes('ALL')).toEqual(['ALL_SCOPES']);
	});

	it('still writes ALL_SCOPES as it is', async () => {
		expect(await appliedScopes('ALL_SCOPES')).toEqual(['ALL_SCOPES']);
	});

	it('passes other scopes through unchanged', async () => {
		expect(await appliedScopes(['GAP', 'WIDTH_HEIGHT'])).toEqual(['GAP', 'WIDTH_HEIGHT']);
	});
});

describe('applyToVariables — written order', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// A plain object lists "2024", "100" and "2" first; Figma should get them in the order written.
	it('creates collections, variables and modes in the written order', async () => {
		const file = activateEmptyFileMock();
		const document = parseOrderedJson(`{
			"semantic": { "gray": {
				"base": { "$type": "number", "$value": { "Wide": 1, "2": 2 } },
				"100": { "$type": "number", "$value": { "Wide": 3, "2": 4 } }
			} },
			"2024": { "size": { "$type": "number", "$value": 1 } }
		}`);
		const validated = validate(toPlainJson(document));
		if (!validated.valid) throw new Error('fixture JSON is invalid');

		const result = await applyToVariables(validated.data, readWrittenOrder(document));

		expect(result.errors).toEqual([]);
		expect(file.collections.map(c => c.name)).toEqual(['semantic', '2024']);
		const semantic = file.collections[0];
		expect(semantic.variableIds.map(id => file.variables.get(id)?.name)).toEqual(['gray/base', 'gray/100']);
		expect(semantic.modes.map(m => m.name)).toEqual(['Mode 1', 'Wide', '2']);
	});
});
