type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

// Type mapping: Token type → Figma Variable type
// Extensible for future token types
export const TYPE_MAP: Record<string, FigmaVariableType> = {
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
export const FIGMA_TYPE_MAP: Record<FigmaVariableType, string> = {
	'COLOR': 'color',
	'FLOAT': 'number',
	'STRING': 'string',
	'BOOLEAN': 'string', // Map to string for now
};

// Example token JSON shown when user picks "Load example" on first run.
// Demonstrates strict color modifier syntax (percent / deg suffixes) and
// ensures modifier targets are direct color tokens (no aliases).
export const EXAMPLE_TOKEN_JSON = {
	"foundation": {
		"color": {
			"primary": { "$type": "color", "$value": { "light": "#0066FF", "dark": "#3388FF" }, "$description": "Primary brand color", "$scope": "ALL_FILLS" },
			"accent": { "$type": "color", "$value": { "light": "oklch(0.65 0.2 250)", "dark": "oklch(0.75 0.18 250)" } },
			"surface": { "$type": "color", "$value": { "light": "#FFFFFF", "dark": "#1A1A1A" }, "$description": "Page and card background", "$scope": ["FRAME_FILL", "SHAPE_FILL"] },
			"neutral": { "$type": "color", "$value": { "light": "oklch(0.85 0.02 220)", "dark": "oklch(0.4 0.02 220)" } }
		},
		"spacing": {
			"base": { "$type": "number", "$value": { "light": 8, "dark": 8 }, "$description": "Base spacing unit (8px grid)", "$scope": "GAP" }
		}
	},
	"semantic": {
		"button": {
			"background": { "$type": "color", "$value": { "light": "{foundation.color.primary}", "dark": "{foundation.color.primary}" } },
			"backgroundHover": { "$type": "color", "$value": { "light": "lighten({foundation.color.primary}, 12%)", "dark": "lighten({foundation.color.primary}, 8%)" } },
			"backgroundActive": { "$type": "color", "$value": { "light": "darken({foundation.color.primary}, 15%)", "dark": "darken({foundation.color.primary}, 12%)" } },
			"backgroundGhost": { "$type": "color", "$value": { "light": "alpha({foundation.color.primary}, 18%)", "dark": "alpha({foundation.color.primary}, 12%)" } },
			"padding": { "$type": "number", "$value": { "light": "{foundation.spacing.base} * 2", "dark": "{foundation.spacing.base} * 2" } }
		},
		"text": {
			"primary": { "$type": "color", "$value": { "light": "{foundation.color.neutral}", "dark": "{foundation.color.neutral}" } },
			"primaryStrong": { "$type": "color", "$value": { "light": "saturate({foundation.color.accent}, 8%)", "dark": "saturate({foundation.color.accent}, 10%)" } },
			"muted": { "$type": "color", "$value": { "light": "desaturate({foundation.color.accent}, 35%)", "dark": "desaturate({foundation.color.accent}, 35%)" } },
			"accent": { "$type": "color", "$value": { "light": "hueShift({foundation.color.accent}, 30deg)", "dark": "hueShift({foundation.color.accent}, -25deg)" } }
		},
		"status": {
			"successBase": { "$type": "color", "$value": { "light": "oklch(0.73 0.15 150)", "dark": "oklch(0.62 0.13 150)" } },
			"successOverlay": { "$type": "color", "$value": { "light": "alpha({semantic.status.successBase}, 40%)", "dark": "alpha({semantic.status.successBase}, 35%)" } }
		}
	}
};

// Supported math operators for expressions
export const MATH_OPERATORS = ['+', '-', '*', '/', '(', ')'];

// Regex patterns for expression parsing
export const PATTERNS = {
	bareAlias: /^\{([^}]+)\}$/,
	alphaFunction: /^alpha\(\{([^}]+)\},\s*(\d*\.?\d+)%\)$/,
	colorPercentFunction: /^(darken|lighten|saturate|desaturate)\(\{([^}]+)\},\s*(\d*\.?\d+)%\)$/,
	hueShiftFunction: /^hueShift\(\{([^}]+)\},\s*([-+]?\d*\.?\d+)deg\)$/,
	alphaFunctionPrefix: /^alpha\(/,
	colorFunctionPrefix: /^(darken|lighten|saturate|desaturate|hueShift)\(/,
	tokenReference: /\{([^}]+)\}/g,
	oklchColor: /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/,
	hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
	rgbColor: /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/,
	rgbaColor: /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
};

