interface CollectionEntry {
	id: string;
	name: string;
	// Keyed by Figma variable name ('/'-separated), not by token path.
	variables: Map<string, Variable>;
}

/**
 * Every local variable, fetched once per Apply and indexed by collection and name.
 * It replaces a lookup that rescanned every variable in the file for each alias, which is
 * quadratic on alias-heavy files. Lookups follow the rules and order of that scan exactly.
 */
export interface VariableIndex {
	/** Resolves a token path — bare, or prefixed with a collection name — to a variable. */
	find(path: string): Variable | null;
	/** Finds a variable by its Figma name within one collection. */
	findInCollection(collection: VariableCollection, figmaName: string): Variable | null;
	/** Registers a collection created during Apply, so paths prefixed with its name resolve. */
	addCollection(collection: VariableCollection): void;
	/** Registers a variable created during Apply, so later references to it resolve. */
	add(collection: VariableCollection, variable: Variable): void;
}

/** Fetches every variable in the given collections once and returns an index over them. */
export async function buildVariableIndex(collections: VariableCollection[]): Promise<VariableIndex> {
	const entries: CollectionEntry[] = [];

	const entryFor = (collection: VariableCollection): CollectionEntry => {
		const existing = entries.find(entry => entry.id === collection.id);
		if (existing) return existing;
		const created = { id: collection.id, name: collection.name, variables: new Map<string, Variable>() };
		entries.push(created);
		return created;
	};

	// The old scan returned the first match, so the first variable registered under a name wins.
	const add = (collection: VariableCollection, variable: Variable): void => {
		const variables = entryFor(collection).variables;
		if (!variables.has(variable.name)) variables.set(variable.name, variable);
	};

	for (const collection of collections) {
		entryFor(collection);
		const variables = await Promise.all(collection.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
		for (const variable of variables) {
			if (variable) add(collection, variable);
		}
	}

	return {
		find: path => findByPath(entries, path),
		findInCollection: (collection, figmaName) =>
			entries.find(entry => entry.id === collection.id)?.variables.get(figmaName) ?? null,
		addCollection: collection => {
			entryFor(collection);
		},
		add,
	};
}

/**
 * A path has a collection prefix when the segment before its first dot names a collection;
 * otherwise the whole path is a bare token path searched across every collection, in order.
 * Splitting on the first dot means a collection whose own name contains a dot is never
 * recognised as a prefix — a pre-existing limitation, kept so that results do not change.
 */
function findByPath(entries: CollectionEntry[], path: string): Variable | null {
	const dotIndex = path.indexOf('.');
	const prefix = dotIndex === -1 ? null : path.substring(0, dotIndex);
	const hasPrefix = prefix !== null && entries.some(entry => entry.name === prefix);

	const candidates = hasPrefix ? entries.filter(entry => entry.name === prefix) : entries;
	const tokenPath = hasPrefix ? path.substring(dotIndex + 1) : path;
	// Figma uses '/' for variable groups; the plugin's token paths use '.'
	const figmaName = tokenPath.replace(/\./g, '/');

	for (const entry of candidates) {
		const variable = entry.variables.get(figmaName);
		if (variable) return variable;
	}
	return null;
}
