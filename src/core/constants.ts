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

export interface ExampleOptions {
	modeCount: '1' | '2';
	includeDescription: boolean;
	includeScope: boolean;
}

/** Generates an example token JSON based on the given options. */
export function generateExampleJSON(options: ExampleOptions): import('./types').TokenJSON {
	const { modeCount, includeDescription, includeScope } = options;

	// 1 mode → scalar value; 2 modes → { "Mode 1", "Mode 2" } record
	function val<V extends string | number>(mode1: V, mode2: V): import('./types').TokenValue {
		return modeCount === '2' ? { "Mode 1": mode1, "Mode 2": mode2 } : mode1;
	}

	function meta(description: string, scope: string | string[]): Record<string, unknown> {
		return {
			...(includeDescription ? { $description: description } : {}),
			...(includeScope ? { $scope: scope } : {}),
		};
	}

	return {
		"foundation": {
			"color": {
				"primary": { $type: "color", $value: val("#0066FF", "#3388FF"), ...meta("Primary brand color", "ALL_FILLS") },
				"accent": { $type: "color", $value: val("oklch(0.65 0.2 250)", "oklch(0.75 0.18 250)") },
				"accentSubtle": { $type: "color", $value: val("oklch(0.65 0.2 250 / 0.15)", "oklch(0.75 0.18 250 / 0.2)"), ...meta("Accent with transparency", "ALL_FILLS") },
				"surface": { $type: "color", $value: val("#FFFFFF", "#1A1A1A"), ...meta("Page and card background", ["FRAME_FILL", "SHAPE_FILL"]) },
				"neutral": { $type: "color", $value: val("oklch(0.85 0.02 220)", "oklch(0.4 0.02 220)") },
			},
			"spacing": {
				"base": { $type: "number", $value: val(8, 8), ...meta("Base spacing unit (8px grid)", "GAP") },
			},
		},
		"semantic": {
			"color": {
				"background": { $type: "color", $value: val("{color.surface}", "{color.surface}") },
				"interactive": { $type: "color", $value: val("{color.primary}", "{color.primary}") },
				"interactiveHover": { $type: "color", $value: val("lighten({color.primary}, 12%)", "lighten({color.primary}, 8%)") },
				"interactiveActive": { $type: "color", $value: val("darken({color.primary}, 15%)", "darken({color.primary}, 12%)") },
				"interactiveMuted": { $type: "color", $value: val("alpha({color.primary}, 18%)", "alpha({color.primary}, 12%)") },
				"textPrimary": { $type: "color", $value: val("{color.neutral}", "{color.neutral}") },
				"textAccent": { $type: "color", $value: val("hueShift({color.accent}, 30deg)", "hueShift({color.accent}, -25deg)") },
				"textMuted": { $type: "color", $value: val("desaturate({color.accent}, 35%)", "desaturate({color.accent}, 35%)") },
				"statusSuccess": { $type: "color", $value: val("oklch(0.73 0.15 150)", "oklch(0.62 0.13 150)") },
				"statusSuccessOverlay": { $type: "color", $value: val("alpha({color.statusSuccess}, 40%)", "alpha({color.statusSuccess}, 35%)") },
			},
			"spacing": {
				"md": { $type: "number", $value: val("{spacing.base} * 2", "{spacing.base} * 2") },
				"lg": { $type: "number", $value: val("{spacing.base} * 3", "{spacing.base} * 3") },
			},
		},
	};
}

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

