import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenJSON } from '@core/types';
import { applyToVariables } from '../variableWriter';

const MODE_ID = 'mode-1';
const MODE_NAME = 'Mode 1';
const COLLECTION_ID = 'collection-1';
const COLLECTION_NAME = 'foundation';

const BASE_ID = 'VariableID:base';
const OVERLAY_ID = 'VariableID:overlay';

interface FakeVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedDataType;
	variableCollectionId: string;
	valuesByMode: Record<string, unknown>;
	description: string;
	scopes: VariableScope[];
	setValueForMode: (modeId: string, value: unknown) => void;
}

function createVariable(id: string, name: string, value: unknown): FakeVariable {
	const variable: FakeVariable = {
		id,
		name,
		resolvedType: 'COLOR',
		variableCollectionId: COLLECTION_ID,
		valuesByMode: { [MODE_ID]: value },
		description: '',
		scopes: [],
		setValueForMode: (modeId, newValue) => {
			variable.valuesByMode[modeId] = newValue;
		},
	};
	return variable;
}

function composeColor(targetId: string, percent: number): unknown {
	return {
		type: 'VARIABLE_EXPRESSION',
		expressionFunction: 'COMPOSE_COLOR',
		expressionArguments: [{ type: 'VARIABLE_ALIAS', id: targetId }, percent],
	};
}

function activateFigmaMock(variables: FakeVariable[]): void {
	const byId = new Map(variables.map(v => [v.id, v]));
	const collection = {
		id: COLLECTION_ID,
		name: COLLECTION_NAME,
		modes: [{ modeId: MODE_ID, name: MODE_NAME }],
		variableIds: variables.map(v => v.id),
		addMode: () => MODE_ID,
	};

	vi.stubGlobal('figma', {
		variables: {
			getLocalVariableCollectionsAsync: async () => [collection],
			getVariableByIdAsync: async (id: string) => byId.get(id) ?? null,
			getVariableCollectionByIdAsync: async (id: string) => (id === COLLECTION_ID ? collection : null),
			createVariableCollection: () => collection,
			createVariable: () => {
				throw new Error('Test fixtures should already contain every variable');
			},
		},
	});
}

/** JSON whose "overlay" token asks for the given alpha() expression. */
function json(overlayValue: string): TokenJSON {
	return {
		[COLLECTION_NAME]: {
			base: { $type: 'color', $value: '#0000FF' },
			overlay: { $type: 'color', $value: overlayValue },
		},
	};
}

describe('applyToVariables — Composed Color preservation', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('leaves an unchanged composed color untouched', async () => {
		const stored = composeColor(BASE_ID, 50);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		const result = await applyToVariables(json('alpha({base}, 50%)'));

		expect(result.errors).toEqual([]);
		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
	});

	it('matches a collection-prefixed target path too', async () => {
		const stored = composeColor(BASE_ID, 50);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		await applyToVariables(json(`alpha({${COLLECTION_NAME}.base}, 50%)`));

		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
	});

	it('overwrites when the percentage changed', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		await applyToVariables(json('alpha({base}, 30%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 0, g: 0, b: 1, a: 0.3 });
	});

	it('overwrites when the target changed', async () => {
		const other = createVariable('VariableID:other', 'other', { r: 1, g: 0, b: 0, a: 1 });
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor('VariableID:other', 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), other, overlay]);

		await applyToVariables(json('alpha({base}, 50%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 0, g: 0, b: 1, a: 0.5 });
	});

	it('overwrites a composed color when the token is no longer an alpha() expression', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		await applyToVariables(json('#FF0000'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 1, g: 0, b: 0, a: 1 });
	});

	// resolveAmount turns a decimal token into a percentage by multiplying by 100, which
	// drifts in float64: 0.07 * 100 === 7.000000000000001. A strict comparison against the
	// whole number Figma stores would miss the match and destroy the reference.
	it.each([[0.07, 7], [0.29, 29], [0.57, 57]])('preserves when the amount comes from the decimal token %s', async (decimal, storedPercent) => {
		const stored = composeColor(BASE_ID, storedPercent);
		const overlay = createVariable(OVERLAY_ID, 'overlay', stored);
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				faint: { $type: 'number', $value: decimal },
				overlay: { $type: 'color', $value: 'alpha({base}, {faint})' },
			},
		});

		expect(overlay.valuesByMode[MODE_ID]).toBe(stored);
	});

	it('still overwrites when the percentage differs by a real amount', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 7));
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		await applyToVariables(json('alpha({base}, 7.5%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 0, g: 0, b: 1, a: 0.075 });
	});

	it('counts each preserved mode value', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', composeColor(BASE_ID, 50));
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		const result = await applyToVariables(json('alpha({base}, 50%)'));

		expect(result.preservedComposedColors).toBe(1);
	});

	it('reports zero preserved values when nothing was skipped', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', { r: 1, g: 1, b: 1, a: 1 });
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		const result = await applyToVariables(json('alpha({base}, 50%)'));

		expect(result.preservedComposedColors).toBe(0);
	});

	it('writes normally when the mode holds a flat colour rather than a composed one', async () => {
		const overlay = createVariable(OVERLAY_ID, 'overlay', { r: 1, g: 1, b: 1, a: 1 });
		activateFigmaMock([createVariable(BASE_ID, 'base', { r: 0, g: 0, b: 1, a: 1 }), overlay]);

		await applyToVariables(json('alpha({base}, 50%)'));

		expect(overlay.valuesByMode[MODE_ID]).toEqual({ r: 0, g: 0, b: 1, a: 0.5 });
	});
});
