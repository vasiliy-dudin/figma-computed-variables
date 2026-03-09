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
			"accent": { "$type": "color", "$value": { "light": "oklch(0.65 0.2 250)", "dark": "oklch(0.75 0.18 250)" } },
			"surface": { "$type": "color", "$value": { "light": "#FFFFFF", "dark": "#1A1A1A" } }
		},
		"spacing": {
			"base": { "$type": "number", "$value": { "light": 8, "dark": 8 } }
		}
	},
	"semantic": {
		"button": {
			"background": { "$type": "color", "$value": { "light": "{foundation.color.primary}", "dark": "{foundation.color.primary}" } },
			"backgroundHover": { "$type": "color", "$value": { "light": "darken({foundation.color.primary}, 0.1)", "dark": "lighten({foundation.color.primary}, 0.1)" } },
			"backgroundMuted": { "$type": "color", "$value": { "light": "alpha({foundation.color.primary}, 0.15)", "dark": "alpha({foundation.color.primary}, 0.15)" } },
			"padding": { "$type": "number", "$value": { "light": "{foundation.spacing.base} * 2", "dark": "{foundation.spacing.base} * 2" } }
		},
		"text": {
			"primary": { "$type": "color", "$value": { "light": "{foundation.color.primary}", "dark": "{foundation.color.primary}" } },
			"primaryHover": { "$type": "color", "$value": { "light": "saturate({semantic.text.primary}, 0.05)", "dark": "saturate({semantic.text.primary}, 0.05)" } },
			"secondary": { "$type": "color", "$value": { "light": "desaturate({semantic.text.primary}, 0.1)", "dark": "desaturate({semantic.text.primary}, 0.1)" } },
			"accent": { "$type": "color", "$value": { "light": "hueShift({semantic.text.primary}, 30)", "dark": "hueShift({semantic.text.primary}, 30)" } }
		}
	}
};

// Supported math operators for expressions
export const MATH_OPERATORS = ['+', '-', '*', '/', '(', ')'];

// Regex patterns for expression parsing
export const PATTERNS = {
	bareAlias: /^\{([^}]+)\}$/,
	alphaFunction: /^alpha\(\{([^}]+)\},\s*([\d.]+)\)$/,
	colorModifyFunction: /^(darken|lighten|saturate|desaturate|hueShift)\(\{([^}]+)\},\s*([\d.+-]+)\)$/,
	tokenReference: /\{([^}]+)\}/g,
	oklchColor: /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/,
	hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
	rgbColor: /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/,
	rgbaColor: /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
};

