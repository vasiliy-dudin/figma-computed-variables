import { PLUGIN } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import { Networker } from "monorepo-networker";
import { loadJSON, saveJSON } from "@plugin/storage";
import { importVariablesToJSON } from "@plugin/variableReader";
import { applyToVariables } from "@plugin/variableWriter";
import { validate, validateSchema } from "@core/validator";
import { sendToUI, onUIMessage } from "@plugin/messaging";
import type { ApplyStatus } from "@core/messages";
import type { TokenJSON } from "@core/types";

let pendingApply: TokenJSON | null = null;
let applyStatus: ApplyStatus = 'idle';
let applyInFlight = false;

async function bootstrap() {
	Networker.initialize(PLUGIN, PLUGIN_CHANNEL);

	figma.showUI(__html__, {
		width: 900,
		height: 700,
		title: "Computed Variables",
		themeColors: true,
	});

	console.log("Computed Variables plugin initialized");
	sendApplyStatus(applyStatus);

	// Load saved JSON and check for existing variables on startup
	try {
		const savedJSON = await loadJSON();
		sendToUI({ type: 'LOAD_JSON', json: savedJSON });

		const collections = await figma.variables.getLocalVariableCollectionsAsync();
		const hasVariables = collections.length > 0;
		const hasSavedJSON = savedJSON !== null && Object.keys(savedJSON).length > 0;
		sendToUI({ type: 'STARTUP_INFO', hasVariables: hasVariables || hasSavedJSON });
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
					queueApply(msg.json);
					break;
				}

				case 'SAVE_JSON': {
					const schemaResult = validateSchema(msg.json);
					if (!schemaResult.valid) {
						sendToUI({ type: 'SAVE_ERROR', error: 'Cannot save: invalid JSON structure' });
						break;
					}
					await saveJSON(schemaResult.data);
					sendToUI({ type: 'SAVE_SUCCESS' });
					break;
				}

				case 'RESIZE_WINDOW': {
					figma.ui.resize(msg.width, msg.height);
					break;
				}
			}
		} catch (err) {
			console.error("Error handling message:", err);
			const errorMessage = err instanceof Error ? err.message : String(err);
			if (msg.type === 'SAVE_JSON') {
				sendToUI({ type: 'SAVE_ERROR', error: errorMessage });
			} else {
				sendToUI({
					type: 'APPLY_ERROR',
					errors: [{
						collection: 'unknown',
						token: 'unknown',
						errorType: 'schema',
						message: errorMessage
					}]
				});
			}
		}
	});
}

bootstrap();

function queueApply(json: TokenJSON): void {
	const validationResult = validate(json);
	if (!validationResult.valid) {
		sendToUI({ type: 'APPLY_ERROR', errors: validationResult.errors });
		return;
	}

	pendingApply = validationResult.data;
	if (applyInFlight) {
		if (applyStatus !== 'queued') {
			sendApplyStatus('queued');
		}
		return;
	}

	void processApplyQueue();
}

async function processApplyQueue(): Promise<void> {
	if (applyInFlight) return;
	const next = pendingApply;
	if (!next) {
		sendApplyStatus('idle');
		return;
	}

	pendingApply = null;
	applyInFlight = true;
	sendApplyStatus('running');

	try {
		const result = await applyToVariables(next);
		if (result.errors.length > 0) {
			sendToUI({ type: 'APPLY_ERROR', errors: result.errors });
		} else {
			sendToUI({ type: 'APPLY_SUCCESS', message: result.message });
		}
	} catch (err) {
		console.error('Error applying variables:', err);
		const message = err instanceof Error ? err.message : String(err);
		sendToUI({
			type: 'APPLY_ERROR',
			errors: [{
				collection: 'unknown',
				token: 'unknown',
				errorType: 'schema',
				message,
			}],
		});
	} finally {
		applyInFlight = false;
		if (pendingApply) {
			sendApplyStatus('queued');
			void processApplyQueue();
		} else {
			sendApplyStatus('idle');
		}
	}
}

function sendApplyStatus(state: ApplyStatus): void {
	applyStatus = state;
	sendToUI({ type: 'APPLY_STATUS', state });
}
