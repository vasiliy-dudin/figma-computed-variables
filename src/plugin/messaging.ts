import { UI } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import type { PluginToUIMessage, UIToPluginMessage } from "@core/messages";

/** Send a typed message from the plugin to the UI. */
export function sendToUI(msg: PluginToUIMessage): void {
	PLUGIN_CHANNEL.emit(UI, "message", [msg]);
}

/** Subscribe to typed messages from the UI. Returns an unsubscribe function. */
export function onUIMessage(
	handler: (msg: UIToPluginMessage) => Promise<void> | void
): () => void {
	return PLUGIN_CHANNEL.subscribe("message", (msg) => {
		void handler(msg);
	});
}
