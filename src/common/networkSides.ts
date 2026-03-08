import { Networker } from "monorepo-networker";
import type { PluginToUIMessage, UIToPluginMessage } from "@core/messages";

export const UI = Networker.createSide("UI-side").listens<{
  message(msg: PluginToUIMessage): void;
}>();

export const PLUGIN = Networker.createSide("Plugin-side").listens<{
  message(msg: UIToPluginMessage): void;
}>();
