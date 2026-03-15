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

// Token value — either a shorthand scalar (applies to all modes) or a per-mode record
// Single-mode imports must collapse to the scalar form to keep JSON concise. [Explicit]
export const TokenValueSchema = z.union([
	z.string(),
	z.number(),
	ModeValuesSchema,
]);

export type TokenValue = z.infer<typeof TokenValueSchema>;

// All valid Figma VariableScope values
const VARIABLE_SCOPE_VALUES = [
	'ALL_SCOPES', 'TEXT_CONTENT', 'CORNER_RADIUS', 'WIDTH_HEIGHT', 'GAP',
	'ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR',
	'EFFECT_COLOR', 'OPACITY', 'STROKE_FLOAT', 'FONT_WEIGHT', 'FONT_SIZE',
	'LINE_HEIGHT', 'LETTER_SPACING', 'PARAGRAPH_SPACING', 'PARAGRAPH_INDENT',
	'FONT_FAMILY', 'FONT_STYLE',
] as const;

export const VariableScopeSchema = z.enum(VARIABLE_SCOPE_VALUES);
export type VariableScopeValue = z.infer<typeof VariableScopeSchema>;

// Token schema
export const TokenSchema = z.object({
	$type: TokenTypeSchema,
	$value: TokenValueSchema,
	$description: z.string().optional(),
	$scope: z.union([VariableScopeSchema, z.array(VariableScopeSchema)]).optional(),
});

export type Token = z.infer<typeof TokenSchema>;

// Token group schema — allows a node to hold its own token via $self while nesting children.
export type TokenGroup = {
	$self?: Token;
	[key: string]: Token | TokenGroup | undefined;
};

export const TokenGroupSchema: z.ZodType<TokenGroup> = z.lazy(() =>
	z
		.object({
			$self: TokenSchema.optional(),
		})
		.catchall(z.union([TokenSchema, TokenGroupSchema]))
);

// Full token JSON schema: top-level keys are collection names
export const TokenJSONSchema = z.record(z.string(), TokenGroupSchema);

export type TokenJSON = z.infer<typeof TokenJSONSchema>;

// Supported color modifier function names
export type ColorModifyFn = 'darken' | 'lighten' | 'saturate' | 'desaturate' | 'hueShift';

// Expression AST types
export type Expression =
	| { type: 'literal'; value: string | number }
	| { type: 'alias'; path: string }
	| { type: 'alpha'; tokenPath: string; alpha: number }
	| { type: 'colorModify'; fn: ColorModifyFn; tokenPath: string; amount: number }
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

// Result type for applyToVariables
export interface ApplyResult {
	message: string;
	errors: ValidationError[];
}

// Token map for quick lookups
export interface TokenMap {
	get(path: string): Token | undefined;
	has(path: string): boolean;
	getFullPath(collectionName: string, tokenPath: string): string;
	isAmbiguous(path: string): boolean;
}
