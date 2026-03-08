// Type mapping: Token type → Figma Variable type
// Extensible for future token types
export const TYPE_MAP: Record<string, VariableResolvedDataType> = {
	'color': 'COLOR',
	'number': 'FLOAT',
	'string': 'STRING',
	// Future types (ready to uncomment/extend):
	// 'dimension': 'FLOAT',
	// 'fontFamily': 'STRING',
	// 'fontSize': 'FLOAT',
	// 'fontWeight': 'FLOAT',
	// 'lineHeight': 'FLOAT',
};

// Reverse mapping: Figma type → Token type
export const FIGMA_TYPE_MAP: Record<VariableResolvedDataType, string> = {
	'COLOR': 'color',
	'FLOAT': 'number',
	'STRING': 'string',
	'BOOLEAN': 'string', // Map to string for now
};

// Supported math operators for expressions
export const MATH_OPERATORS = ['+', '-', '*', '/', '(', ')'];

// Regex patterns for expression parsing
export const PATTERNS = {
	bareAlias: /^\{([^}]+)\}$/,
	alphaFunction: /^alpha\(\{([^}]+)\},\s*([\d.]+)\)$/,
	tokenReference: /\{([^}]+)\}/g,
	hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
	rgbColor: /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/,
	rgbaColor: /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
};

