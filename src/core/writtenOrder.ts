import { TOKEN_SELF_KEY, TOKEN_TYPE_KEY, TOKEN_VALUE_KEY } from './constants';
import { OrderedJsonObject, OrderedJsonValue } from './orderedJson';

// TokenJSON is a plain object, so it lists integer-like names ("2024", "100") first. Apply
// takes the order from the editor text instead and re-ranks TokenJSON's content by it.

/** Written order of one collection: flat token paths and mode names, each first occurrence once. */
export interface CollectionOrder {
	tokenPaths: string[];
	modeNames: string[];
}

/** Written order of a whole TokenJSON; the Map's own key order is the collection order. */
export type TokenJSONOrder = Map<string, CollectionOrder>;

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
	const self = group.get(TOKEN_SELF_KEY);
	if (self instanceof Map && path) collectToken(self, path, order);

	for (const [name, node] of group) {
		if (name === TOKEN_SELF_KEY || !(node instanceof Map)) continue;
		const childPath = path ? `${path}.${name}` : name;
		if (node.has(TOKEN_TYPE_KEY)) {
			collectToken(node, childPath, order);
		} else {
			collectGroupOrder(node, childPath, order);
		}
	}
}

function collectToken(token: OrderedJsonObject, path: string, order: CollectionOrder): void {
	order.tokenPaths.push(path);
	const modes = token.get(TOKEN_VALUE_KEY);
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
