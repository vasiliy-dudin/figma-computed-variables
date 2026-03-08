import { PLUGIN } from "@common/networkSides";
import { UI_CHANNEL } from "@ui/app.network";
import type { UIToPluginMessage, PluginToUIMessage } from "@core/messages";

/** Send a typed message from the UI to the plugin. */
export function sendToPlugin(msg: UIToPluginMessage): void {
  UI_CHANNEL.emit(PLUGIN, "message", [msg]);
}

/** Subscribe to typed messages from the plugin. Returns an unsubscribe function. */
export function onPluginMessage(
  handler: (msg: PluginToUIMessage) => void
): () => void {
  return UI_CHANNEL.subscribe("message", (msg) => {
    handler(msg);
  });
}
