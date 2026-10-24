// A plain object always lists integer-like keys ("50", "100") first, in ascending order,
// whatever order they were added or written in. A Map keeps that order, so JSON whose key
// order matters (the editor text) is read and written through these types.
export type OrderedJsonValue = null | boolean | number | string | OrderedJsonValue[] | OrderedJsonObject;
export type OrderedJsonObject = Map<string, OrderedJsonValue>;

// Matches JSON.stringify(value, null, 2), the format the editor shows everywhere else.
export const JSON_EDITOR_INDENT = '  ';

// Put in front of every key before JSON.parse, so that no key is integer-like and the parsed
// object keeps the written order; taken off again when the object becomes a Map. JSON.parse
// still does all the parsing, so values and errors are exactly its own.
const KEY_MARKER = '#';

const QUOTE = '"';
const BACKSLASH = '\\';
const KEY_SEPARATOR = ':';
const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/** Parse JSON text keeping the written key order; returns objects as Maps and throws like JSON.parse. */
export function parseOrderedJson(text: string): OrderedJsonValue {
	return toOrdered(JSON.parse(markKeys(text)), key => key.slice(KEY_MARKER.length));
}

/** Convert a plain JSON-compatible value; returns objects as Maps in their own key order. */
export function fromPlainJson(value: unknown): OrderedJsonValue {
	return toOrdered(value, key => key);
}

/** Convert back to plain objects; returns a value whose integer-like keys lose their order. */
export function toPlainJson(value: OrderedJsonValue): unknown {
	if (value instanceof Map) {
		// fromEntries defines own properties, so a "__proto__" key stays data, as with JSON.parse.
		return Object.fromEntries([...value].map(([key, item]) => [key, toPlainJson(item)]));
	}
	if (Array.isArray(value)) return value.map(toPlainJson);
	return value;
}

/** Serialize in Map order; returns text formatted like JSON.stringify(value, null, 2). */
export function stringifyOrderedJson(value: OrderedJsonValue): string {
	return stringifyAt(value, 0);
}

function stringifyAt(value: OrderedJsonValue, depth: number): string {
	if (value instanceof Map) {
		const entries = [...value].map(([key, item]) => `${JSON.stringify(key)}: ${stringifyAt(item, depth + 1)}`);
		return wrapEntries(entries, '{', '}', depth);
	}
	if (Array.isArray(value)) {
		return wrapEntries(value.map(item => stringifyAt(item, depth + 1)), '[', ']', depth);
	}
	return JSON.stringify(value);
}

function wrapEntries(entries: string[], open: string, close: string, depth: number): string {
	if (entries.length === 0) return `${open}${close}`;

	const childIndent = JSON_EDITOR_INDENT.repeat(depth + 1);
	return `${open}\n${childIndent}${entries.join(`,\n${childIndent}`)}\n${JSON_EDITOR_INDENT.repeat(depth)}${close}`;
}

function toOrdered(value: unknown, keyName: (key: string) => string): OrderedJsonValue {
	if (Array.isArray(value)) return value.map(item => toOrdered(item, keyName));
	if (typeof value === 'object' && value !== null) {
		const entries = Object.entries(value).filter(([, item]) => item !== undefined);
		return new Map(entries.map(([key, item]) => [keyName(key), toOrdered(item, keyName)]));
	}
	if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	throw new Error(`[toOrdered] Not a JSON value: ${typeof value}`);
}

// Outside string literals JSON has no quotes, so every quote found here opens a string;
// the string is a key when the next non-whitespace character is a colon.
function markKeys(text: string): string {
	let marked = '';
	let index = 0;
	while (index < text.length) {
		const stringStart = text.indexOf(QUOTE, index);
		if (stringStart === -1) break;

		const stringEnd = findStringEnd(text, stringStart);
		const isKey = text[skipWhitespace(text, stringEnd + 1)] === KEY_SEPARATOR;
		marked += text.slice(index, stringStart + 1) + (isKey ? KEY_MARKER : '') + text.slice(stringStart + 1, stringEnd + 1);
		index = stringEnd + 1;
	}
	return marked + text.slice(index);
}

function findStringEnd(text: string, stringStart: number): number {
	let index = stringStart + 1;
	while (index < text.length && text[index] !== QUOTE) {
		index += text[index] === BACKSLASH ? 2 : 1;
	}
	return index;
}

function skipWhitespace(text: string, from: number): number {
	let index = from;
	while (index < text.length && JSON_WHITESPACE.has(text[index])) {
		index++;
	}
	return index;
}
