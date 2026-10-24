import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSON_EDITOR_INDENT } from '@core/orderedJson';
import type { SavedTokens, TokenJSON } from '@core/types';
import { loadJSON, saveJSON } from '../storage';

const FILE_ID_KEY = 'computed-variables-file-id';
const STORAGE_KEY_PREFIX = 'computed-variables-json';
const LEGACY_FILE_ID = 'legacy-file';

interface RootMock {
	getPluginData: (key: string) => string;
	setPluginData: (key: string, value: string) => void;
}

interface ClientStorageMock {
	getAsync: (key: string) => Promise<unknown>;
	setAsync: (key: string, value: unknown) => Promise<void>;
}

function createRootMock(pluginData: Map<string, string>): RootMock {
	return {
		getPluginData: (key: string) => pluginData.get(key) ?? '',
		setPluginData: (key: string, value: string) => {
			pluginData.set(key, value);
		},
	};
}

function createClientStorageMock(storage: Map<string, unknown>): ClientStorageMock {
	return {
		getAsync: async (key: string) => storage.get(key),
		setAsync: async (key: string, value: unknown) => {
			storage.set(key, value);
		},
	};
}

function createFailingClientStorageMock(overrides: Partial<ClientStorageMock>): ClientStorageMock {
	return {
		getAsync: async () => undefined,
		setAsync: async () => {},
		...overrides,
	};
}

function activateFigmaMock(pluginData: Map<string, string>, clientStorage: ClientStorageMock): void {
	vi.stubGlobal('figma', {
		root: createRootMock(pluginData),
		clientStorage,
	});
}

function sampleJSON(value: number): TokenJSON {
	return {
		foundation: {
			spacing: {
				$self: { $type: 'number', $value: value },
			},
		},
	};
}

function sampleText(value: number): string {
	return JSON.stringify(sampleJSON(value), null, JSON_EDITOR_INDENT);
}

function savedTokens(value: number): SavedTokens {
	return { json: sampleJSON(value), jsonText: sampleText(value) };
}

describe('storage', () => {
	let pluginData: Map<string, string>;
	let storage: Map<string, unknown>;

	beforeEach(() => {
		pluginData = new Map();
		storage = new Map();
		activateFigmaMock(pluginData, createClientStorageMock(storage));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns null when nothing has been saved', async () => {
		expect(await loadJSON()).toBeNull();
	});

	it('round-trips saved JSON within a single file', async () => {
		await saveJSON(sampleText(8));
		expect(await loadJSON()).toEqual(savedTokens(8));
	});

	// Parsing the text into an object would hoist integer-like keys ("100") above "base".
	it('returns the saved text unchanged, keeping key order and formatting', async () => {
		const text = '{"palette": {"gray": {\n"base": {"$type": "number", "$value": 1},\n"100": {"$type": "number", "$value": 2}}}}';
		await saveJSON(text);
		expect((await loadJSON())?.jsonText).toBe(text);
	});

	it('loads an entry saved by an older version as a compact JSON string', async () => {
		pluginData.set(FILE_ID_KEY, LEGACY_FILE_ID);
		storage.set(`${STORAGE_KEY_PREFIX}:${LEGACY_FILE_ID}`, JSON.stringify(sampleJSON(8)));
		expect(await loadJSON()).toEqual(savedTokens(8));
	});

	it('rejects a stored entry of an unknown format', async () => {
		pluginData.set(FILE_ID_KEY, LEGACY_FILE_ID);
		storage.set(`${STORAGE_KEY_PREFIX}:${LEGACY_FILE_ID}`, { unexpected: true });
		await expect(loadJSON()).rejects.toThrow('Failed to load JSON');
	});

	it('generates the file id once and reuses it on subsequent saves', async () => {
		await saveJSON(sampleText(8));
		const idAfterFirstSave = pluginData.get(FILE_ID_KEY);
		expect(idAfterFirstSave).toBeTruthy();

		await saveJSON(sampleText(16));
		expect(pluginData.get(FILE_ID_KEY)).toBe(idAfterFirstSave);
	});

	it('isolates storage between different files sharing the same clientStorage', async () => {
		const fileA = pluginData;
		await saveJSON(sampleText(8));

		const fileB = new Map<string, string>();
		activateFigmaMock(fileB, createClientStorageMock(storage));
		expect(await loadJSON()).toBeNull();
		await saveJSON(sampleText(16));

		activateFigmaMock(fileA, createClientStorageMock(storage));
		expect(await loadJSON()).toEqual(savedTokens(8));
	});

	it('wraps clientStorage failures on save', async () => {
		activateFigmaMock(
			pluginData,
			createFailingClientStorageMock({
				setAsync: async () => {
					throw new Error('disk full');
				},
			}),
		);

		await expect(saveJSON(sampleText(8))).rejects.toThrow('Failed to save JSON: disk full');
	});

	it('wraps clientStorage failures on load', async () => {
		activateFigmaMock(
			pluginData,
			createFailingClientStorageMock({
				getAsync: async () => {
					throw new Error('corrupt');
				},
			}),
		);

		await expect(loadJSON()).rejects.toThrow('Failed to load JSON: corrupt');
	});
});
