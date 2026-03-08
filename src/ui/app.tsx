import { PLUGIN } from "@common/networkSides";
import { UI_CHANNEL } from "@ui/app.network";
import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { JsonEditor } from "@ui/components/JsonEditor";
import { Toolbar } from "@ui/components/Toolbar";
import { ErrorDisplay } from "@ui/components/ErrorDisplay";
import { StatusBar } from "@ui/components/StatusBar";
import { DEFAULT_TOKEN_JSON } from "@core/constants";
import { countTokens } from "@core/tokenUtils";
import { validate } from "@core/validator";
import type { TokenJSON, ValidationError } from "@core/types";
import type { UIToPluginMessage, PluginToUIMessage } from "@core/messages";

function App() {
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(DEFAULT_TOKEN_JSON, null, 2));
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);

  // Listen for messages from plugin
  useEffect(() => {
    (UI_CHANNEL as any).subscribe("message", (data: unknown) => {
      const msg = data as PluginToUIMessage;
      
      switch (msg.type) {
        case 'LOAD_JSON':
          if (msg.json) {
            setJsonText(JSON.stringify(msg.json, null, 2));
            updateStats(msg.json);
          }
          break;
          
        case 'IMPORT_SUCCESS':
          setJsonText(JSON.stringify(msg.json, null, 2));
          updateStats(msg.json);
          setErrors([]);
          console.log("Import successful");
          break;
          
        case 'IMPORT_ERROR':
          setErrors([{
            collection: 'import',
            token: '',
            errorType: 'schema',
            message: msg.error
          }]);
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
          setErrors([{
            collection: 'save',
            token: '',
            errorType: 'schema',
            message: msg.error
          }]);
          break;
      }
    });
  }, []);

  // Validate JSON when it changes
  useEffect(() => {
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

  function handleImport() {
    const msg: UIToPluginMessage = { type: 'IMPORT_VARIABLES' };
    (UI_CHANNEL as any).emit(PLUGIN, "message", [msg]);
  }

  function handleApply() {
    try {
      const parsed = JSON.parse(jsonText);
      const msg: UIToPluginMessage = {
        type: 'APPLY_TO_VARIABLES',
        json: parsed
      };
      (UI_CHANNEL as any).emit(PLUGIN, "message", [msg]);
    } catch (err) {
      setErrors([{
        collection: 'json',
        token: '',
        errorType: 'syntax',
        message: `Cannot apply: ${err instanceof Error ? err.message : String(err)}`
      }]);
    }
  }

  function handleSave() {
    try {
      const parsed = JSON.parse(jsonText);
      const msg: UIToPluginMessage = {
        type: 'SAVE_JSON',
        json: parsed
      };
      (UI_CHANNEL as any).emit(PLUGIN, "message", [msg]);
    } catch (err) {
      setErrors([{
        collection: 'json',
        token: '',
        errorType: 'syntax',
        message: `Cannot save: ${err instanceof Error ? err.message : String(err)}`
      }]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        onImport={handleImport}
        onApply={handleApply}
        onSave={handleSave}
        hasErrors={errors.length > 0}
      />
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <JsonEditor value={jsonText} onChange={setJsonText} />
      </div>
      
      {errors.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <ErrorDisplay errors={errors} />
        </div>
      )}
      
      <StatusBar tokenCount={tokenCount} collectionCount={collectionCount} />
    </div>
  );
}

export default App;
