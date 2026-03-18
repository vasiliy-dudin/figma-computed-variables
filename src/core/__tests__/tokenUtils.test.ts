import { describe, it, expect } from 'vitest';
import { condenseModeValues, flattenTokenGroup, nestifyFlatPaths } from '../tokenUtils.ts';
import { TokenGroupSchema } from '../types';
import type { ModeValues, Token, TokenGroup } from '../types';

describe('condenseModeValues', () => {
	it('returns original object when multiple modes exist', () => {
		const value: ModeValues = { light: '#ffffff', dark: '#000000' };
		expect(condenseModeValues(value)).toBe(value);
	});

	it('collapses single-mode map to scalar', () => {
		const value: ModeValues = { light: 42 };
		expect(condenseModeValues(value)).toBe(42);
	});

	it('returns empty object when no modes exist', () => {
		const value: ModeValues = {};
		expect(condenseModeValues(value)).toEqual({});
	});
});

describe('nestifyFlatPaths / flattenTokenGroup', () => {
	it('preserves parent token alongside nested children after round-trip', () => {
		const parentToken: Token = { $type: 'string', $value: 'button' };
		const childToken: Token = { $type: 'number', $value: 16 };
		const flat = new Map<string, Token>([
			['button', parentToken],
			['button.fontSize', childToken],
		]);
		const result = nestifyFlatPaths(flat);
		const roundTrip = flattenTokenGroup(result);
		expect(roundTrip.get('button')).toBe(parentToken);
		expect(roundTrip.get('button.fontSize')).toBe(childToken);
	});
});

describe('TokenGroupSchema', () => {
	it('accepts $self token with nested children', () => {
		const parentToken: Token = { $type: 'string', $value: 'button' };
		const childToken: Token = { $type: 'number', $value: 16 };
		const parsed = TokenGroupSchema.parse({
			$self: parentToken,
			child: { $self: childToken },
		});
		expect(parsed.$self).toEqual(parentToken);
		const parsedChild = parsed.child as TokenGroup | undefined;
		expect(parsedChild).toBeDefined();
		expect(parsedChild!.$self).toEqual(childToken);
	});
});
