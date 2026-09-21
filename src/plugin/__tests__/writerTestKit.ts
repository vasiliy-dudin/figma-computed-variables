// Shared fixtures for the variableWriter tests: fake Figma files and the JSON they are applied to.
import { expect, vi } from 'vitest';
import type { TokenJSON } from '@core/types';

export const MODE_ID = 'mode-1';
export const MODE_NAME = 'Mode 1';
export const COLLECTION_ID = 'collection-1';
export const COLLECTION_NAME = 'foundation';

export const BASE_ID = 'VariableID:base';
export const OVERLAY_ID = 'VariableID:overlay';

export interface FakeVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedDataType;
	variableCollectionId: string;
	valuesByMode: Record<string, unknown>;
	description: string;
	scopes: VariableScope[];
	setValueForMode: (modeId: string, value: unknown) => void;
}

export function createVariable(id: string, name: string, value: unknown, resolvedType: VariableResolvedDataType = 'COLOR'): FakeVariable {
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
export function composeColor(targetId: string, percent: number): unknown {
	return { color: { type: 'VARIABLE_ALIAS', id: targetId }, opacity: percent };
}

/** Stubs figma.variables and returns a counter of getVariableByIdAsync calls. */
export function activateFigmaMock(variables: FakeVariable[]): { lookups: () => number } {
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
export function json(overlayValue: string): TokenJSON {
	return {
		[COLLECTION_NAME]: {
			base: { $type: 'color', $value: '#0000FF' },
			overlay: { $type: 'color', $value: overlayValue },
		},
	};
}

// '#0000FF80': the base is half transparent, so a composed colour over it cannot be rewritten.
export const TRANSLUCENT_BASE = '#0000FF80';
export const TRANSLUCENT_ALPHA = 128 / 255;
export const OPACITY_VARIABLE_ID = 'VariableID:opacity-variable';

export type NumberTokens = Record<string, { $type: 'number'; $value: number; $scope?: 'COLOR_OPACITY' }>;

// A COLOR_OPACITY amount token, as Figma authors an opacity variable.
export const OPACITY_TOKEN: NumberTokens = { op: { $type: 'number', $value: 60, $scope: 'COLOR_OPACITY' } };

/** Same as json(), over a translucent base, with any extra number tokens. */
export function translucentJson(overlayValue: string, extra: NumberTokens = {}): TokenJSON {
	return {
		[COLLECTION_NAME]: {
			base: { $type: 'color', $value: TRANSLUCENT_BASE },
			...extra,
			overlay: { $type: 'color', $value: overlayValue },
		},
	};
}

/** Asserts that the plugin wrote the computed colour, not a composed one. */
export function expectComputedAlpha(value: unknown, alpha: number): void {
	const written = value as { a: number; color?: unknown };
	expect(written.color).toBeUndefined();
	expect(written.a).toBeCloseTo(alpha, 3);
}

// A Figma file that starts empty, so Apply has to create every collection and variable.
export interface EmptyFileVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedDataType;
	variableCollectionId: string;
	valuesByMode: Record<string, unknown>;
	description: string;
	scopes: VariableScope[];
	setValueForMode: (modeId: string, value: unknown) => void;
}

export interface EmptyFileCollection {
	id: string;
	name: string;
	modes: { modeId: string; name: string }[];
	variableIds: string[];
	addMode: (name: string) => string;
}

export function activateEmptyFileMock(): { collections: EmptyFileCollection[]; variables: Map<string, EmptyFileVariable> } {
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
export function snapshot(file: ReturnType<typeof activateEmptyFileMock>): Record<string, Record<string, unknown>> {
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
