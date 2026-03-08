import { TokenJSON, ResolvedValue, RGBA } from '@core/types';
import { TYPE_MAP } from '@core/constants';
import { createTokenMap } from '@core/tokenUtils';
import { resolveToken, hexToRgba } from '@core/resolver';

/**
 * Apply token JSON to Figma Variables
 * Updates existing collections/variables, creates missing ones, merges modes
 */
export async function applyToVariables(json: TokenJSON): Promise<string> {
  let totalVariables = 0;
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  
  for (const [collectionName, tokens] of Object.entries(json)) {
    // 1. Find or create collection
    let collection = collections.find(c => c.name === collectionName);
    if (!collection) {
      collection = figma.variables.createVariableCollection(collectionName);
    }
    
    // 2. Extract and merge modes
    const modes = new Set<string>();
    for (const token of Object.values(tokens)) {
      for (const mode of Object.keys(token.$value)) {
        modes.add(mode);
      }
    }
    
    const existingModes = collection.modes.map(m => m.name);
    for (const modeName of modes) {
      if (!existingModes.includes(modeName)) {
        collection.addMode(modeName);
      }
    }
    
    // 3. Create token map for resolution
    const tokenMap = createTokenMap(json);
    
    // 4. Create or update variables
    const collectionVariables = collection.variableIds
      .map(id => figma.variables.getVariableById(id))
      .filter(Boolean) as Variable[];
    
    for (const [tokenPath, token] of Object.entries(tokens)) {
      const figmaType = TYPE_MAP[token.$type];
      if (!figmaType) {
        console.warn(`Unknown token type: ${token.$type} for ${tokenPath}`);
        continue;
      }
      
      // Find or create variable
      let variable = collectionVariables.find(v => v.name === tokenPath);
      if (!variable) {
        variable = figma.variables.createVariable(tokenPath, collection, figmaType);
      }
      
      // Set values for each mode
      for (const mode of collection.modes) {
        const modeValue = token.$value[mode.name];
        if (modeValue === undefined) continue;
        
        try {
          const fullPath = `${collectionName}.${tokenPath}`;
          const resolved = resolveToken(fullPath, mode.name, tokenMap);
          
          setVariableValue(variable, mode.modeId, resolved, figmaType);
        } catch (err) {
          console.error(`Error setting value for ${collectionName}.${tokenPath} (${mode.name}):`, err);
        }
      }
      
      totalVariables++;
    }
  }
  
  return `Applied ${totalVariables} variables across ${Object.keys(json).length} collections`;
}

/**
 * Set a variable value (handles both aliases and computed values)
 */
function setVariableValue(
  variable: Variable,
  modeId: string,
  resolved: ResolvedValue,
  figmaType: VariableResolvedDataType
): void {
  if (resolved.isAlias) {
    // Set as native Figma alias
    const targetVariable = findVariableByPath(resolved.targetPath);
    if (targetVariable) {
      variable.setValueForMode(modeId, {
        type: 'VARIABLE_ALIAS',
        id: targetVariable.id
      });
    } else {
      console.warn(`Alias target not found: ${resolved.targetPath}`);
    }
  } else {
    // Set computed value
    const value = convertValueForFigma(resolved.value, figmaType);
    variable.setValueForMode(modeId, value);
  }
}

/**
 * Find a variable by its full path (collection.tokenPath)
 */
function findVariableByPath(path: string): Variable | null {
  const dotIndex = path.indexOf('.');
  if (dotIndex === -1) return null;
  
  const collectionName = path.substring(0, dotIndex);
  const tokenPath = path.substring(dotIndex + 1);
  
  // Find collection
  const collections = figma.variables.getLocalVariableCollections();
  const collection = collections.find(c => c.name === collectionName);
  if (!collection) return null;
  
  // Find variable in collection
  for (const varId of collection.variableIds) {
    const variable = figma.variables.getVariableById(varId);
    if (variable && variable.name === tokenPath) {
      return variable;
    }
  }
  
  return null;
}

/**
 * Convert resolved value to Figma format
 */
function convertValueForFigma(value: string | number | RGBA, figmaType: VariableResolvedDataType): VariableValue {
  switch (figmaType) {
    case 'COLOR':
      if (typeof value === 'object' && 'r' in value) {
        return value;
      }
      return hexToRgba(String(value));
      
    case 'FLOAT':
      return typeof value === 'number' ? value : parseFloat(String(value));
      
    case 'STRING':
      return String(value);
      
    default:
      return String(value);
  }
}
