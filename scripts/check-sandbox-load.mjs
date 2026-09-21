// Post-build guard: the plugin bundle must load in Figma's plugin sandbox, which has no BigInt
// (Figma's docs say it does, but the sandbox did not have it when this was found; see the
// `define` for BigInt in vite.config.plugin.ts). Two checks:
//   1. the bundle runs to the end of loading in a context with BigInt deleted;
//   2. no bundled code feature-detects BigInt with `typeof`. The build substitutes a callable
//      Number stand-in for every BigInt reference, so a detection would always answer "yes".
// Usage: node scripts/check-sandbox-load.mjs [path-to-plugin.js]

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const bundlePath = process.argv[2] ?? 'dist/plugin.js';
// The substitution wraps the real name as `(typeof BigInt === "function" ? BigInt : Number)`, so
// a source-level `typeof BigInt` becomes `typeof (typeof BigInt ...`. Tolerates minified spacing.
const LIED_TO_DETECTION = /typeof\s*\(\s*typeof\s+BigInt/;

/** A figma stub that accepts any call, so only genuine load-time failures surface. */
function createFigmaStub() {
	const anything = new Proxy(function () {}, {
		get: (_target, key) => (key === 'then' ? undefined : anything),
		apply: () => anything,
		construct: () => anything,
	});
	return anything;
}

function fail(message) {
	console.error(`check-sandbox-load: ${message}`);
	process.exit(1);
}

let bundle;
try {
	bundle = readFileSync(bundlePath, 'utf8');
} catch (error) {
	fail(`cannot read ${bundlePath}: ${error instanceof Error ? error.message : error}. Build the plugin first.`);
}

if (LIED_TO_DETECTION.test(bundle)) {
	fail(
		`${bundlePath} feature-detects BigInt with typeof, but the build replaces BigInt with a callable stand-in, ` +
		'so the detection would report BigInt as available in the sandbox where it is not. ' +
		'Update or replace the dependency that does this, or narrow the `define` in vite.config.plugin.ts.'
	);
}

const sandbox = createContext({ figma: createFigmaStub(), __html__: '', console: { log() {}, warn() {}, error() {} } });
runInContext('delete globalThis.BigInt', sandbox);
try {
	runInContext(bundle, sandbox);
} catch (error) {
	fail(`${bundlePath} does not load in a sandbox without BigInt: ${error instanceof Error ? error.message : error}`);
}

console.log(`check-sandbox-load: ${bundlePath} loads in a sandbox without BigInt.`);
