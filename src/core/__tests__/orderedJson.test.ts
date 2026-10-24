import { describe, expect, it } from 'vitest';
import { fromPlainJson, JSON_EDITOR_INDENT, parseOrderedJson, stringifyOrderedJson, toPlainJson } from '../orderedJson.ts';

describe('parseOrderedJson', () => {
	// JSON.parse would list "100" and "50" before "base".
	it('keeps integer-like keys in written order', () => {
		const parsed = parseOrderedJson('{"gray": {"base": 1, "100": 2, "50": 3}}');
		const gray = parsed instanceof Map ? parsed.get('gray') : undefined;

		expect(gray instanceof Map ? [...gray.keys()] : null).toEqual(['base', '100', '50']);
	});

	it('reads values exactly as JSON.parse does', () => {
		const text = '{"a\\"b:": "x\\": {\\"y\\": 1}", "list": [1, -2.5e3, true, null, {"k": "v"}], "u": "\\u00e9", "": {}}';

		expect(toPlainJson(parseOrderedJson(text))).toEqual(JSON.parse(text));
	});

	// The key markers shift every position after them; the message must point at the user's text.
	it('throws the error JSON.parse gives for the original text', () => {
		const invalid = '{"first": 1, "second": 2, "third": }';
		const expected = ((): string => {
			try {
				JSON.parse(invalid);
				return 'no error';
			} catch (err) {
				return err instanceof Error ? err.message : String(err);
			}
		})();

		expect(() => parseOrderedJson(invalid)).toThrow(expected);
	});
});

describe('stringifyOrderedJson', () => {
	it('writes Maps in their insertion order', () => {
		const value = new Map([['base', 1], ['100', 2]]);

		expect(stringifyOrderedJson(value)).toBe('{\n  "base": 1,\n  "100": 2\n}');
	});

	it('matches JSON.stringify output when no key is integer-like', () => {
		const plain = { a: { b: [1, 'two', { c: null }], empty: {}, none: [] }, text: 'Say "hi"\nthere', flag: false };

		expect(stringifyOrderedJson(fromPlainJson(plain))).toBe(JSON.stringify(plain, null, JSON_EDITOR_INDENT));
	});

	it('round-trips text written in the editor format', () => {
		const text = '{\n  "gray": {\n    "base": 1,\n    "100": [\n      2,\n      3\n    ]\n  }\n}';

		expect(stringifyOrderedJson(parseOrderedJson(text))).toBe(text);
	});
});

describe('fromPlainJson', () => {
	// JSON.stringify drops them as well.
	it('leaves out undefined object properties', () => {
		expect(fromPlainJson({ a: 1, b: undefined })).toEqual(new Map([['a', 1]]));
	});
});
