import { ArithmeticToken, OperatorSymbol, TokenizeOptions, tokenizeArithmetic } from './arithmeticTokens';

interface Cursor {
	tokens: ArithmeticToken[];
	index: number;
	references: ReadonlyMap<string, number>;
}

const ADDITIVE = ['+', '-'] as const;
const MULTIPLICATIVE = ['*', '/', '%'] as const;
const UNARY = ['+', '-'] as const;
const EXPONENT = '**';
const MATH_PREFIX = 'Math.';

/**
 * Evaluates arithmetic with the grammar and results of JavaScript: + - * / % **, parentheses,
 * unary signs, number literals, {token} references (values taken from `references`) and
 * Math.* constants and functions. Throws on anything else. Returns the raw result, which may
 * be NaN or Infinity; callers decide whether that is acceptable. `options` switches on amount units.
 */
export function evaluateArithmetic(
	expression: string,
	references: ReadonlyMap<string, number> = new Map(),
	options: TokenizeOptions = {}
): number {
	const cursor: Cursor = { tokens: tokenizeArithmetic(expression, options), index: 0, references };
	if (cursor.tokens.length === 0) {
		throw new Error('The expression is empty.');
	}
	const value = parseAdditive(cursor);
	const leftover = cursor.tokens[cursor.index];
	if (leftover) {
		throw unexpected(leftover);
	}
	return value;
}

/** The syntax error of an expression, or null when it parses. References need no values: each reads as 1. */
export function arithmeticSyntaxError(expression: string, options: TokenizeOptions = {}): string | null {
	try {
		const placeholders = new Map<string, number>();
		for (const token of tokenizeArithmetic(expression, options)) {
			if (token.kind === 'reference') placeholders.set(token.path, 1);
		}
		evaluateArithmetic(expression, placeholders, options);
		return null;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}

function parseAdditive(cursor: Cursor): number {
	let value = parseMultiplicative(cursor);
	for (let op = takeOperator(cursor, ADDITIVE); op; op = takeOperator(cursor, ADDITIVE)) {
		const right = parseMultiplicative(cursor);
		value = op === '+' ? value + right : value - right;
	}
	return value;
}

function parseMultiplicative(cursor: Cursor): number {
	let value = parseExponentiation(cursor);
	for (let op = takeOperator(cursor, MULTIPLICATIVE); op; op = takeOperator(cursor, MULTIPLICATIVE)) {
		const right = parseExponentiation(cursor);
		if (op === '*') value = value * right;
		else if (op === '/') value = value / right;
		else value = value % right;
	}
	return value;
}

// JS forbids a unary sign directly on the base of "**" (-2 ** 2 is a SyntaxError), since it
// would be unclear whether the sign applies before or after raising to the power.
function parseExponentiation(cursor: Cursor): number {
	if (peekOperator(cursor, UNARY)) {
		const value = parseUnary(cursor);
		if (peekOperator(cursor, [EXPONENT])) {
			throw new Error('Put a negated base of "**" in parentheses, e.g. (-2) ** 2.');
		}
		return value;
	}
	const base = parsePrimary(cursor);
	if (!takeOperator(cursor, [EXPONENT])) return base;
	return base ** parseExponentiation(cursor);
}

function parseUnary(cursor: Cursor): number {
	const sign = takeOperator(cursor, UNARY);
	if (!sign) return parsePrimary(cursor);
	const operand = parseUnary(cursor);
	return sign === '-' ? -operand : +operand;
}

function parsePrimary(cursor: Cursor): number {
	const token = cursor.tokens[cursor.index];
	if (!token) {
		throw new Error('The expression ends too early.');
	}
	cursor.index++;
	switch (token.kind) {
		case 'number':
			return token.value;
		case 'reference':
			return referenceValue(cursor, token.path);
		case 'identifier':
			return mathMember(cursor, token.name);
		case 'operator':
			if (token.symbol !== '(') throw unexpected(token);
			return parseParenthesised(cursor);
	}
}

function parseParenthesised(cursor: Cursor): number {
	const value = parseAdditive(cursor);
	expectOperator(cursor, ')');
	return value;
}

function referenceValue(cursor: Cursor, path: string): number {
	const value = cursor.references.get(path);
	if (value === undefined) {
		throw new Error(`No value for reference {${path}}.`);
	}
	return value;
}

function mathMember(cursor: Cursor, name: string): number {
	const memberName = name.startsWith(MATH_PREFIX) ? name.slice(MATH_PREFIX.length) : '';
	// Own properties only: inherited ones such as Math.constructor would reach Function.
	if (!memberName || !Object.prototype.hasOwnProperty.call(Math, memberName)) {
		throw new Error(`Unknown name "${name}". Only numbers, {token} references and Math functions are allowed.`);
	}
	const member: unknown = Reflect.get(Math, memberName);
	if (typeof member === 'number') {
		if (peekOperator(cursor, ['('])) throw new Error(`${name} is a number, not a function.`);
		return member;
	}
	if (typeof member !== 'function') {
		throw new Error(`${name} cannot be used in an expression.`);
	}
	expectOperator(cursor, '(', `${name} must be called, e.g. ${name}(…).`);
	return callMathFunction(name, member, parseArguments(cursor));
}

function callMathFunction(name: string, fn: Function, args: number[]): number {
	const result: unknown = Reflect.apply(fn, Math, args);
	if (typeof result !== 'number') {
		throw new Error(`${name} did not return a number.`);
	}
	return result;
}

// Called after "(": reads comma-separated arguments up to ")", allowing a trailing comma as JS does.
function parseArguments(cursor: Cursor): number[] {
	const args: number[] = [];
	while (!takeOperator(cursor, [')'])) {
		args.push(parseAdditive(cursor));
		if (!takeOperator(cursor, [','])) {
			expectOperator(cursor, ')');
			break;
		}
	}
	return args;
}

function peekOperator<T extends OperatorSymbol>(cursor: Cursor, symbols: readonly T[]): T | null {
	const token = cursor.tokens[cursor.index];
	if (token?.kind !== 'operator') return null;
	return symbols.find(symbol => symbol === token.symbol) ?? null;
}

function takeOperator<T extends OperatorSymbol>(cursor: Cursor, symbols: readonly T[]): T | null {
	const symbol = peekOperator(cursor, symbols);
	if (symbol) cursor.index++;
	return symbol;
}

function expectOperator(cursor: Cursor, symbol: OperatorSymbol, message?: string): void {
	if (takeOperator(cursor, [symbol])) return;
	const token = cursor.tokens[cursor.index];
	if (message) throw new Error(message);
	throw token ? unexpected(token) : new Error(`Missing "${symbol}" at the end of the expression.`);
}

function unexpected(token: ArithmeticToken): Error {
	return new Error(`Unexpected ${describeToken(token)} at position ${token.position + 1}.`);
}

function describeToken(token: ArithmeticToken): string {
	switch (token.kind) {
		case 'number': return `number ${token.value}`;
		case 'reference': return `reference {${token.path}}`;
		case 'identifier': return `"${token.name}"`;
		case 'operator': return `"${token.symbol}"`;
	}
}
