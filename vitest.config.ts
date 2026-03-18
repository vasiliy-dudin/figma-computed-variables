import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	test: {
		include: ['src/**/__tests__/**/*.test.ts'],
	},
	resolve: {
		alias: {
			'@core': path.resolve('src/core'),
			'@common': path.resolve('src/common'),
		},
	},
});
