import * as assert from 'node:assert/strict';

import { condenseModeValues, flattenTokenGroup, nestifyFlatPaths } from '../tokenUtils.ts';
import { TokenGroupSchema } from '../types';
import type { ModeValues, Token, TokenGroup } from '../types';

type TestCase = {
	name: string;
	run: () => void;
};

const tests: TestCase[] = [
	{
		name: 'returns original object when multiple modes exist',
		run: () => {
			const value: ModeValues = { light: '#ffffff', dark: '#000000' };
			const result = condenseModeValues(value);
			assert.strictEqual(result, value);
		},
	},
	{
		name: 'collapses single-mode map to scalar',
		run: () => {
			const value: ModeValues = { light: 42 };
			const result = condenseModeValues(value);
			assert.strictEqual(result, 42);
		},
	},
	{
		name: 'returns empty object when no modes exist',
		run: () => {
			const value: ModeValues = {};
			const result = condenseModeValues(value);
			assert.deepStrictEqual(result, {});
		},
	},
	{
		name: 'nestifyFlatPaths preserves parent token alongside nested children',
		run: () => {
			const parentToken: Token = { $type: 'string', $value: 'button' };
			const childToken: Token = { $type: 'number', $value: 16 };
			const flat = new Map<string, Token>([
				['button', parentToken],
				['button.fontSize', childToken],
			]);
			const result = nestifyFlatPaths(flat);
			const roundTrip = flattenTokenGroup(result);
			assert.strictEqual(roundTrip.get('button'), parentToken);
			assert.strictEqual(roundTrip.get('button.fontSize'), childToken);
		},
	},
	{
		name: 'TokenGroupSchema accepts $self token with nested children',
		run: () => {
			const parentToken: Token = { $type: 'string', $value: 'button' };
			const childToken: Token = { $type: 'number', $value: 16 };
			const parsed = TokenGroupSchema.parse({
				$self: parentToken,
				child: { $self: childToken },
			});
			assert.deepStrictEqual(parsed.$self, parentToken);
			const parsedChild = parsed.child as TokenGroup | undefined;
			assert.ok(parsedChild);
			assert.deepStrictEqual(parsedChild.$self, childToken);
		},
	},
];

for (const test of tests) {
	try {
		test.run();
		console.log(`✅ ${test.name}`);
	} catch (error) {
		console.error(`❌ ${test.name}`);
		throw error;
	}
}

console.log('\ncondenseModeValues tests completed');
