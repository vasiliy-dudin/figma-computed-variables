import { TokenJSON, Token, ValidationError } from '@core/types';
import { TYPE_MAP } from '@core/constants';
import { flattenTokenGroup, isExcluded } from '@core/tokenUtils';
import type { VariableIndex } from '@plugin/variableIndex';

// The mode a collection gets when its tokens name none.
const DEFAULT_MODE_NAME = 'Mode 1';

/** A variable that exists in Figma and is ready to receive its token's values. */
export interface PreparedVariable {
	collectionName: string;
	collection: VariableCollection;
	tokenPath: string;
	token: Token;
	variable: Variable;
	figmaType: VariableResolvedDataType;
}

/**
 * First pass of Apply: creates every collection, mode and variable the JSON needs and sets
 * their descriptions and scopes, without writing any values. Doing this before any value is
 * written means a reference to a collection defined later in the JSON resolves on the first
 * Apply. Problems are appended to `errors`; the tokens they affect are left out.
 */
export function prepareVariables(
	json: TokenJSON,
	collections: VariableCollection[],
	index: VariableIndex,
	errors: ValidationError[]
): PreparedVariable[] {
	const prepared: PreparedVariable[] = [];

	for (const [collectionName, tokens] of Object.entries(json)) {
		if (isExcluded(collectionName)) continue;
		const collection = findOrCreateCollection(collectionName, collections, index);
		const flatTokens = flattenTokenGroup(tokens);
		addMissingModes(collection, flatTokens);

		for (const [tokenPath, token] of flatTokens) {
			if (tokenPath.split('.').some(isExcluded)) continue;
			const entry = prepareVariable(collectionName, collection, tokenPath, token, index, errors);
			if (entry) prepared.push(entry);
		}
	}

	return prepared;
}

function findOrCreateCollection(name: string, collections: VariableCollection[], index: VariableIndex): VariableCollection {
	const existing = collections.find(c => c.name === name);
	if (existing) return existing;

	const created = figma.variables.createVariableCollection(name);
	index.addCollection(created);
	return created;
}

function addMissingModes(collection: VariableCollection, flatTokens: Map<string, Token>): void {
	const modes = new Set<string>();
	for (const token of flatTokens.values()) {
		if (typeof token.$value !== 'string' && typeof token.$value !== 'number') {
			for (const mode of Object.keys(token.$value)) {
				modes.add(mode);
			}
		}
	}

	const existingModes = collection.modes.map(m => m.name);
	for (const modeName of modes) {
		if (!existingModes.includes(modeName)) {
			collection.addMode(modeName);
		}
	}
	if (modes.size === 0 && existingModes.length === 0) {
		collection.addMode(DEFAULT_MODE_NAME);
	}
}

function prepareVariable(
	collectionName: string,
	collection: VariableCollection,
	tokenPath: string,
	token: Token,
	index: VariableIndex,
	errors: ValidationError[]
): PreparedVariable | null {
	const figmaType = TYPE_MAP[token.$type];
	if (!figmaType) {
		errors.push({ collection: collectionName, token: tokenPath, errorType: 'schema', message: `Unknown token type: "${token.$type}"` });
		return null;
	}

	try {
		const variable = findOrCreateVariable(collection, tokenPath, figmaType, index);
		applyMetadata(variable, token);
		return { collectionName, collection, tokenPath, token, variable, figmaType };
	} catch (err) {
		errors.push({ collection: collectionName, token: tokenPath, errorType: 'schema', message: err instanceof Error ? err.message : String(err) });
		return null;
	}
}

function findOrCreateVariable(
	collection: VariableCollection,
	tokenPath: string,
	figmaType: VariableResolvedDataType,
	index: VariableIndex
): Variable {
	// Figma uses '/' for variable groups; dot-path maps to slash-path
	const figmaName = tokenPath.replace(/\./g, '/');
	const existing = index.findInCollection(collection, figmaName);
	if (existing) return existing;

	const created = figma.variables.createVariable(figmaName, collection, figmaType);
	index.add(collection, created);
	return created;
}

function applyMetadata(variable: Variable, token: Token): void {
	if (token.$description !== undefined) {
		variable.description = token.$description;
	}
	if (token.$scope !== undefined) {
		const scopes = Array.isArray(token.$scope) ? token.$scope : [token.$scope];
		variable.scopes = scopes as VariableScope[];
	}
}
