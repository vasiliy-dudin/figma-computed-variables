import path from "node:path";
import { defineConfig } from "vite";
import generateFile from "vite-plugin-generate-file";
import { viteSingleFile } from "vite-plugin-singlefile";
import figmaManifest from "./figma.manifest";

export default defineConfig(({ mode }) => ({
	plugins: [
		viteSingleFile(),
		generateFile({
			type: "json",
			output: "./manifest.json",
			data: figmaManifest,
		}),
	],
	build: {
		minify: mode === 'production',
		sourcemap: mode !== 'production' ? 'inline' : false,
		target: 'es2017',
		emptyOutDir: false,
		outDir: path.resolve("dist"),
		rollupOptions: {
			input: path.resolve('src/plugin/plugin.ts'),
			output: {
				entryFileNames: 'plugin.js',
			},
		},
	},
	resolve: {
		alias: {
			"@common": path.resolve("src/common"),
			"@plugin": path.resolve("src/plugin"),
			"@core": path.resolve("src/core"),
		},
	},
	define: {
		// Figma's plugin sandbox has no BigInt, although Figma's docs say it does. zod >= 4.6
		// calls BigInt() while loading (its JSON-schema range table), so the plugin crashed
		// before starting. Every BigInt reference in the bundle falls back to Number when the
		// real one is missing; `typeof` never throws, even for an undeclared name. The plugin
		// itself never uses bigints, so the fallback only ever fills that unused table.
		//
		// Limitation: the substitution also rewrites `typeof BigInt`, so code that feature-detects
		// BigInt would be told it exists in the sandbox. None of the bundled dependencies does
		// today. scripts/check-sandbox-load.mjs loads the bundle without BigInt and fails if such a
		// detection ever appears; it runs after `pnpm build` and in `pnpm test`.
		BigInt: '(typeof BigInt === "function" ? BigInt : Number)',
	},
}));
