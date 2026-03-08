import { PLUGIN } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import { Networker } from "monorepo-networker";
import { loadJSON, saveJSON } from "@plugin/storage";
import { importVariablesToJSON } from "@plugin/variableReader";
import { applyToVariables } from "@plugin/variableWriter";
import { validate } from "@core/validator";
import { sendToUI, onUIMessage } from "@plugin/messaging";

async function bootstrap() {
	Networker.initialize(PLUGIN, PLUGIN_CHANNEL);

	figma.showUI(__html__, {
		width: 900,
		height: 700,
		title: "Computed Variables",
		themeColors: true,
	});

	console.log("Computed Variables plugin initialized");

	// Load saved JSON and check for existing variables on startup
	try {
		const savedJSON = await loadJSON();
		sendToUI({ type: 'LOAD_JSON', json: savedJSON });

		const collections = await figma.variables.getLocalVariableCollectionsAsync();
		sendToUI({ type: 'STARTUP_INFO', hasVariables: collections.length > 0 });
	} catch (err) {
		console.error("Error loading saved JSON:", err);
	}

	// Listen for messages from UI
	onUIMessage(async (msg) => {
		try {
			switch (msg.type) {
				case 'IMPORT_VARIABLES': {
					const json = await importVariablesToJSON();
					sendToUI({ type: 'IMPORT_SUCCESS', json });
					break;
				}

				case 'APPLY_TO_VARIABLES': {
					const validationResult = validate(msg.json);
					if (!validationResult.valid) {
						sendToUI({ type: 'APPLY_ERROR', errors: validationResult.errors });
						break;
					}
					const message = await applyToVariables(validationResult.data);
					sendToUI({ type: 'APPLY_SUCCESS', message });
					break;
				}

				case 'SAVE_JSON': {
					const validationResult = validate(msg.json);
					if (!validationResult.valid) {
						sendToUI({ type: 'SAVE_ERROR', error: 'Cannot save invalid JSON' });
						break;
					}
					await saveJSON(validationResult.data);
					sendToUI({ type: 'SAVE_SUCCESS' });
					break;
				}
			}
		} catch (err) {
			console.error("Error handling message:", err);
			sendToUI({
				type: 'APPLY_ERROR',
				errors: [{
					collection: 'unknown',
					token: 'unknown',
					errorType: 'schema',
					message: err instanceof Error ? err.message : String(err)
				}]
			});
		}
	});
}

bootstrap();
