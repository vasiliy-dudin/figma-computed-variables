import { z } from 'zod';

// Token Types - extensible for future types
export const TokenTypeSchema = z.enum([
	'color',
	'number',
	'string',
	// Future types (ready to add):
	// 'dimension',
	// 'fontFamily',
	// 'fontSize',
	// 'fontWeight',
	// 'lineHeight',
]);

export type TokenType = z.infer<typeof TokenTypeSchema>;

// Mode values - supports multiple modes per token
export const ModeValuesSchema = z.record(z.string(), z.union([
	z.string(),
	z.number(),
]));

export type ModeValues = z.infer<typeof ModeValuesSchema>;

// Token schema
export const TokenSchema = z.object({
	$type: TokenTypeSchema,
	$value: ModeValuesSchema,
	$description: z.string().optional(),
});

export type Token = z.infer<typeof TokenSchema>;

// Token group schema — each key is either a Token (has $type) or a nested group.
// Zod requires lazy() for recursive types.
export type TokenGroup = {
	[key: string]: Token | TokenGroup;
};

export const TokenGroupSchema: z.ZodType<TokenGroup> = z.lazy(() =>
	z.record(z.string(), z.union([TokenSchema, TokenGroupSchema]))
);

// Full token JSON schema: top-level keys are collection names
export const TokenJSONSchema = z.record(z.string(), TokenGroupSchema);

export type TokenJSON = z.infer<typeof TokenJSONSchema>;

// Expression AST types
export type Expression =
	| { type: 'literal'; value: string | number }
	| { type: 'alias'; path: string }
	| { type: 'alpha'; tokenPath: string; alpha: number }
	| { type: 'math'; expression: string }
	| { type: 'concat'; parts: Array<string | { type: 'token'; path: string }> };

// Resolved value types
export type ResolvedValue =
	| { isAlias: false; value: string | number | RGBA }
	| { isAlias: true; targetPath: string; value?: never };

// Figma color type
export interface RGBA {
	r: number;
	g: number;
	b: number;
	a: number;
}

// Validation error types
export interface ValidationError {
	collection: string;
	token: string;
	mode?: string;
	errorType: 'schema' | 'circular' | 'syntax' | 'reference' | 'collision';
	message: string;
}

// Token map for quick lookups
export interface TokenMap {
	get(path: string): Token | undefined;
	has(path: string): boolean;
	getFullPath(collectionName: string, tokenPath: string): string;
	isAmbiguous(path: string): boolean;
}
