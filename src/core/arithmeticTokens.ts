// Longest first, so "**" is read before "*".
export const OPERATOR_SYMBOLS = ['**', '*', '/', '%', '+', '-', '(', ')', ','] as const;
export type OperatorSymbol = typeof OPERATOR_SYMBOLS[number];

export type AmountUnit = '%' | 'deg';
const AMOUNT_UNITS: readonly AmountUnit[] = ['%', 'deg'];

export interface TokenizeOptions {
	// Set for a colour function amount: numbers may carry this unit, and "%" is never remainder.
	amountUnit?: AmountUnit;
}

export type ArithmeticToken =
	| { kind: 'number'; value: number; position: number }
	| { kind: 'reference'; path: string; position: number }
	| { kind: 'identifier'; name: string; position: number }
	| { kind: 'operator'; symbol: OperatorSymbol; position: number };

interface ReadResult {
	token: ArithmeticToken;
	length: number;
}

const WHITESPACE = /\s/;
const DECIMAL_LITERAL = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const PREFIXED_LITERAL = /^0(?:[xX][0-9a-fA-F]+|[bB][01]+|[oO][0-7]+)/;
// JS reads "010" as octal 8 in sloppy mode; reject it rather than silently read 10.
const LEADING_ZERO_INTEGER = /^0\d/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/;
const IDENTIFIER_CHAR = /[\w$]/;
const REFERENCE = /^\{([^}]+)\}/;
// JS reads these as increment/decrement, never as two signs, so "8--4" is an error there too.
const UPDATE_OPERATORS = ['++', '--'] as const;

/** Splits an arithmetic expression into tokens; throws on any character arithmetic cannot use. */
export function tokenizeArithmetic(expression: string, options: TokenizeOptions = {}): ArithmeticToken[] {
	const tokens: ArithmeticToken[] = [];
	let position = 0;
	while (position < expression.length) {
		if (WHITESPACE.test(expression[position])) {
			position++;
			continue;
		}
		const { token, length } = readToken(expression.slice(position), position, options);
		tokens.push(token);
		position += length;
	}
	return tokens;
}

function readToken(rest: string, position: number, options: TokenizeOptions): ReadResult {
	return readNumber(rest, position, options)
		?? readReference(rest, position)
		?? readIdentifier(rest, position)
		?? readOperator(rest, position, options);
}

function readNumber(rest: string, position: number, options: TokenizeOptions): ReadResult | null {
	const prefixed = rest.match(PREFIXED_LITERAL);
	const match = prefixed ?? rest.match(DECIMAL_LITERAL);
	if (!match) return null;

	const text = match[0];
	const length = text.length + unitLength(rest, text.length, position, options);
	const followedByWordChar = IDENTIFIER_CHAR.test(rest.charAt(length));
	if (followedByWordChar || (!prefixed && LEADING_ZERO_INTEGER.test(text))) {
		throw new Error(`Invalid number at position ${position + 1}: "${rest.match(/^[\w$.%]+/)?.[0] ?? text}".`);
	}
	return { token: { kind: 'number', value: Number(text), position }, length };
}

// Length of the amount unit written right after a number, 0 when there is none.
function unitLength(rest: string, offset: number, position: number, options: TokenizeOptions): number {
	if (!options.amountUnit) return 0;
	const unit = AMOUNT_UNITS.find(candidate => rest.startsWith(candidate, offset));
	if (!unit) return 0;
	if (unit !== options.amountUnit) {
		throw new Error(`Use ${options.amountUnit} in this amount, not ${unit} (position ${position + 1}).`);
	}
	return unit.length;
}

function readReference(rest: string, position: number): ReadResult | null {
	const match = rest.match(REFERENCE);
	if (!match) return null;
	return { token: { kind: 'reference', path: match[1], position }, length: match[0].length };
}

function readIdentifier(rest: string, position: number): ReadResult | null {
	const match = rest.match(IDENTIFIER);
	if (!match) return null;
	return { token: { kind: 'identifier', name: match[0], position }, length: match[0].length };
}

function readOperator(rest: string, position: number, options: TokenizeOptions): ReadResult {
	const update = UPDATE_OPERATORS.find(symbol => rest.startsWith(symbol));
	if (update) {
		throw new Error(`Unsupported operator "${update}" at position ${position + 1}; put a space or parentheses between the signs.`);
	}
	const symbol = OPERATOR_SYMBOLS.find(candidate => rest.startsWith(candidate));
	if (!symbol) {
		throw new Error(`Unexpected "${rest.charAt(0)}" at position ${position + 1}.`);
	}
	if (symbol === '%' && options.amountUnit) {
		throw new Error(`In an amount, "%" only marks a percentage right after a number (position ${position + 1}).`);
	}
	return { token: { kind: 'operator', symbol, position }, length: symbol.length };
}
