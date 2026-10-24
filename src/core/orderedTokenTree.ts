import { fromPlainJson, OrderedJsonObject, OrderedJsonValue, stringifyOrderedJson } from './orderedJson';
import { Token, TokenGroup, TokenJSON } from './types';

// A plain object always lists integer-like keys ("50", "100") first, in ascending order,
// whatever order they were added in. Import builds the tree as Maps so the Figma panel
// order of tokens and groups survives into the editor text, and Apply re-ranks what it
// creates by the order the text was written in.
export type OrderedTokenGroup = Map<string, Token | OrderedTokenGroup>;

/** A collection read from Figma: its token tree, and its mode names in Figma's order. */
export interface OrderedCollection {
	tokens: OrderedTokenGroup;
	modeNames: string[];
}

/** Written order of one collection: flat token paths and mode names, each first occurrence once. */
export interface CollectionOrder {
	tokenPaths: string[];
	modeNames: string[];
}

/** Written order of a whole TokenJSON; the Map's own key order is the collection order. */
export type TokenJSONOrder = Map<string, CollectionOrder>;

const SELF_KEY = '$self';
const TYPE_KEY = '$type';
const VALUE_KEY = '$value';

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
	const group: OrderedTokenGroup = existing ? new Map([[SELF_KEY, existing]]) : new Map();
	parent.set(name, group);
	return group;
}

function setLeaf(parent: OrderedTokenGroup, name: string, token: Token): void {
	const existing = parent.get(name);
	if (existing instanceof Map) {
		existing.set(SELF_KEY, token);
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
	const modes = ordered instanceof Map ? ordered.get(VALUE_KEY) : undefined;
	if (ordered instanceof Map && modes instanceof Map) {
		ordered.set(VALUE_KEY, new Map(sortByWrittenOrder([...modes], ([modeName]) => modeName, modeNames)));
	}
	return ordered;
}

/**
 * Written order of the collections, tokens and modes in a parsed editor text; returns an
 * empty order for a document that is not an object. Token paths follow flattenTokenGroup.
 */
export function readWrittenOrder(document: OrderedJsonValue): TokenJSONOrder {
	const order: TokenJSONOrder = new Map();
	if (!(document instanceof Map)) return order;

	for (const [collectionName, group] of document) {
		const collectionOrder: CollectionOrder = { tokenPaths: [], modeNames: [] };
		if (group instanceof Map) collectGroupOrder(group, '', collectionOrder);
		order.set(collectionName, collectionOrder);
	}
	return order;
}

function collectGroupOrder(group: OrderedJsonObject, path: string, order: CollectionOrder): void {
	// Same walk as flattenTokenGroup: a group's own $self token comes before its children.
	const self = group.get(SELF_KEY);
	if (self instanceof Map && path) collectToken(self, path, order);

	for (const [name, node] of group) {
		if (name === SELF_KEY || !(node instanceof Map)) continue;
		const childPath = path ? `${path}.${name}` : name;
		if (node.has(TYPE_KEY)) {
			collectToken(node, childPath, order);
		} else {
			collectGroupOrder(node, childPath, order);
		}
	}
}

function collectToken(token: OrderedJsonObject, path: string, order: CollectionOrder): void {
	order.tokenPaths.push(path);
	const modes = token.get(VALUE_KEY);
	if (!(modes instanceof Map)) return;

	for (const modeName of modes.keys()) {
		if (!order.modeNames.includes(modeName)) order.modeNames.push(modeName);
	}
}

/** Sort by each key's position in writtenOrder; returns a new array with unknown keys last, in their original order. */
export function sortByWrittenOrder<T>(items: T[], keyOf: (item: T) => string, writtenOrder: string[]): T[] {
	const positions = new Map(writtenOrder.map((key, position) => [key, position]));
	const ranked = items.map((item, index) => ({ item, index, rank: positions.get(keyOf(item)) ?? writtenOrder.length }));
	// The index tie-break keeps the result independent of whether the engine's sort is stable.
	ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
	return ranked.map(({ item }) => item);
}
