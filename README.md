# Computed Variables — Figma Plugin

A Figma plugin for design systems that need expression-based tokens.

Tokens are defined in JSON with math, color modifier functions, and alias references. The plugin evaluates them and writes the computed values to Figma Variables.

## What it does

- **Modifies colors with functions** — lighten, darken, shift hue, or change opacity right inside the token value
- **Evaluates math expressions** — token values can reference other variables and use arithmetic: `{spacing.base} * 2`
- **Concatenates text tokens** — combine a variable reference with a static string: `{font.family}, sans-serif`
- **Adds OKLCH support** — a perceptually uniform color space where lightness steps look consistent across all hues
- **Imports existing Variables** — read existing Figma Variables and convert them to JSON, with all aliases preserved

## How it works

1. **Get the JSON** — start from scratch, or hit *Import from Variables* to convert existing Figma Variables to JSON in one click
2. **Add expressions** — replace static values with expressions — manually or with an AI agent
3. **Apply** — the plugin will check all the expressions and save the computed values to Figma Variables

> **Recommendation:** treat the JSON file as the single source of truth. Store it on GitHub — versioned, reviewable, portable. Use the same file for Figma and your frontend token pipeline. Figma Variables become an output, not the source.

## Expressions

| Expression | Example | Result |
|---|---|---|
| Alias | `"{color.primary}"` | `#0066FF` |
| Math | `"{spacing.base} * 2"` | `16` |
| Merge text | `"{font.family}, sans-serif"` | `Inter, sans-serif` |
| Opacity | `alpha({color.primary}, 50%)` | `rgba(0, 102, 255, 0.5)` |
| Darken | `darken({color.primary}, 30%)` | `#003899` |
| Lighten | `lighten({color.primary}, 30%)` | `#66AAFF` |
| Saturate | `saturate({color.primary}, 50%)` | `#0044FF` |
| Desaturate | `desaturate({color.primary}, 65%)` | `#5577AA` |
| Hue shift | `hueShift({color.primary}, 30deg)` | `#5533FF` |
| Plain color | `"#0066FF"` | `#0066FF` |
| Plain number | `8` | `8` |
| Plain text | `"Inter"` | `Inter` |

### Accepted color formats

| Format | Example |
|---|---|
| Hex | `"#0066FF"` |
| RGB | `"rgb(0, 102, 255)"` |
| RGBA | `"rgba(0, 102, 255, 0.5)"` |
| OKLCH | `"oklch(0.5 0.22 265)"` |
| OKLCH + alpha | `"oklch(0.5 0.22 265 / 0.5)"` |


## Excluding tokens

Prefix any key with `_` to exclude it from being applied to Figma Variables. Works at any nesting level: collection, group, or individual token.

```json
{
  "spacing": {
    "_base": { "$type": "number", "$value": 8 },
    "xs":    { "$type": "number", "$value": "{spacing._base} * 1" },
    "sm":    { "$type": "number", "$value": "{spacing._base} * 1.5" },
    "md":    { "$type": "number", "$value": "{spacing._base} * 2" },
    "lg":    { "$type": "number", "$value": "{spacing._base} * 3" },
    "xl":    { "$type": "number", "$value": "{spacing._base} * 4" }
  }
}
```

`_base` is a helper — it is not created as a Figma Variable. `xs`–`xl` are applied with their computed values.

## Examples

### Simple example with one mode
```
{
  "foundation": {
    "color": {
      "primary": {
        "$type":  "color",
        "$value": "#0066FF"
      },
      "surface": {
        "$type":  "color",
        "$value": "#FFFFFF"
      },
      "neutral": {
        "$type":  "color",
        "$value": "oklch(0.85 0.02 220)"
      }
    },
    "spacing": {
      "base": {
        "$type":  "number",
        "$value": 8
      }
    }
  },
  "semantic": {
    "color": {
      "background": {
        "$type":  "color",
        "$value": "{color.surface}"
      },
      "interactive": {
        "$type":  "color",
        "$value": "{color.primary}"
      },
      "interactiveHover": {
        "$type":  "color",
        "$value": lighten({color.primary}, 12%)
      },
      "interactiveActive": {
        "$type":  "color",
        "$value": darken({color.primary}, 15%)
      },
      "interactiveMuted": {
        "$type":  "color",
        "$value": alpha({color.primary}, 18%)
      }
    },
    "spacing": {
      "md": {
        "$type":  "number",
        "$value": "{spacing.base} * 2"
      },
      "lg": {
        "$type":  "number",
        "$value": "{spacing.base} * 3"
      }
    }
  }
}
```

### Two modes, Description, Scope
```
{
  "foundation": {
    "color": {
      "primary": {
        "$type":  "color",
        "$value": {
          "Mode 1": "#0066FF",
          "Mode 2": "#3388FF"
        },
        "$description": "Primary brand color",
        "$scope": "ALL_FILLS"
      },
      "surface": {
        "$type":  "color",
        "$value": {
          "Mode 1": "#FFFFFF",
          "Mode 2": "#1A1A1A"
        },
        "$description": "Page and card background",
        "$scope": ["FRAME_FILL", "SHAPE_FILL"]
      },
      "neutral": {
        "$type":  "color",
        "$value": {
          "Mode 1": "oklch(0.85 0.02 220)",
          "Mode 2": "oklch(0.4 0.02 220)"
        }
      }
    },
    "spacing": {
      "base": {
        "$type":  "number",
        "$value": {
          "Mode 1": 8,
          "Mode 2": 8
        },
        "$description": "Base spacing unit (8px grid)",
        "$scope": "GAP"
      }
    }
  },
  "semantic": {
    "color": {
      "background": {
        "$type":  "color",
        "$value": {
          "Mode 1": "{color.surface},
          "Mode 2": "{color.surface}"
        }
      },
      "interactive": {
        "$type":  "color",
        "$value": {
          "Mode 1": "{color.primary},
          "Mode 2": "{color.primary}"
        }
      },
      "interactiveHover": {
        "$type":  "color",
        "$value": {
          "Mode 1": lighten({color.primary}, 12%),
          "Mode 2": lighten({color.primary}, 8%)
        }
      },
      "interactiveActive": {
        "$type":  "color",
        "$value": {
          "Mode 1": darken({color.primary}, 15%),
          "Mode 2": darken({color.primary}, 12%)
        }
      },
      "interactiveMuted": {
        "$type":  "color",
        "$value": {
          "Mode 1": alpha({color.primary}, 18%),
          "Mode 2": alpha({color.primary}, 12%)
        }
      }
    },
    "spacing": {
      "md": {
        "$type":  "number",
        "$value": {
          "Mode 1": "{spacing.base} * 2",
          "Mode 2": "{spacing.base} * 2"
        }
      },
      "lg": {
        "$type":  "number",
        "$value": {
          "Mode 1": "{spacing.base} * 3",
          "Mode 2": "{spacing.base} * 3"
        }
      }
    }
  }
}
```
