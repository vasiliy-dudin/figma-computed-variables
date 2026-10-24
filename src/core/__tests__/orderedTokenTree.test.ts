import { describe, expect, it } from 'vitest';
import { JSON_EDITOR_INDENT, parseOrderedJson } from '../orderedJson.ts';
import { nestifyFlatPathsOrdered, OrderedCollection, readWrittenOrder, sortByWrittenOrder, stringifyCollections, toTokenJSON } from '../orderedTokenTree.ts';
import type { Token } from '../types';

const COLLECTION_NAME = 'tokens';
const MODE_NAME = 'Mode 1';

function numberToken(value: number): Token {
	return { $type: 'number', $value: value };
}

function collectionOf(flat: Map<string, Token>, modeNames: string[] = [MODE_NAME]): Map<string, OrderedCollection> {
	return new Map([[COLLECTION_NAME, { tokens: nestifyFlatPathsOrdered(flat), modeNames }]]);
}

function collectionOfPaths(paths: string[]): Map<string, OrderedCollection> {
	return collectionOf(new Map(paths.map((path, index) => [path, numberToken(index)])));
}

describe('stringifyCollections', () => {
	// A plain object hoists integer-like keys ("50", "100") above every other key.
	it('keeps integer-like token names in insertion order', () => {
		const text = stringifyCollections(collectionOfPaths(['gray.base', 'gray.800', 'gray.100', 'gray.default', 'gray.50']));
		const groupKeys = [...text.matchAll(/"([^"$]+)": \{/g)].map(m => m[1]);

		expect(groupKeys).toEqual([COLLECTION_NAME, 'gray', 'base', '800', '100', 'default', '50']);
	});

	it('keeps integer-like group names in insertion order', () => {
		const text = stringifyCollections(collectionOfPaths(['spacing.xs', 'spacing.4.inner', 'spacing.2.inner']));

		expect(text.indexOf('"xs"')).toBeLessThan(text.indexOf('"4"'));
		expect(text.indexOf('"4"')).toBeLessThan(text.indexOf('"2"'));
	});

	it('writes mode values in the collection\'s mode order', () => {
		const flat = new Map<string, Token>([['size', { $type: 'number', $value: { Desktop: 3, '2': 2, '1': 1 } }]]);
		const text = stringifyCollections(collectionOf(flat, ['Desktop', '2', '1']));

		expect(text.indexOf('"Desktop"')).toBeLessThan(text.indexOf('"2"'));
		expect(text.indexOf('"2"')).toBeLessThan(text.indexOf('"1"'));
	});

	it('matches JSON.stringify output when no key is integer-like', () => {
		const flat = new Map<string, Token>([
			['color.primary', { $type: 'color', $value: { Light: '#ffffff', Dark: '#000000' }, $description: 'Main' }],
			['color', { $type: 'color', $value: '#ff0000' }],
			['size.gap', { $type: 'number', $value: 8, $scope: ['GAP', 'WIDTH_HEIGHT'] }],
			['size.hidden', { $type: 'number', $value: 0, $scope: [] }],
			['label', { $type: 'string', $value: 'Say "hi"\nthere' }],
		]);
		const collections = collectionOf(flat, ['Light', 'Dark']);

		expect(stringifyCollections(collections)).toBe(JSON.stringify(toTokenJSON(collections), null, JSON_EDITOR_INDENT));
	});

	it('writes an empty collection as {}', () => {
		const collections = collectionOf(new Map());

		expect(stringifyCollections(collections)).toBe(JSON.stringify({ [COLLECTION_NAME]: {} }, null, JSON_EDITOR_INDENT));
	});
});

describe('readWrittenOrder', () => {
	it('lists collections, token paths and mode names in written order', () => {
		const document = parseOrderedJson(`{
			"semantic": {
				"gray": {
					"base": { "$type": "number", "$value": { "Wide": 1, "2": 2 } },
					"100": { "$type": "number", "$value": { "1": 1 } }
				}
			},
			"2024": { "size": { "4": { "$type": "number", "$value": 4 }, "$self": { "$type": "number", "$value": 1 } } }
		}`);
		const order = readWrittenOrder(document);

		expect([...order.keys()]).toEqual(['semantic', '2024']);
		expect(order.get('semantic')).toEqual({ tokenPaths: ['gray.base', 'gray.100'], modeNames: ['Wide', '2', '1'] });
		// flattenTokenGroup lists a group's own $self token before its children.
		expect(order.get('2024')?.tokenPaths).toEqual(['size', 'size.4']);
	});
});

describe('sortByWrittenOrder', () => {
	it('sorts by written position and keeps unknown keys last, in their original order', () => {
		const sorted = sortByWrittenOrder(['100', 'extra', 'base', 'other'], name => name, ['base', '100']);

		expect(sorted).toEqual(['base', '100', 'extra', 'other']);
	});
});
