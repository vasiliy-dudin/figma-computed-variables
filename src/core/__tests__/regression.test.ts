import { describe, it, expect } from 'vitest';
import { validate, validateSchema } from '../validator.ts';
import { createTokenMap, flattenTokenGroup } from '../tokenUtils.ts';
import { resolveToken } from '../resolver.ts';
import { resolveAlphaIntent } from '../alphaIntent.ts';
import { generateExampleJSON, type ExampleOptions } from '../constants.ts';
import type { AlphaIntent, ResolvedValue, Token, TokenJSON, TokenMap, ValidationError } from '../types';
import { COLOR_CASES, DOCS_EXAMPLES, ERROR_CASES, MATH_CASES, STRING_CASES } from './regressionCorpus.ts';
import { EXAMPLE_TOKEN_JSON } from './legacyExampleTokens.ts';

// A scalar $value resolves the same in every mode; this name only labels it in the snapshot.
const SCALAR_MODE = '(all modes)';

type Outcome<T> = { result: T } | { error: string };

interface TokenSnapshot {
	resolved: Outcome<ResolvedValue>;
	alphaIntent?: AlphaIntent | null;
}

interface BaselineSnapshot {
	validationErrors: ValidationError[];
	tokens: Record<string, TokenSnapshot>;
}

function attempt<T>(run: () => T): Outcome<T> {
	try {
		return { result: run() };
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

function modesOf(token: Token): string[] {
	return typeof token.$value === 'object' ? Object.keys(token.$value) : [SCALAR_MODE];
}

function snapshotToken(path: string, mode: string, token: Token, tokenMap: TokenMap): TokenSnapshot {
	const resolved = attempt(() => resolveToken(path, mode, tokenMap));
	if (token.$type !== 'color') return { resolved };
	return { resolved, alphaIntent: resolveAlphaIntent(path, mode, tokenMap) };
}

/** Resolves every token in every mode, recording results and errors as they are today. */
function buildBaseline(json: TokenJSON): BaselineSnapshot {
	const validation = validate(json);
	const tokenMap = createTokenMap(json);
	const tokens: Record<string, TokenSnapshot> = {};

	for (const [collection, group] of Object.entries(json)) {
		for (const [tokenPath, token] of flattenTokenGroup(group)) {
			const path = `${collection}.${tokenPath}`;
			for (const mode of modesOf(token)) {
				tokens[`${path} :: ${mode}`] = snapshotToken(path, mode, token, tokenMap);
			}
		}
	}

	return { validationErrors: validation.errors ?? [], tokens };
}

// EXAMPLE_TOKEN_JSON is an untyped literal; the schema gives it the TokenJSON shape.
function parseTokenJson(raw: unknown): TokenJSON {
	const parsed = validateSchema(raw);
	if (!parsed.valid) throw new Error(`Fixture does not match the schema: ${parsed.errors[0]?.message}`);
	return parsed.data;
}

const EXAMPLE_OPTION_SETS: ExampleOptions[] = (['1', '2'] as const).flatMap(modeCount =>
	[false, true].flatMap(includeDescription =>
		[false, true].map(includeScope => ({ modeCount, includeDescription, includeScope }))
	)
);

describe('regression baseline', () => {
	it.each([
		['docs examples', DOCS_EXAMPLES],
		['math', MATH_CASES],
		['colour functions', COLOR_CASES],
		['strings', STRING_CASES],
		['errors', ERROR_CASES],
		['EXAMPLE_TOKEN_JSON', parseTokenJson(EXAMPLE_TOKEN_JSON)],
	])('%s', (_name, json) => {
		expect(buildBaseline(json)).toMatchSnapshot();
	});

	it.each(EXAMPLE_OPTION_SETS.map(options => [JSON.stringify(options), options] as const))(
		'generateExampleJSON %s',
		(_name, options) => {
			expect(buildBaseline(generateExampleJSON(options))).toMatchSnapshot();
		}
	);
});
