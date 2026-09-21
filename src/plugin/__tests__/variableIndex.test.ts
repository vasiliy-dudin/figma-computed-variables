import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVariableIndex } from '../variableIndex';

interface FakeVariable {
	id: string;
	name: string;
}

interface FakeCollection {
	id: string;
	name: string;
	variableIds: string[];
}

function variable(id: string, name: string): FakeVariable {
	return { id, name };
}

function collection(id: string, name: string, variables: FakeVariable[]): FakeCollection {
	return { id, name, variableIds: variables.map(v => v.id) };
}

/** Stubs figma.variables and returns a counter of getVariableByIdAsync calls. */
function activateFigmaMock(variables: FakeVariable[]): { lookups: () => number } {
	const byId = new Map(variables.map(v => [v.id, v]));
	let lookups = 0;
	vi.stubGlobal('figma', {
		variables: {
			getVariableByIdAsync: async (id: string) => {
				lookups++;
				return byId.get(id) ?? null;
			},
		},
	});
	return { lookups: () => lookups };
}

async function indexOver(collections: FakeCollection[], variables: FakeVariable[]) {
	const counter = activateFigmaMock(variables);
	const index = await buildVariableIndex(collections as unknown as VariableCollection[]);
	return { index, counter };
}

const PRIMARY = variable('V1', 'color/primary');
const SPACING = variable('V2', 'spacing/base');
const OTHER_PRIMARY = variable('V3', 'color/primary');

describe('buildVariableIndex — lookup rules', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves a bare path across collections', async () => {
		const { index } = await indexOver(
			[collection('C1', 'foundation', [PRIMARY]), collection('C2', 'semantic', [SPACING])],
			[PRIMARY, SPACING],
		);
		expect(index.find('color.primary')).toBe(PRIMARY);
		expect(index.find('spacing.base')).toBe(SPACING);
	});

	it('returns the first match in collection order for a bare path', async () => {
		const { index } = await indexOver(
			[collection('C1', 'foundation', [PRIMARY]), collection('C2', 'semantic', [OTHER_PRIMARY])],
			[PRIMARY, OTHER_PRIMARY],
		);
		expect(index.find('color.primary')).toBe(PRIMARY);
	});

	it('limits a collection-prefixed path to that collection', async () => {
		const { index } = await indexOver(
			[collection('C1', 'foundation', [PRIMARY]), collection('C2', 'semantic', [OTHER_PRIMARY])],
			[PRIMARY, OTHER_PRIMARY],
		);
		expect(index.find('semantic.color.primary')).toBe(OTHER_PRIMARY);
		expect(index.find('semantic.spacing.base')).toBeNull();
	});

	it('treats a first segment that is not a collection as part of a bare path', async () => {
		const { index } = await indexOver([collection('C1', 'foundation', [PRIMARY])], [PRIMARY]);
		expect(index.find('color.primary')).toBe(PRIMARY);
	});

	it('searches every collection sharing the prefixed name, in order', async () => {
		const { index } = await indexOver(
			[collection('C1', 'tokens', []), collection('C2', 'tokens', [SPACING])],
			[SPACING],
		);
		expect(index.find('tokens.spacing.base')).toBe(SPACING);
	});

	it('keeps the pre-existing limitation for a collection name that contains a dot', async () => {
		const { index } = await indexOver([collection('C1', 'my.system', [PRIMARY])], [PRIMARY]);
		expect(index.find('my.system.color.primary')).toBeNull();
	});

	it('returns null for an unknown path', async () => {
		const { index } = await indexOver([collection('C1', 'foundation', [PRIMARY])], [PRIMARY]);
		expect(index.find('color.missing')).toBeNull();
	});

	it('finds a variable by Figma name within one collection only', async () => {
		const foundation = collection('C1', 'foundation', [PRIMARY]);
		const semantic = collection('C2', 'semantic', []);
		const { index } = await indexOver([foundation, semantic], [PRIMARY]);
		expect(index.findInCollection(foundation as unknown as VariableCollection, 'color/primary')).toBe(PRIMARY);
		expect(index.findInCollection(semantic as unknown as VariableCollection, 'color/primary')).toBeNull();
	});
});

describe('buildVariableIndex — changes made during Apply', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves a variable added after the index was built', async () => {
		const foundation = collection('C1', 'foundation', []);
		const { index } = await indexOver([foundation], []);
		index.add(foundation as unknown as VariableCollection, PRIMARY as unknown as Variable);
		expect(index.find('color.primary')).toBe(PRIMARY);
		expect(index.find('foundation.color.primary')).toBe(PRIMARY);
	});

	it('recognises a collection created during Apply as a prefix', async () => {
		const { index } = await indexOver([], []);
		const created = collection('C9', 'brand', []) as unknown as VariableCollection;
		index.addCollection(created);
		index.add(created, SPACING as unknown as Variable);
		expect(index.find('brand.spacing.base')).toBe(SPACING);
	});
});

describe('buildVariableIndex — cost', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches each variable once, however many lookups follow', async () => {
		const variables = Array.from({ length: 200 }, (_, i) => variable('V' + i, 'token/' + i));
		const { index, counter } = await indexOver([collection('C1', 'foundation', variables)], variables);

		for (let lookup = 0; lookup < 500; lookup++) {
			index.find('token.' + (lookup % 200));
		}

		expect(counter.lookups()).toBe(200);
	});
});
