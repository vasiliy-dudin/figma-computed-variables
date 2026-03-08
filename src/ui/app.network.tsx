import { PLUGIN, UI } from "@common/networkSides";

export const UI_CHANNEL = UI.channelBuilder()
  .emitsTo(PLUGIN, (message) => {
    parent.postMessage({ pluginMessage: message }, "*");
  })
  .receivesFrom(PLUGIN, (next) => {
    const listener = (event: MessageEvent) => {
      if (event.data?.pluginId == null) return;
      next(event.data.pluginMessage);
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  })
  .startListening();

// ---------- Message handlers

(UI_CHANNEL as any).registerMessageHandler("message", (data: any) => {
  // Handler is registered here but actual logic is in app.tsx via subscribe
  // This registration makes the "message" event type available
});
