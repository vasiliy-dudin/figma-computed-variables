import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@core/types';
import { importVariablesToJSON } from '../variableReader';

const MODE_ID = 'mode-1';
const MODE_NAME = 'Mode 1';
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
						valuesByMode: { [MODE_ID]: byId.get(id)!.value },
					}
					: null,
		},
	});
}

function alias(id: string): { type: 'VARIABLE_ALIAS'; id: string } {
	return { type: 'VARIABLE_ALIAS', id };
}

function composeColor(targetId: string, percent: number): unknown {
	return {
		type: 'VARIABLE_EXPRESSION',
		expressionFunction: 'COMPOSE_COLOR',
		expressionArguments: [alias(targetId), percent],
	};
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
