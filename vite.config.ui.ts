import { defineConfig } from "vite";
import path from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";
import react from "@vitejs/plugin-react";
import richSvg from "vite-plugin-react-rich-svg";
import postcssUrl from "postcss-url";
import type { AcceptedPlugin } from "postcss";

const inlineUrlPlugin = postcssUrl({ url: "inline" }) as AcceptedPlugin;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [react(), richSvg(), viteSingleFile()],
	root: path.resolve("src/ui"),
	build: {
		minify: mode === "production",
		cssMinify: mode === "production",
		sourcemap: mode !== "production" ? "inline" : false,
		emptyOutDir: false,
		outDir: path.resolve("dist"),
		rollupOptions: {
			input: path.resolve("src/ui/index.html"),
			external: (id) => {
				// Externalize CSS imports from @create-figma-plugin/ui
				return id.startsWith('!') && id.includes('.css');
			},
		},
	},
	css: {
		postcss: {
			plugins: [inlineUrlPlugin],
		},
		preprocessorOptions: {
			scss: {},
		},
	},
	resolve: {
		alias: {
			"@common": path.resolve("src/common"),
			"@ui": path.resolve("src/ui"),
			"@core": path.resolve("src/core"),
			"react": "preact/compat",
			"react-dom": "preact/compat",
			"react/jsx-runtime": "preact/jsx-runtime",
		},
	},
}));
