import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@core/types';
import { importVariablesToJSON } from '../variableReader';

const MODE_ID = 'mode-1';
const MODE_NAME = 'Mode 1';
const COLLECTION_ID = 'collection-1';
const COLLECTION_NAME = 'Collection';

interface FakeVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedDataType;
	value: unknown;
	description?: string;
	scopes?: VariableScope[];
}

function activateVariablesMock(variables: FakeVariable[]): void {
	const byId = new Map(variables.map(v => [v.id, v]));

	vi.stubGlobal('figma', {
		variables: {
			getLocalVariableCollectionsAsync: async () => [
				{
					name: COLLECTION_NAME,
					modes: [{ modeId: MODE_ID, name: MODE_NAME }],
					variableIds: variables.map(v => v.id),
				},
			],
			getVariableByIdAsync: async (id: string) =>
				byId.has(id)
					? {
						...byId.get(id)!,
						variableCollectionId: COLLECTION_ID,
						valuesByMode: { [MODE_ID]: byId.get(id)!.value },
					}
					: null,
			getVariableCollectionByIdAsync: async (id: string) =>
				id === COLLECTION_ID ? { id, defaultModeId: MODE_ID } : null,
		},
	});
}

function alias(id: string): { type: 'VARIABLE_ALIAS'; id: string } {
	return { type: 'VARIABLE_ALIAS', id };
}

/** A composed colour as Figma returns it from valuesByMode. */
function composedColor(color: unknown, opacity: unknown): unknown {
	return { color, opacity };
}

/** Shorthand for the common case: a referenced colour with a literal percentage. */
function composeColor(targetId: string, percent: number): unknown {
	return composedColor(alias(targetId), percent);
}

describe('importVariablesToJSON — Composed Color handling', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('imports a resolvable composed color as alpha()', async () => {
		activateVariablesMock([
			{ id: 'base', name: 'base', resolvedType: 'COLOR', value: { r: 0, g: 0, b: 1, a: 1 } },
			{ id: 'overlay', name: 'overlay', resolvedType: 'COLOR', value: composeColor('base', 50) },
		]);

		const json = await importVariablesToJSON();
		const overlay = json[COLLECTION_NAME].overlay as Token;

		expect(overlay.$value).toBe('alpha({base}, 50%)');
	});

	it('imports a fractional percentage unchanged', async () => {
		activateVariablesMock([
			{ id: 'base', name: 'base', resolvedType: 'COLOR', value: { r: 0, g: 0, b: 1, a: 1 } },
			{ id: 'overlay', name: 'overlay', resolvedType: 'COLOR', value: composeColor('base', 12.5) },
		]);

		const json = await importVariablesToJSON();
		const overlay = json[COLLECTION_NAME].overlay as Token;

		expect(overlay.$value).toBe('alpha({base}, 12.5%)');
	});

	it('falls back to a traceable placeholder when the target variable cannot be resolved', async () => {
		activateVariablesMock([
			{ id: 'overlay', name: 'overlay', resolvedType: 'COLOR', value: composeColor('VariableID:missing', 50) },
		]);

		const json = await importVariablesToJSON();
		const overlay = json[COLLECTION_NAME].overlay as Token;

		expect(overlay.$value).toBe('alpha({unresolved-variable:VariableID:missing}, 50%)');
	});

	it('leaves a plain alias unaffected', async () => {
		activateVariablesMock([
			{ id: 'base', name: 'base', resolvedType: 'COLOR', value: { r: 0, g: 0, b: 1, a: 1 } },
			{ id: 'ref', name: 'ref', resolvedType: 'COLOR', value: alias('base') },
		]);

		const json = await importVariablesToJSON();
		const ref = json[COLLECTION_NAME].ref as Token;

		expect(ref.$value).toBe('{base}');
	});

	it('leaves a flat color unaffected', async () => {
		activateVariablesMock([
			{ id: 'base', name: 'base', resolvedType: 'COLOR', value: { r: 1, g: 0, b: 0, a: 1 } },
		]);

		const json = await importVariablesToJSON();
		const base = json[COLLECTION_NAME].base as Token;

		expect(base.$value).toBe('#ff0000');
	});
});

describe('importVariablesToJSON — composed colours with an opacity variable or a literal colour', () => {
	const BASE = { id: 'base', name: 'base', resolvedType: 'COLOR' as const, value: { r: 0, g: 0, b: 1, a: 1 } };
	const OPACITY = { id: 'opacity', name: 'opacity/primary', resolvedType: 'FLOAT' as const, value: 60 };

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function importedValue(overlayValue: unknown, extra: FakeVariable[] = []): Promise<unknown> {
		activateVariablesMock([BASE, OPACITY, ...extra, { id: 'overlay', name: 'overlay', resolvedType: 'COLOR', value: overlayValue }]);
		const json = await importVariablesToJSON();
		return (json[COLLECTION_NAME].overlay as Token).$value;
	}

	it('keeps the link to an opacity variable', async () => {
		expect(await importedValue(composedColor(alias('base'), alias('opacity')))).toBe('alpha({base}, {opacity.primary})');
	});

	it('marks an unresolvable opacity variable so validation reports it', async () => {
		expect(await importedValue(composedColor(alias('base'), alias('VariableID:gone'))))
			.toBe('alpha({base}, {unresolved-variable:VariableID:gone})');
	});

	it('imports a literal colour with an opacity variable as the flat colour it shows', async () => {
		expect(await importedValue(composedColor({ r: 1, g: 0, b: 0 }, alias('opacity')))).toBe('rgba(255, 0, 0, 0.6)');
	});

	it('imports a literal colour opaque when the opacity variable holds no plain number', async () => {
		const chainedOpacity = { id: 'chained', name: 'opacity/chained', resolvedType: 'FLOAT' as const, value: alias('opacity') };
		expect(await importedValue(composedColor({ r: 1, g: 0, b: 0 }, alias('chained')), [chainedOpacity])).toBe('#ff0000');
	});

	it('never falls back to black for a composed colour', async () => {
		expect(await importedValue(composedColor(alias('base'), 50))).not.toBe('#000000');
		expect(await importedValue(composedColor({ r: 1, g: 0, b: 0 }, alias('opacity')))).not.toBe('#000000');
	});
});

// Figma stores an opacity variable as a percentage but does not require the COLOR_OPACITY
// scope; without it the plugin would read a bare 60 as a fraction. "60%" reads either way.
describe('importVariablesToJSON — opacity variables of composed colours', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const BASE = { id: 'base', name: 'base', resolvedType: 'COLOR' as const, value: { r: 0, g: 0, b: 1, a: 1 } };

	async function importedValues(variables: FakeVariable[]): Promise<Record<string, unknown>> {
		activateVariablesMock(variables);
		const json = await importVariablesToJSON();
		const flat: Record<string, unknown> = {};
		const walk = (node: Record<string, unknown>, prefix: string): void => {
			for (const [key, child] of Object.entries(node)) {
				const path = prefix ? `${prefix}.${key}` : key;
				if (child && typeof child === 'object' && '$value' in child) flat[path] = (child as Token).$value;
				else walk(child as Record<string, unknown>, path);
			}
		};
		walk(json[COLLECTION_NAME] as Record<string, unknown>, '');
		return flat;
	}

	function overlay(opacityId: string): FakeVariable {
		return { id: 'overlay', name: 'overlay', resolvedType: 'COLOR', value: composedColor(alias('base'), alias(opacityId)) };
	}

	it('imports an unscoped opacity variable as a percentage string', async () => {
		const values = await importedValues([BASE, { id: 'op', name: 'op', resolvedType: 'FLOAT', value: 60 }, overlay('op')]);
		expect(values.op).toBe('60%');
		expect(values.overlay).toBe('alpha({base}, {op})');
	});

	it('imports a COLOR_OPACITY opacity variable as a number, as before', async () => {
		const scoped = { id: 'op', name: 'op', resolvedType: 'FLOAT' as const, value: 60, scopes: ['COLOR_OPACITY'] as unknown as VariableScope[] };
		expect((await importedValues([BASE, scoped, overlay('op')])).op).toBe(60);
	});

	it('leaves number variables that are not opacities alone', async () => {
		const values = await importedValues([BASE, { id: 'spacing', name: 'spacing', resolvedType: 'FLOAT', value: 60 }]);
		expect(values.spacing).toBe(60);
	});

	it('marks the end of an alias chain, keeping the alias itself', async () => {
		const values = await importedValues([
			BASE,
			{ id: 'op', name: 'op', resolvedType: 'FLOAT', value: alias('raw') },
			{ id: 'raw', name: 'raw', resolvedType: 'FLOAT', value: 60 },
			overlay('op'),
		]);
		expect(values.op).toBe('{raw}');
		expect(values.raw).toBe('60%');
	});

	it('keeps a fractional percentage', async () => {
		expect((await importedValues([BASE, { id: 'op', name: 'op', resolvedType: 'FLOAT', value: 12.5 }, overlay('op')])).op).toBe('12.5%');
	});
});
