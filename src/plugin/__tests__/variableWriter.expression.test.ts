import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RGBA, TokenJSON } from '@core/types';
import { resolveToken } from '@core/resolver';
import { createTokenMap } from '@core/tokenUtils';
import { applyToVariables } from '../variableWriter';
import { activateEmptyFileMock, snapshot } from './writerTestKit';

const MODE = 'Mode 1';

// The example that motivated expression amounts: a hover state at twice the base opacity.
const example: TokenJSON = {
	semantic: {
		'on-primary': { $type: 'color', $value: '#0066FF' },
		'hover-opacity': { $type: 'number', $value: '8%' },
		'on-primary-hover': { $type: 'color', $value: 'alpha({on-primary}, {hover-opacity} * 2)' },
	},
};

describe('applyToVariables — expression amounts', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('writes a reference to the base colour with the computed opacity', async () => {
		const file = activateEmptyFileMock();

		const result = await applyToVariables(example);

		expect(result.errors).toEqual([]);
		expect(snapshot(file)['semantic/on-primary-hover'][MODE]).toEqual({ color: { alias: 'semantic/on-primary' }, opacity: 16 });
	});

	it('changes nothing on a second Apply', async () => {
		const file = activateEmptyFileMock();
		await applyToVariables(example);
		const afterFirst = snapshot(file);

		const second = await applyToVariables(example);

		expect(second.errors).toEqual([]);
		expect(snapshot(file)).toEqual(afterFirst);
	});

	it('writes the computed colour over a translucent base', async () => {
		const file = activateEmptyFileMock();
		const translucent: TokenJSON = {
			semantic: { ...example.semantic, 'on-primary': { $type: 'color', $value: '#0066FF80' } },
		};

		await applyToVariables(translucent);

		const expected = resolveToken('semantic.on-primary-hover', MODE, createTokenMap(translucent));
		const written = snapshot(file)['semantic/on-primary-hover'][MODE] as RGBA & { color?: unknown };
		expect(written.color).toBeUndefined();
		expect(expected.isAlias).toBe(false);
		expect(written.a).toBeCloseTo((expected.value as RGBA).a, 6);
	});

	it('computes the opacity per mode', async () => {
		const file = activateEmptyFileMock();
		const modes: TokenJSON = {
			semantic: {
				'on-primary': { $type: 'color', $value: { 'Mode 1': '#0066FF', 'Mode 2': '#3388FF' } },
				'hover-opacity': { $type: 'number', $value: { 'Mode 1': '8%', 'Mode 2': '8%' } },
				'on-primary-hover': {
					$type: 'color',
					$value: { 'Mode 1': 'alpha({on-primary}, {hover-opacity} * 2)', 'Mode 2': 'alpha({on-primary}, {hover-opacity} * 3)' },
				},
			},
		};

		await applyToVariables(modes);

		const hover = snapshot(file)['semantic/on-primary-hover'];
		expect(hover['Mode 1']).toEqual({ color: { alias: 'semantic/on-primary' }, opacity: 16 });
		expect(hover['Mode 2']).toEqual({ color: { alias: 'semantic/on-primary' }, opacity: 24 });
	});
});
