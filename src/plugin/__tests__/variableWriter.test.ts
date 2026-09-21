import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenJSON } from '@core/types';
import { applyToVariables } from '../variableWriter';
import { importVariablesToJSON } from '../variableReader';
import { validate } from '@core/validator';

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

function createVariable(id: string, name: string, value: unknown, resolvedType: VariableResolvedDataType = 'COLOR'): FakeVariable {
	const variable: FakeVariable = {
		id,
		name,
		resolvedType,
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

/** A composed colour as Figma returns it: a referenced colour with a literal percentage. */
function composeColor(targetId: string, percent: number): unknown {
	return { color: { type: 'VARIABLE_ALIAS', id: targetId }, opacity: percent };
}

/** Stubs figma.variables and returns a counter of getVariableByIdAsync calls. */
function activateFigmaMock(variables: FakeVariable[]): { lookups: () => number } {
	const byId = new Map(variables.map(v => [v.id, v]));
	let lookups = 0;
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
			getVariableByIdAsync: async (id: string) => {
				lookups++;
				return byId.get(id) ?? null;
			},
			getVariableCollectionByIdAsync: async (id: string) => (id === COLLECTION_ID ? collection : null),
			createVariableCollection: () => collection,
			createVariable: () => {
				throw new Error('Test fixtures should already contain every variable');
			},
		},
	});
	return { lookups: () => lookups };
}

/** JSON whose "overlay" token asks for the given alpha() expression over an opaque base. */
function json(overlayValue: string): TokenJSON {
	return {
		[COLLECTION_NAME]: {
			base: { $type: 'color', $value: '#0000FF' },
			overlay: { $type: 'color', $value: overlayValue },
		},
	};
}

// '#0000FF80': the base is half transparent, so a composed colour over it cannot be rewritten.
const TRANSLUCENT_BASE = '#0000FF80';
const TRANSLUCENT_ALPHA = 128 / 255;
const OPACITY_VARIABLE_ID = 'VariableID:opacity-variable';

type NumberTokens = Record<string, { $type: 'number'; $value: number; $scope?: 'COLOR_OPACITY' }>;

// A COLOR_OPACITY amount token, as Figma authors an opacity variable.
const OPACITY_TOKEN: NumberTokens = { op: { $type: 'number', $value: 60, $scope: 'COLOR_OPACITY' } };

/** Same as json(), over a translucent base, with any extra number tokens. */
function translucentJson(overlayValue: string, extra: NumberTokens = {}): TokenJSON {
	return {
		[COLLECTION_NAME]: {
			base: { $type: 'color', $value: TRANSLUCENT_BASE },
			...extra,
			overlay: { $type: 'color', $value: overlayValue },
		},
	};
}

/** Asserts that the plugin wrote the computed colour, not a composed one. */
function expectComputedAlpha(value: unknown, alpha: number): void {
	const written = value as { a: number; color?: unknown };
	expect(written.color).toBeUndefined();
	expect(written.a).toBeCloseTo(alpha, 3);
}

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

describe('applyToVariables — plain aliases', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const BLUE = { r: 0, g: 0, b: 1, a: 1 };

	it('writes a native alias to the referenced variable', async () => {
		const ref = createVariable('VariableID:ref', 'ref', BLUE);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), ref]);

		const result = await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				ref: { $type: 'color', $value: '{base}' },
			},
		});

		expect(result.errors).toEqual([]);
		expect(ref.valuesByMode[MODE_ID]).toEqual({ type: 'VARIABLE_ALIAS', id: BASE_ID });
	});

	it('resolves a collection-prefixed alias', async () => {
		const ref = createVariable('VariableID:ref', 'ref', BLUE);
		activateFigmaMock([createVariable(BASE_ID, 'base', BLUE), ref]);

		await applyToVariables({
			[COLLECTION_NAME]: {
				base: { $type: 'color', $value: '#0000FF' },
				ref: { $type: 'color', $value: `{${COLLECTION_NAME}.base}` },
			},
		});

		expect(ref.valuesByMode[MODE_ID]).toEqual({ type: 'VARIABLE_ALIAS', id: BASE_ID });
	});

	it('reads each variable once per Apply, not once per alias', async () => {
		const aliasCount = 40;
		const refs = Array.from({ length: aliasCount }, (_, i) => createVariable('VariableID:ref' + i, 'ref' + i, BLUE));
		const variables = [createVariable(BASE_ID, 'base', BLUE), ...refs];
		const counter = activateFigmaMock(variables);

		const tokens: Record<string, { $type: 'color'; $value: string }> = { base: { $type: 'color', $value: '#0000FF' } };
		refs.forEach((_, i) => { tokens['ref' + i] = { $type: 'color', $value: '{base}' }; });
		await applyToVariables({ [COLLECTION_NAME]: tokens });

		expect(counter.lookups()).toBe(variables.length);
		expect(refs.every(ref => (ref.valuesByMode[MODE_ID] as { id?: string }).id === BASE_ID)).toBe(true);
	});
});

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

	it('falls back to the computed colour when Figma rejects the composed colour', async () => {
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
		expect(warn).toHaveBeenCalledOnce();
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

// A Figma file that starts empty, so Apply has to create every collection and variable.
interface EmptyFileVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedDataType;
	variableCollectionId: string;
	valuesByMode: Record<string, unknown>;
	description: string;
	scopes: VariableScope[];
	setValueForMode: (modeId: string, value: unknown) => void;
}

interface EmptyFileCollection {
	id: string;
	name: string;
	modes: { modeId: string; name: string }[];
	variableIds: string[];
	addMode: (name: string) => string;
}

function activateEmptyFileMock(): { collections: EmptyFileCollection[]; variables: Map<string, EmptyFileVariable> } {
	const collections: EmptyFileCollection[] = [];
	const variables = new Map<string, EmptyFileVariable>();
	let nextId = 0;

	const createVariableCollection = (name: string): EmptyFileCollection => {
		const modes = [{ modeId: 'M' + nextId++, name: 'Mode 1' }];
		const collection: EmptyFileCollection = {
			id: 'C' + nextId++,
			name,
			modes,
			variableIds: [],
			addMode: (modeName: string) => {
				const modeId = 'M' + nextId++;
				modes.push({ modeId, name: modeName });
				return modeId;
			},
		};
		collections.push(collection);
		return collection;
	};

	const createVariable = (name: string, collection: EmptyFileCollection, resolvedType: VariableResolvedDataType): EmptyFileVariable => {
		const variable: EmptyFileVariable = {
			id: 'V' + nextId++,
			name,
			resolvedType,
			variableCollectionId: collection.id,
			valuesByMode: {},
			description: '',
			scopes: [],
			setValueForMode: (modeId, value) => {
				variable.valuesByMode[modeId] = value;
			},
		};
		variables.set(variable.id, variable);
		collection.variableIds.push(variable.id);
		return variable;
	};

	vi.stubGlobal('figma', {
		variables: {
			getLocalVariableCollectionsAsync: async () => [...collections],
			getVariableByIdAsync: async (id: string) => variables.get(id) ?? null,
			getVariableCollectionByIdAsync: async (id: string) => collections.find(c => c.id === id) ?? null,
			createVariableCollection,
			createVariable,
		},
	});
	return { collections, variables };
}

/**
 * Everything the file ends up holding, keyed by "collection/variable" and mode name, with
 * variable ids replaced by names so that two separately built files can be compared.
 */
function snapshot(file: ReturnType<typeof activateEmptyFileMock>): Record<string, Record<string, unknown>> {
	const keyOf = (id: string): string => {
		const variable = file.variables.get(id);
		const collection = file.collections.find(c => c.id === variable?.variableCollectionId);
		return `${collection?.name}/${variable?.name}`;
	};
	const withNames = (value: unknown): unknown => JSON.parse(JSON.stringify(value), (_key, v) =>
		v && typeof v === 'object' && v.type === 'VARIABLE_ALIAS' ? { alias: keyOf(v.id) } : v);

	const result: Record<string, Record<string, unknown>> = {};
	for (const variable of file.variables.values()) {
		const collection = file.collections.find(c => c.id === variable.variableCollectionId)!;
		const byMode: Record<string, unknown> = {};
		for (const mode of collection.modes) {
			byMode[mode.name] = withNames(variable.valuesByMode[mode.modeId]);
		}
		result[keyOf(variable.id)] = byMode;
	}
	return result;
}

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
