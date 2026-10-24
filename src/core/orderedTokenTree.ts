import { TOKEN_SELF_KEY, TOKEN_VALUE_KEY } from './constants';
import { fromPlainJson, OrderedJsonObject, OrderedJsonValue, stringifyOrderedJson } from './orderedJson';
import { Token, TokenGroup, TokenJSON } from './types';
import { sortByWrittenOrder } from './writtenOrder';

// A plain object always lists integer-like keys ("50", "100") first, in ascending order,
// whatever order they were added in. Import builds the tree as Maps so the Figma panel
// order of tokens and groups survives into the editor text.
export type OrderedTokenGroup = Map<string, Token | OrderedTokenGroup>;

/** A collection read from Figma: its token tree, and its mode names in Figma's order. */
export interface OrderedCollection {
	tokens: OrderedTokenGroup;
	modeNames: string[];
}

/**
 * Convert a flat Map<dotPath, Token> into a nested tree that keeps insertion order.
 * Returns e.g. Map { "color.primary" → Token } → Map { color → Map { primary → Token } }
 */
export function nestifyFlatPathsOrdered(flat: Map<string, Token>): OrderedTokenGroup {
	const root: OrderedTokenGroup = new Map();
	for (const [path, token] of flat) {
		const parts = path.split('.');
		let current = root;
		for (const part of parts.slice(0, -1)) {
			current = childGroup(current, part);
		}
		setLeaf(current, parts[parts.length - 1], token);
	}
	return root;
}

function childGroup(parent: OrderedTokenGroup, name: string): OrderedTokenGroup {
	const existing = parent.get(name);
	if (existing instanceof Map) return existing;

	// A token that already sits at this path becomes the group's own value.
	const group: OrderedTokenGroup = existing ? new Map([[TOKEN_SELF_KEY, existing]]) : new Map();
	parent.set(name, group);
	return group;
}

function setLeaf(parent: OrderedTokenGroup, name: string, token: Token): void {
	const existing = parent.get(name);
	if (existing instanceof Map) {
		existing.set(TOKEN_SELF_KEY, token);
	} else {
		parent.set(name, token);
	}
}

/** Convert an ordered tree to a plain TokenGroup; returns a group whose integer-like keys lose their order. */
export function toTokenGroup(group: OrderedTokenGroup): TokenGroup {
	const result: TokenGroup = {};
	for (const [name, node] of group) {
		result[name] = node instanceof Map ? toTokenGroup(node) : node;
	}
	return result;
}

/** Convert ordered collections to plain TokenJSON; returns an object keyed by collection name. */
export function toTokenJSON(collections: Map<string, OrderedCollection>): TokenJSON {
	const result: TokenJSON = {};
	for (const [collectionName, { tokens }] of collections) {
		result[collectionName] = toTokenGroup(tokens);
	}
	return result;
}

/** Serialize collections; returns JSON text formatted like JSON.stringify(value, null, 2), in Figma's order. */
export function stringifyCollections(collections: Map<string, OrderedCollection>): string {
	const document: OrderedJsonObject = new Map();
	for (const [collectionName, { tokens, modeNames }] of collections) {
		document.set(collectionName, groupToOrderedJson(tokens, modeNames));
	}
	return stringifyOrderedJson(document);
}

function groupToOrderedJson(group: OrderedTokenGroup, modeNames: string[]): OrderedJsonObject {
	const result: OrderedJsonObject = new Map();
	for (const [name, node] of group) {
		result.set(name, node instanceof Map ? groupToOrderedJson(node, modeNames) : tokenToOrderedJson(node, modeNames));
	}
	return result;
}

// A token's $value is a plain object, so its mode names are put back in the collection's order.
function tokenToOrderedJson(token: Token, modeNames: string[]): OrderedJsonValue {
	const ordered = fromPlainJson(token);
	const modes = ordered instanceof Map ? ordered.get(TOKEN_VALUE_KEY) : undefined;
	if (ordered instanceof Map && modes instanceof Map) {
		ordered.set(TOKEN_VALUE_KEY, new Map(sortByWrittenOrder([...modes], ([modeName]) => modeName, modeNames)));
	}
	return ordered;
}
