import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyToVariables } from '../variableWriter';
import { MODE_ID, COLLECTION_NAME, BASE_ID, createVariable, activateFigmaMock } from './writerTestKit';

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
