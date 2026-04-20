import { describe, it, expect } from 'vitest';
import { condenseModeValues, flattenTokenGroup, isExcluded, nestifyFlatPaths } from '../tokenUtils.ts';
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

describe('isExcluded', () => {
	it('returns true for names starting with underscore', () => {
		expect(isExcluded('_TMP')).toBe(true);
		expect(isExcluded('_activated')).toBe(true);
		expect(isExcluded('_')).toBe(true);
	});

	it('returns false for names not starting with underscore', () => {
		expect(isExcluded('TMP')).toBe(false);
		expect(isExcluded('color')).toBe(false);
		expect(isExcluded('')).toBe(false);
	});
});

describe('nestifyFlatPaths / flattenTokenGroup', () => {
	it('skips top-level group keys starting with underscore', () => {
		const visible: Token = { $type: 'number', $value: 1 };
		const hidden: Token = { $type: 'number', $value: 99 };
		const group: TokenGroup = { _hidden: hidden, visible };
		const result = flattenTokenGroup(group);
		expect(result.has('_hidden')).toBe(false);
		expect(result.get('visible')).toBe(visible);
	});

	it('skips token keys starting with underscore inside a nested group', () => {
		const ripple: Token = { $type: 'number', $value: 0.25 };
		const activated: Token = { $type: 'number', $value: 0.12 };
		const group: TokenGroup = { TMP: { _activated: activated, ripple } };
		const result = flattenTokenGroup(group);
		expect(result.has('TMP._activated')).toBe(false);
		expect(result.get('TMP.ripple')).toBe(ripple);
	});

	it('skips an underscore-prefixed group that contains a $self token', () => {
		const selfToken: Token = { $type: 'number', $value: 5 };
		const child: Token = { $type: 'number', $value: 10 };
		const group: TokenGroup = {
			_hidden: { $self: selfToken, child },
			visible: { $type: 'number', $value: 1 },
		};
		const result = flattenTokenGroup(group);
		expect(result.has('_hidden')).toBe(false);
		expect(result.has('_hidden.child')).toBe(false);
		expect(result.has('visible')).toBe(true);
	});

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
