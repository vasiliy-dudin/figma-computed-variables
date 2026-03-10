import * as assert from 'node:assert/strict';

import { condenseModeValues } from '../tokenUtils.ts';
import type { ModeValues } from '../types';

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
