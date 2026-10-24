import { describe, expect, it } from 'vitest';
import { parseOrderedJson } from '../orderedJson.ts';
import { readWrittenOrder, sortByWrittenOrder } from '../writtenOrder.ts';

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
