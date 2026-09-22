import { describe, expect, it } from 'vitest';
import { findComposedRoot, ImportContext } from '../composedRoot';

const HOME = 'home-collection';
const OTHER = 'other-collection';
const LIGHT = 'light';
const DARK = 'dark';
const OTHER_A = 'other-a';
const OTHER_B = 'other-b';

const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });
const composed = (colorId: string, opacity: number) => ({ color: alias(colorId), opacity });
const BLUE = { r: 0, g: 0, b: 1, a: 1 };

function variable(id: string, collectionId: string, valuesByMode: Record<string, unknown>): Variable {
	return { id, name: id, variableCollectionId: collectionId, valuesByMode } as unknown as Variable;
}

/** Everything lives in the home collection unless stated; values are the same in both modes. */
function homeVariable(id: string, value: unknown): Variable {
	return variable(id, HOME, { [LIGHT]: value, [DARK]: value });
}

function context(variables: Variable[], modeId: string = LIGHT): ImportContext {
	return { byId: new Map(variables.map(v => [v.id, v])), collectionId: HOME, modeId };
}

describe('findComposedRoot', () => {
	const brand = homeVariable('brand', BLUE);

	it('returns the target itself when there is no composed colour on the way', () => {
		expect(findComposedRoot('brand', context([brand]))).toBe('brand');
	});

	// The motivating case: {glass, 42} with glass = {brand, 50} paints brand at 42 %.
	it('skips a composed colour to the colour it is made from', () => {
		expect(findComposedRoot('glass', context([brand, homeVariable('glass', composed('brand', 50))]))).toBe('brand');
	});

	it('skips several composed colours', () => {
		const variables = [brand, homeVariable('glass', composed('brand', 50)), homeVariable('frost', composed('glass', 30))];
		expect(findComposedRoot('frost', context(variables))).toBe('brand');
	});

	it('follows a plain alias to a composed colour', () => {
		const variables = [brand, homeVariable('glass', composed('brand', 50)), homeVariable('glassAlias', alias('glass'))];
		expect(findComposedRoot('glassAlias', context(variables))).toBe('brand');
	});

	// Without a composed colour on the way nothing changes, so the name stays the one Figma shows.
	it('keeps a plain alias to an ordinary colour as it is', () => {
		expect(findComposedRoot('brandAlias', context([brand, homeVariable('brandAlias', alias('brand'))]))).toBe('brandAlias');
	});

	it('stops before a composed colour whose colour side is a literal', () => {
		const variables = [homeVariable('tinted', { color: { r: 1, g: 0, b: 0 }, opacity: alias('op') }), homeVariable('tintedAlias', alias('tinted'))];
		expect(findComposedRoot('tinted', context(variables))).toBe('tinted');
		expect(findComposedRoot('tintedAlias', context(variables))).toBe('tintedAlias');
	});

	it('reads a variable in the same collection in the mode being imported', () => {
		const variables = [brand, homeVariable('accent', BLUE), variable('glass', HOME, { [LIGHT]: composed('brand', 50), [DARK]: composed('accent', 50) })];
		expect(findComposedRoot('glass', context(variables, LIGHT))).toBe('brand');
		expect(findComposedRoot('glass', context(variables, DARK))).toBe('accent');
	});

	// Another collection has its own modes; which one Figma uses depends on where the colour is used.
	it('follows a variable in another collection when all its modes agree', () => {
		const glass = variable('glass', OTHER, { [OTHER_A]: composed('brand', 50), [OTHER_B]: composed('brand', 20) });
		expect(findComposedRoot('glass', context([brand, glass]))).toBe('brand');
	});

	it('stops at a variable in another collection whose modes disagree', () => {
		const glass = variable('glass', OTHER, { [OTHER_A]: composed('brand', 50), [OTHER_B]: BLUE });
		expect(findComposedRoot('glass', context([brand, glass]))).toBe('glass');
	});

	it('stops at a variable that is not loaded, such as one from a library', () => {
		expect(findComposedRoot('remote', context([brand]))).toBe('remote');
	});

	it('terminates on a cycle', () => {
		const variables = [homeVariable('a', composed('b', 50)), homeVariable('b', composed('a', 50))];
		expect(['a', 'b']).toContain(findComposedRoot('a', context(variables)));
	});
});
