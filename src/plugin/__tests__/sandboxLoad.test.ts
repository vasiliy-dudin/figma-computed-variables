import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Builds the real plugin bundle and runs scripts/check-sandbox-load.mjs on it, so `pnpm test`
// catches what `pnpm build`'s postbuild step catches: a dependency update that stops the plugin
// loading in Figma's sandbox, which has no BigInt. Both modes, because `pnpm dev` ships the
// development build to Figma and that is where the original crash was seen.
const BUILD_TIMEOUT_MS = 60_000;
const outRoot = mkdtempSync(path.join(tmpdir(), 'plugin-sandbox-load-'));

afterAll(() => {
	rmSync(outRoot, { recursive: true, force: true });
});

async function buildPlugin(mode: 'production' | 'development'): Promise<string> {
	const outDir = path.join(outRoot, mode);
	await build({
		configFile: path.resolve('vite.config.plugin.ts'),
		mode,
		logLevel: 'silent',
		build: { outDir, emptyOutDir: true },
	});
	return path.join(outDir, 'plugin.js');
}

function checkSandboxLoad(bundlePath: string): { status: number | null; output: string } {
	const result = spawnSync(process.execPath, [path.resolve('scripts/check-sandbox-load.mjs'), bundlePath], { encoding: 'utf8' });
	return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('plugin bundle loads in a sandbox without BigInt', () => {
	it.each(['production', 'development'] as const)('%s build', async (mode) => {
		const check = checkSandboxLoad(await buildPlugin(mode));

		expect(check.output).toContain('loads in a sandbox without BigInt');
		expect(check.status).toBe(0);
	}, BUILD_TIMEOUT_MS);
});
