import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { PluginToUIMessage, UIToPluginMessage } from '@core/messages';
import { activateEmptyFileMock } from './writerTestKit';

// plugin.ts starts itself on import; these stand in for the Figma channel it talks through.
vi.mock('monorepo-networker', () => ({ Networker: { initialize: vi.fn() } }));
vi.mock('@common/networkSides', () => ({ PLUGIN: {}, UI: {} }));
vi.mock('@plugin/plugin.network', () => ({ PLUGIN_CHANNEL: {} }));
vi.mock('@plugin/messaging', () => ({ sendToUI: vi.fn(), onUIMessage: vi.fn() }));

const FILE_ID = 'file-1';
const STORAGE_KEY = `computed-variables-json:${FILE_ID}`;

// A plain object lists "2024" and "100" first; the plugin must keep the order as written.
const WRITTEN_TEXT = `{
  "semantic": {
    "gray": {
      "base": { "$type": "number", "$value": 1 },
      "100": { "$type": "number", "$value": 2 }
    }
  },
  "2024": { "size": { "$type": "number", "$value": 4 } }
}`;

type UIMessageHandler = (msg: UIToPluginMessage) => Promise<void> | void;
type SendToUI = Mock<(msg: PluginToUIMessage) => void>;

interface StartedPlugin {
	handleMessage: UIMessageHandler;
	sent: SendToUI;
}

/** Add what plugin.ts needs beyond figma.variables to the stubbed figma global. */
function addPluginHost(storage: Map<string, unknown>): void {
	const figmaGlobal = (globalThis as unknown as { figma: Record<string, unknown> }).figma;
	Object.assign(figmaGlobal, {
		showUI: () => {},
		ui: { resize: () => {} },
		root: { getPluginData: () => FILE_ID, setPluginData: () => {} },
		clientStorage: {
			getAsync: async (key: string) => storage.get(key),
			setAsync: async (key: string, value: unknown) => {
				storage.set(key, value);
			},
		},
	});
	vi.stubGlobal('__html__', '');
}

/** Load a fresh plugin.ts, as Figma does when the plugin opens; returns its UI message handler. */
async function startPlugin(): Promise<StartedPlugin> {
	// resetModules re-runs plugin.ts but keeps the mocked messaging functions, so clear their calls.
	vi.clearAllMocks();
	vi.resetModules();
	const messaging = await import('@plugin/messaging');
	await import('../plugin');

	const onUIMessage = vi.mocked(messaging.onUIMessage);
	await vi.waitFor(() => expect(onUIMessage).toHaveBeenCalled());
	return { handleMessage: onUIMessage.mock.calls[0][0], sent: vi.mocked(messaging.sendToUI) };
}

function sentOfType<T extends PluginToUIMessage['type']>(sent: SendToUI, type: T): Extract<PluginToUIMessage, { type: T }>[] {
	return sent.mock.calls
		.map(([message]) => message)
		.filter((message): message is Extract<PluginToUIMessage, { type: T }> => message.type === type);
}

describe('plugin messages — written order', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('Apply creates collections and variables in the order the text is written', async () => {
		const file = activateEmptyFileMock();
		addPluginHost(new Map());
		const { handleMessage, sent } = await startPlugin();

		await handleMessage({ type: 'APPLY_TO_VARIABLES', jsonText: WRITTEN_TEXT });
		await vi.waitFor(() => expect(sentOfType(sent, 'APPLY_SUCCESS')).toHaveLength(1));

		expect(file.collections.map(c => c.name)).toEqual(['semantic', '2024']);
		expect(file.collections[0].variableIds.map(id => file.variables.get(id)?.name)).toEqual(['gray/base', 'gray/100']);
	});

	it('Save stores the text as written, and the next start loads it unchanged', async () => {
		const storage = new Map<string, unknown>();
		activateEmptyFileMock();
		addPluginHost(storage);
		const firstRun = await startPlugin();

		await firstRun.handleMessage({ type: 'SAVE_JSON', jsonText: WRITTEN_TEXT });
		expect(sentOfType(firstRun.sent, 'SAVE_SUCCESS')).toHaveLength(1);
		expect(storage.get(STORAGE_KEY)).toEqual({ jsonText: WRITTEN_TEXT });

		const secondRun = await startPlugin();
		expect(sentOfType(secondRun.sent, 'LOAD_JSON').map(message => message.saved?.jsonText)).toEqual([WRITTEN_TEXT]);
	});
});
