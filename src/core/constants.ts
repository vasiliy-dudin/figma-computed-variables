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

// Example token JSON shown when user picks "Load example" on first run
export const EXAMPLE_TOKEN_JSON = {
	"foundation": {
		"color": {
			"primary": { "$type": "color", "$value": { "light": "#0066FF", "dark": "#3388FF" } },
			"surface": { "$type": "color", "$value": { "light": "#FFFFFF", "dark": "#1A1A1A" } }
		},
		"spacing": {
			"base": { "$type": "number", "$value": { "light": 8, "dark": 8 } }
		}
	},
	"semantic": {
		"button": {
			"background": { "$type": "color", "$value": { "light": "{foundation.color.primary}", "dark": "{foundation.color.primary}" } },
			"padding": { "$type": "number", "$value": { "light": "{foundation.spacing.base} * 2", "dark": "{foundation.spacing.base} * 2" } }
		}
	}
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

