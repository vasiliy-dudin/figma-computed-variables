import { PLUGIN, UI } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import { Networker } from "monorepo-networker";
import { loadJSON, saveJSON } from "@plugin/storage";
import { importVariablesToJSON } from "@plugin/variableReader";
import { applyToVariables } from "@plugin/variableWriter";
import { validate } from "@core/validator";
import type { UIToPluginMessage, PluginToUIMessage } from "@core/messages";

async function bootstrap() {
  Networker.initialize(PLUGIN, PLUGIN_CHANNEL);

  figma.showUI(__html__, {
    width: 900,
    height: 700,
    title: "Computed Variables",
    themeColors: true,
  });

  console.log("Computed Variables plugin initialized");

  // Load saved JSON on startup
  try {
    const savedJSON = await loadJSON();
    const message: PluginToUIMessage = {
      type: 'LOAD_JSON',
      json: savedJSON
    };
    (PLUGIN_CHANNEL as any).emit(UI, "message", [message]);
  } catch (err) {
    console.error("Error loading saved JSON:", err);
  }

  // Listen for messages from UI
  (PLUGIN_CHANNEL as any).subscribe("message", async (data: unknown) => {
    const msg = data as UIToPluginMessage;
    
    try {
      switch (msg.type) {
        case 'IMPORT_VARIABLES': {
          const json = await importVariablesToJSON();
          const response: PluginToUIMessage = {
            type: 'IMPORT_SUCCESS',
            json
          };
          (PLUGIN_CHANNEL as any).emit(UI, "message", [response]);
          break;
        }
        
        case 'APPLY_TO_VARIABLES': {
          // Validate before applying
          const validationResult = validate(msg.json);
          
          if (!validationResult.valid) {
            const response: PluginToUIMessage = {
              type: 'APPLY_ERROR',
              errors: validationResult.errors
            };
            (PLUGIN_CHANNEL as any).emit(UI, "message", [response]);
            break;
          }
          
          // Apply to Figma Variables
          const message = await applyToVariables(validationResult.data);
          const response: PluginToUIMessage = {
            type: 'APPLY_SUCCESS',
            message
          };
          (PLUGIN_CHANNEL as any).emit(UI, "message", [response]);
          break;
        }
        
        case 'SAVE_JSON': {
          // Validate before saving
          const validationResult = validate(msg.json);
          
          if (!validationResult.valid) {
            const response: PluginToUIMessage = {
              type: 'SAVE_ERROR',
              error: 'Cannot save invalid JSON'
            };
            (PLUGIN_CHANNEL as any).emit(UI, "message", [response]);
            break;
          }
          
          await saveJSON(validationResult.data);
          const response: PluginToUIMessage = {
            type: 'SAVE_SUCCESS'
          };
          (PLUGIN_CHANNEL as any).emit(UI, "message", [response]);
          break;
        }
      }
    } catch (err) {
      console.error("Error handling message:", err);
      const response: PluginToUIMessage = {
        type: 'APPLY_ERROR',
        errors: [{
          collection: 'unknown',
          token: 'unknown',
          errorType: 'schema',
          message: err instanceof Error ? err.message : String(err)
        }]
      };
      (PLUGIN_CHANNEL as any).emit(UI, "message", [response]);
    }
  });
}

bootstrap();
