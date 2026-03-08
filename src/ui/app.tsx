import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { JsonEditor } from "@ui/components/JsonEditor";
import { Toolbar } from "@ui/components/Toolbar";
import { ErrorDisplay } from "@ui/components/ErrorDisplay";
import { StatusBar } from "@ui/components/StatusBar";
import { EmptyState } from "@ui/components/EmptyState";
import { ResizeHandle } from "@ui/components/ResizeHandle";
import { EXAMPLE_TOKEN_JSON } from "@core/constants";
import { countTokens } from "@core/tokenUtils";
import { validate } from "@core/validator";
import type { TokenJSON, ValidationError } from "@core/types";
import { sendToPlugin, onPluginMessage } from "@ui/messaging";

function App() {
	const [jsonText, setJsonText] = useState<string>("");
	const [errors, setErrors] = useState<ValidationError[]>([]);
	const [tokenCount, setTokenCount] = useState(0);
	const [collectionCount, setCollectionCount] = useState(0);
	const [showEmptyState, setShowEmptyState] = useState(false);

	// Listen for messages from plugin
	useEffect(() => {
		return onPluginMessage((msg) => {
			switch (msg.type) {
				case 'LOAD_JSON':
					if (msg.json) {
						setJsonText(JSON.stringify(msg.json, null, 2));
						updateStats(msg.json);
						setShowEmptyState(false);
					}
					break;

				case 'IMPORT_SUCCESS':
					setJsonText(JSON.stringify(msg.json, null, 2));
					updateStats(msg.json);
					setErrors([]);
					console.log("Import successful");
					break;

				case 'IMPORT_ERROR':
					setErrors([{ collection: 'import', token: '', errorType: 'schema', message: msg.error }]);
					break;

        case 'APPLY_SUCCESS':
					console.log(msg.message);
					setErrors([]);
					break;

				case 'APPLY_ERROR':
					setErrors(msg.errors);
					break;

				case 'SAVE_SUCCESS':
					console.log("JSON saved");
					setErrors([]);
					break;

				case 'SAVE_ERROR':
					setErrors([{ collection: 'save', token: '', errorType: 'schema', message: msg.error }]);
					break;

				case 'STARTUP_INFO':
					if (!msg.hasVariables) {
						setShowEmptyState(true);
					}
					break;
			}
		});
	}, []);

	// Validate JSON when it changes
	useEffect(() => {
		if (jsonText.trim() === '') {
			setErrors([]);
			setTokenCount(0);
			setCollectionCount(0);
			return;
		}

		try {
			const parsed = JSON.parse(jsonText);
			const result = validate(parsed);
			
			if (result.valid) {
				setErrors([]);
				updateStats(result.data);
			} else {
				// Type narrowing: if not valid, result has errors property
				setErrors(result.errors);
			}
		} catch (err) {
			setErrors([{
				collection: 'json',
				token: '',
				errorType: 'syntax',
				message: `JSON Parse Error: ${err instanceof Error ? err.message : String(err)}`
			}]);
		}
	}, [jsonText]);

	function updateStats(json: TokenJSON) {
		setTokenCount(countTokens(json));
		setCollectionCount(Object.keys(json).length);
	}

	function handleLoadExample(): void {
		setJsonText(JSON.stringify(EXAMPLE_TOKEN_JSON, null, 2));
		setShowEmptyState(false);
	}

	function handleStartFromScratch(): void {
		setJsonText("");
		setShowEmptyState(false);
	}

	function handleImport(): void {
		sendToPlugin({ type: 'IMPORT_VARIABLES' });
	}

	function handleApply(): void {
		try {
			const parsed = JSON.parse(jsonText);
			sendToPlugin({ type: 'APPLY_TO_VARIABLES', json: parsed });
		} catch (err) {
			setErrors([{
				collection: 'json',
				token: '',
				errorType: 'syntax',
				message: `Cannot apply: ${err instanceof Error ? err.message : String(err)}`
			}]);
		}
	}

	function handleSave(): void {
		try {
			const parsed = JSON.parse(jsonText);
			sendToPlugin({ type: 'SAVE_JSON', json: parsed });
		} catch (err) {
			setErrors([{
				collection: 'json',
				token: '',
				errorType: 'syntax',
				message: `Cannot save: ${err instanceof Error ? err.message : String(err)}`
			}]);
		}
	}

	if (showEmptyState) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
				<EmptyState
					onLoadExample={handleLoadExample}
					onStartFromScratch={handleStartFromScratch}
				/>
				<ResizeHandle />
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
			<div style={{ flex: 1, overflow: 'hidden' }}>
				<JsonEditor value={jsonText} onChange={setJsonText} />
			</div>

			{errors.length > 0 && (
				<div style={{ flexShrink: 0 }}>
					<ErrorDisplay errors={errors} />
				</div>
			)}

			<Toolbar
				onImport={handleImport}
				onApply={handleApply}
				onSave={handleSave}
				hasErrors={errors.length > 0}
				isEmpty={jsonText.trim() === ''}
			/>
			
			<StatusBar tokenCount={tokenCount} collectionCount={collectionCount} />
			<ResizeHandle />
		</div>
	);
}

export default App;
