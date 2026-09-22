import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenJSON } from '@core/types';
import { applyToVariables } from '../variableWriter';
import { activateEmptyFileMock, snapshot } from './writerTestKit';

// The example that motivated walking alpha() chains: glass is brand at 50 %, and onGlass is
// glass at 50 % — 25 % of brand. Figma replaces a base's alpha, so onGlass is written as a
// reference to brand at 25 % rather than to glass at 50 % (which would paint 50 %).
const example: TokenJSON = {
	foundation: {
		color: {
			brand: { $type: 'color', $value: '#0066FF' },
			glass: { $type: 'color', $value: 'alpha({color.brand}, 50%)' },
		},
	},
	semantic: {
		onGlass: { $type: 'color', $value: 'alpha({color.glass}, 50%)' },
	},
};

describe('applyToVariables — alpha() over alpha()', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('writes the chain as a reference to the opaque root with the multiplied percentage', async () => {
		const file = activateEmptyFileMock();

		const result = await applyToVariables(example);

		expect(result.errors).toEqual([]);
		const values = snapshot(file);
		expect(values['foundation/color/glass']['Mode 1']).toEqual({ color: { alias: 'foundation/color/brand' }, opacity: 50 });
		expect(values['semantic/onGlass']['Mode 1']).toEqual({ color: { alias: 'foundation/color/brand' }, opacity: 25 });
		expect(result.preservedComposedColors).toBe(0);
		expect(result.rejectedComposedColors).toBe(0);
	});

	it('changes nothing on a second Apply', async () => {
		const file = activateEmptyFileMock();
		await applyToVariables(example);
		const afterFirst = snapshot(file);

		const second = await applyToVariables(example);

		expect(second.errors).toEqual([]);
		expect(snapshot(file)).toEqual(afterFirst);
	});

	// Nothing to walk to: a literal with its own transparency has no opaque variable behind it.
	it('keeps a translucent literal base as the computed colour', async () => {
		const file = activateEmptyFileMock();

		await applyToVariables({
			foundation: { glass: { $type: 'color', $value: '#0066FF80' } },
			semantic: { onGlass: { $type: 'color', $value: 'alpha({glass}, 50%)' } },
		});

		const written = snapshot(file)['semantic/onGlass']['Mode 1'] as { a: number; color?: unknown };
		expect(written.color).toBeUndefined();
		expect(written.a).toBeCloseTo((128 / 255) * 0.5, 3);
	});

	// A chain is writable, so "leave untouched" does not apply: the value follows the JSON. A
	// Figma-authored {glass, 42} therefore becomes {brand, 21}, which is what alpha({glass}, 42%)
	// means; Import is what keeps such values' paint (task 3), by importing them as alpha({brand}, 42%).
	it('rewrites an existing composed colour over an alpha() token to match the JSON', async () => {
		const file = activateEmptyFileMock();
		await applyToVariables(example);
		const onGlass = [...file.variables.values()].find(v => v.name === 'onGlass')!;
		const glass = [...file.variables.values()].find(v => v.name === 'color/glass')!;
		const modeId = Object.keys(onGlass.valuesByMode)[0];
		onGlass.setValueForMode(modeId, { color: { type: 'VARIABLE_ALIAS', id: glass.id }, opacity: 42 });

		const result = await applyToVariables({ ...example, semantic: { onGlass: { $type: 'color', $value: 'alpha({color.glass}, 42%)' } } });

		expect(result.preservedComposedColors).toBe(0);
		expect(snapshot(file)['semantic/onGlass']['Mode 1']).toEqual({ color: { alias: 'foundation/color/brand' }, opacity: 21 });
	});
});
