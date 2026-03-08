import { PLUGIN, UI } from "@common/networkSides";

export const PLUGIN_CHANNEL = PLUGIN.channelBuilder()
  .emitsTo(UI, (message) => {
    figma.ui.postMessage(message);
  })
  .receivesFrom(UI, (next) => {
    const listener: MessageEventHandler = (event) => next(event);
    figma.ui.on("message", listener);
    return () => figma.ui.off("message", listener);
  })
  .startListening();

// ---------- Message handlers

(PLUGIN_CHANNEL as any).registerMessageHandler("message", (data: any) => {
  // Handler is registered here but actual logic is in plugin.ts via subscribe
  // This registration makes the "message" event type available
});
