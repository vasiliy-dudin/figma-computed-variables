import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenJSON } from '@core/types';
import { loadJSON, saveJSON } from '../storage';

const FILE_ID_KEY = 'computed-variables-file-id';

interface RootMock {
	getPluginData: (key: string) => string;
	setPluginData: (key: string, value: string) => void;
}

interface ClientStorageMock {
	getAsync: (key: string) => Promise<string | undefined>;
	setAsync: (key: string, value: string) => Promise<void>;
}

function createRootMock(pluginData: Map<string, string>): RootMock {
	return {
		getPluginData: (key: string) => pluginData.get(key) ?? '',
		setPluginData: (key: string, value: string) => {
			pluginData.set(key, value);
		},
	};
}

function createClientStorageMock(storage: Map<string, string>): ClientStorageMock {
	return {
		getAsync: async (key: string) => storage.get(key),
		setAsync: async (key: string, value: string) => {
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

describe('storage', () => {
	let pluginData: Map<string, string>;
	let storage: Map<string, string>;

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
		const json = sampleJSON(8);
		await saveJSON(json);
		expect(await loadJSON()).toEqual(json);
	});

	it('generates the file id once and reuses it on subsequent saves', async () => {
		await saveJSON(sampleJSON(8));
		const idAfterFirstSave = pluginData.get(FILE_ID_KEY);
		expect(idAfterFirstSave).toBeTruthy();

		await saveJSON(sampleJSON(16));
		expect(pluginData.get(FILE_ID_KEY)).toBe(idAfterFirstSave);
	});

	it('isolates storage between different files sharing the same clientStorage', async () => {
		const fileA = pluginData;
		await saveJSON(sampleJSON(8));

		const fileB = new Map<string, string>();
		activateFigmaMock(fileB, createClientStorageMock(storage));
		expect(await loadJSON()).toBeNull();
		await saveJSON(sampleJSON(16));

		activateFigmaMock(fileA, createClientStorageMock(storage));
		expect(await loadJSON()).toEqual(sampleJSON(8));
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

		await expect(saveJSON(sampleJSON(8))).rejects.toThrow('Failed to save JSON: disk full');
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
