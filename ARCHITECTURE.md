# Architecture

## System Overview

Computed Variables is a Figma plugin for managing design tokens via JSON with expression support. It allows defining relationships between tokens (aliases, math expressions, color functions), then syncing them to Figma Variables.

The plugin operates in two isolated runtime environments that communicate exclusively via message passing.



## Runtime Environments

### Plugin Sandbox
- **Entry:** `src/plugin/plugin.ts`
- **Build:** `dist/plugin.js`
- **Access:** Full Figma Plugin API
- **Restrictions:** No DOM, no UI rendering

### UI Iframe
- **Entry:** `src/ui/app.tsx`
- **Build:** `dist/index.html`
- **Framework:** Preact
- **Restrictions:** No Figma API access

## Module Structure

```
src/
├── plugin/                 # Plugin sandbox code
│   ├── plugin.ts          # Main entry, message routing
│   ├── variableReader.ts  # Import Figma → TokenJSON
│   ├── variableWriter.ts  # Apply TokenJSON → Figma (second pass: values)
│   ├── prepareVariables.ts # Apply, first pass: collections, modes, variables
│   ├── variableIndex.ts   # One lookup of every variable per Apply
│   ├── composeColor.ts    # Read/write Figma composed colours (reference + opacity)
│   ├── storage.ts         # Persistent storage (clientStorage)
│   └── plugin.network.ts  # Networker configuration
│
├── ui/                    # UI iframe code
│   ├── app.tsx           # Main Preact component
│   ├── index.html        # UI entry point
│   ├── app.network.tsx   # Networker configuration
│   ├── ui.ts             # UI initialization
│   └── components/       # Preact components
│       ├── JsonEditor.tsx
│       ├── Toolbar.tsx
│       ├── ErrorDisplay.tsx
│       └── StatusBar.tsx
│
├── core/                 # Shared logic (used by both)
│   ├── types.ts         # Zod schemas, TypeScript types
│   ├── messages.ts      # Message type definitions
│   ├── validator.ts     # Schema + circular dependency validation
│   ├── resolver.ts      # Expression parser and resolver
│   ├── tokenUtils.ts    # Token map, counting utilities
│   └── constants.ts     # Type mappings, defaults
│
└── common/              # Networker configuration
    └── networkSides.ts  # PLUGIN and UI side definitions
```

## Communication Pattern

All plugin ↔ UI communication uses **monorepo-networker** with typed messages.

### Message Flow

```
UI                          Plugin
│                           │
├─ IMPORT_VARIABLES ───────>│
│<─────────── IMPORT_SUCCESS┤ (with TokenJSON)
│                           │
├─ APPLY_TO_VARIABLES ─────>│
│<──────────── APPLY_SUCCESS┤ (or APPLY_ERROR)
│                           │
├─ SAVE_JSON ──────────────>│
│<────────────── SAVE_SUCCESS┤
│                           │
│<────────────── LOAD_JSON ──┤ (on plugin startup)
```

### Message Types

**UI → Plugin:**
- `IMPORT_VARIABLES` — read all Figma variables
- `APPLY_TO_VARIABLES` — write TokenJSON to Figma
- `SAVE_JSON` — persist TokenJSON to clientStorage

**Plugin → UI:**
- `IMPORT_SUCCESS` — imported TokenJSON
- `IMPORT_ERROR` — import failed
- `APPLY_SUCCESS` — variables updated
- `APPLY_ERROR` — validation errors
- `SAVE_SUCCESS` — storage updated
- `SAVE_ERROR` — storage failed
- `LOAD_JSON` — restored from storage

## Data Model

### TokenJSON Structure

```typescript
{
  "collection-name": {
    "token-path": {
      "$type": "color" | "number" | "string",
      "$value": {
        "mode-name": <expression>
      },
      "$description": "optional"
    }
  }
}
```

### Expression Types

1. **Literal:** `"#ff0000"`, `16`, `"sans-serif"`
2. **Alias:** `"{red.100}"` → native Figma alias
3. **Alpha modification:** `"alpha({red.100}, 50%)"` → native Figma composed colour (a reference plus an opacity) when `red.100` is opaque, otherwise computed RGBA — see [Composed colours](#composed-colours-alpha-as-a-live-reference)
4. **Math expression:** `"{spacing.base} * 2"` → computed number
5. **String concatenation:** `"Value: {token.value}px"` → computed string

## Core Workflows

### 1. Import Flow

```
User clicks Import
    ↓
UI sends IMPORT_VARIABLES
    ↓
Plugin reads figma.variables.getLocalVariableCollectionsAsync()
    ↓
variableReader.ts converts to TokenJSON format
    ↓
Plugin sends IMPORT_SUCCESS
    ↓
UI updates JsonEditor
```

### 2. Apply Flow

```
User clicks Apply
    ↓
UI sends APPLY_TO_VARIABLES
    ↓
Plugin validates via validator.ts
    ├─ Schema validation (Zod)
    ├─ Reference validation
    └─ Circular dependency detection
    ↓
variableWriter.ts creates/updates Figma variables, in two passes
    ├─ Pass 1 (prepareVariables.ts): find or create collections, merge modes,
    │   find or create variables, set descriptions and scopes
    └─ Pass 2: resolve expressions via resolver.ts and set values
        (native alias, composed colour, or computed value)
    ↓
Plugin sends APPLY_SUCCESS or APPLY_ERROR
```

### 3. Validation Flow

```
User edits JSON
    ↓
UI parses and validates on every change
    ↓
validator.ts runs:
    ├─ validateSchema() — Zod type checking
    ├─ validateReferences() — all {refs} exist
    └─ detectCircularDependencies() — no cycles
    ↓
ErrorDisplay shows issues or clears
```

### 4. Expression Resolution

```
Token value: "alpha({foundation.color.red}, 50%)"
    ↓
resolver.parseExpression()
    ├─ Detects alpha modifier
    └─ Returns AST: { type: 'alpha', tokenPath: '...', alpha: 0.5 }
    ↓
resolver.resolveAlphaIntent()
    └─ Target path, percentage, opacity token, and whether the base is opaque
    ↓
opaque base → composeColor.writeComposedColor()
    └─ Sets { color: alias, opacity: alias | percentage } in Figma
    ↓
otherwise, or if that write fails → resolver.resolveToken()
    ├─ Recursively resolves dependencies
    ├─ Applies alpha to RGBA
    └─ variableWriter.setVariableValue() sets the computed value
```

## Validation Strategy

### Three-Layer Validation

1. **Schema Validation** (Zod)
   - Type correctness: `$type`, `$value` structure
   - Required fields present
   - Value types match token types

2. **Reference Validation**
   - All `{collection.token}` references exist
   - No dangling references

3. **Circular Dependency Detection**
   - Recursive graph traversal per mode
   - Tracks visited paths
   - Throws CircularDependencyError on cycle

### When Validation Runs

- **UI:** On every JSON edit (real-time feedback)
- **Plugin:** Before APPLY and SAVE operations (safety gate)

## Key Design Decisions

### 1. Pure Aliases vs Computed Values

- Simple `{ref}` → **native Figma alias** (maintains reactivity)
- `alpha({ref}, X%)` over an opaque colour → **native composed colour** (maintains reactivity)
- Other expressions — math, concat, other colour functions → **computed value** (static)

**Rationale:** Preserve Figma's alias system for simple references while enabling advanced computed use cases.

### 2. Mode-Level Resolution

- Each mode resolves independently
- Same token can be alias in one mode, computed in another

**Rationale:** Maximum flexibility for mode-specific design tokens.

### 3. Strict Validation Before Apply

- Block invalid JSON from reaching Figma API
- Prevent partial/corrupted variable state

**Rationale:** Protect user's Figma document integrity.

### 4. Storage Strategy

- Auto-save to `figma.clientStorage` on explicit save action
- Auto-load on plugin startup

**Rationale:** Preserve work between sessions without cluttering Figma document.

### 5. Message-Based Architecture

- Zero shared state between plugin and UI
- All communication typed and validated

**Rationale:** Figma's security model enforces strict isolation; embrace it with explicit contracts.

## Build System

### Dual Build Configuration

**Plugin Build** (`vite.config.plugin.ts`):
- Input: `src/plugin/plugin.ts`
- Output: `dist/plugin.js`
- Format: IIFE (Figma sandbox requirement)
- No code splitting

**UI Build** (`vite.config.ui.ts`):
- Input: `src/ui/index.html`
- Output: `dist/index.html` (single file with inlined assets)
- Framework: Preact via `@vitejs/plugin-react`
- Uses `vite-plugin-singlefile` for embedding

### Type Checking

Two separate TypeScript projects:
- `tsconfig.json` — application code
- `tsconfig.node.json` — build scripts

## Dependencies

### Core Runtime
- `preact` — lightweight React alternative for UI
- `monorepo-networker` — type-safe message passing
- `zod` — runtime schema validation. Figma's plugin sandbox has no `BigInt` (despite Figma's docs), and zod >= 4.6 calls it while loading, so `vite.config.plugin.ts` substitutes a `Number` fallback for every `BigInt` reference in the plugin bundle. Any dependency that calls `BigInt` at load time is covered by the same substitution. The catch: it also rewrites `typeof BigInt`, so a library that feature-detects `BigInt` would be told it exists. `scripts/check-sandbox-load.mjs` runs after every build (`postbuild`), loads the bundle with `BigInt` deleted, and fails the build if it cannot load or if such a detection appears.
- `culori` — color manipulation (alpha blending)
- `codemirror` — JSON editor with syntax highlighting

### Development
- `vite` — build tool
- `typescript` — type system
- `@figma/plugin-typings` — Figma API types
- `pnpm` — npm package manager

## Extension Points

### Adding New Token Types

1. Add to `TokenTypeSchema` in `core/types.ts`
2. Add mapping in `TYPE_MAP` and `FIGMA_TYPE_MAP` in `core/constants.ts`
3. Update `formatValue()` in `variableReader.ts`
4. Update `convertValueForFigma()` in `variableWriter.ts`

### Adding New Expression Types

1. Add AST type to `Expression` union in `core/types.ts`
2. Implement parser in `resolver.parseExpression()`
3. Implement evaluator in `resolver.resolveExpression()`


## Security Considerations

1. **No External Network Calls** — plugin runs fully offline
2. **Input Sanitization** — Zod validates all JSON before processing
3. **Expression Safety** — no `eval()`, all expressions parsed and validated
4. **Storage Isolation** — `clientStorage` is plugin-scoped, not file-scoped, so `storage.ts` namespaces each entry with a per-file id persisted via `pluginData` on `figma.root`
5. **Message Validation** — all cross-context messages are typed

## Limitations

1. **Computed Values Are Static** — changes to dependencies don't auto-update computed values. You must click Apply again to recalculate.
2. **Mode Consistency Not Enforced** — tokens can have different modes across collections
5. **No Type Coercion** — `{number-token}px` won't convert number to string automatically
6. **Manual Sync Required** — plugin doesn't watch for external changes to Figma Variables

## Composed colours: alpha() as a live reference

A Figma **composed colour** is a colour variable value made of a colour and a separate
opacity, at least one of them a reference to another variable. The plugin uses it to write
`alpha({token}, X%)` as a live reference: changing `token` in Figma updates every derived
colour, as it does for a plain `{token}` alias.

**History.** Figma's UI could make these before plugins could: until 2026-09-17
`setValueForMode` rejected them outright ("Composed color variable values are not
supported"), and the plugin could only avoid destroying them. Plugin API
[update 139](https://developers.figma.com/docs/plugins/updates/2026/09/17/version-1-update-139/)
opened the write and added the `COLOR_OPACITY` variable scope. `@figma/plugin-typings`
(`1.138.0` on 2026-09-21) did not describe it yet, so the plugin declares the type itself
in `plugin/composeColor.ts`.

### The value

```ts
{ color: VariableAlias | RGB, opacity: VariableAlias | number }
```

Figma reads back the same shape it accepts, including for values set by hand in its UI.
Opacity is a percentage on a 0-100 scale: `opacity: 50` paints alpha 0.5. A fractional
percentage and a colour that is itself an alias are accepted. All of this was measured in
real Figma on 2026-09-21.

### Writing — `alpha()` in Apply

For each mode of an `alpha()` token, `resolveAlphaIntent()` in `core/resolver.ts` reports
the target, the percentage, whether the amount token can be referenced, and whether the
token is **eligible**. `composeColor.writeComposedColor()` then writes the composed colour;
anything else falls back to the computed colour, exactly as before update 139.

- **Eligible means the base is fully opaque in that mode.** Figma *replaces* the base's
  alpha, while `alpha()` *multiplies* it (a 50 % transparent base at 50 % paints 0.5 in
  Figma, 0.25 in `alpha()`). They agree only on an opaque base. So `alpha` over a
  translucent colour, over another `alpha` token, or over an alias of one, stays computed.
  The check resolves the base as a computed value, so an `alpha` token counts with its real,
  reduced alpha rather than that of the colour it points at.
- **Opacity is a reference only when that paints the same colour**: the amount token's own
  number must equal the percentage. A `COLOR_OPACITY` token `60`, or `"60%"`, is referenced;
  a decimal token `0.12` means 12 % to `alpha()` but 0.12 % to Figma, so `12` is written as a
  number instead. The referenced variable must be a number variable.
- The percentage is clamped to 0-100 when written; `alpha()` clamps the same way.
- **Fallback to the computed colour** when the base variable does not exist (e.g. the user
  excluded it with `_`, so a fixed colour is intended and nothing is reported) or Figma
  rejects the value. A rejection is counted, `ApplyResult.rejectedComposedColors`, and shown
  in the Apply message ("N alpha() values saved as fixed colours: Figma refused a linked
  value"), because otherwise the user would believe the links exist. It usually means an
  outdated Figma app. The console gets one warning per Apply, not one per token.

### Opacity scale

A plain number in an amount token is a fraction (`0.6` = 60 %) — except in a token scoped
`COLOR_OPACITY`, which is a percentage (`60` = 60 %), because that is how Figma stores
opacity variables and marks them. Only the token named in the expression is checked, not the
end of an alias chain behind it.

### Reading — Import

`formatComposedColor()` in `plugin/variableReader.ts`:

- colour reference + number → `alpha({token}, 50%)`;
- colour reference + opacity variable → `alpha({token}, {opacityToken})`, keeping that link.
  The opacity variable itself imports as `"60%"` rather than `60` unless it has the
  `COLOR_OPACITY` scope: Figma does not require the scope, and without it a bare `60` would
  read as a fraction. Alias chains are followed to the variable holding the number. The
  catch: such a token can no longer be used in maths (`{opacityToken} * 2`);
- literal colour + opacity variable → the flat colour it paints, because `alpha()` needs a
  token reference; the link to the opacity variable is lost;
- a referenced variable that cannot be resolved locally (a library, a deleted variable) →
  a deliberately invalid path, `unresolved-variable:<id>`, so validation reports it on Apply
  instead of the value silently vanishing.

### Leaving Figma-authored values alone

A composed colour authored in Figma over a *translucent* base imports as
`alpha({base}, 42%)`, which under `alpha()`'s multiplying rule means less opacity than
Figma paints. Apply cannot rewrite it without changing its colour, so as long as the stored
value still matches the token — same target, and the same percentage or the same opacity
variable — Apply leaves it untouched (`isComposedColorUnchanged()` in
`plugin/variableWriter.ts`) and reports how many it kept. Once the token changes, it is
rewritten as the computed colour. Eligible tokens need no such care: Apply rewrites them as
composed colours.

### Supporting changes

- **Two-pass Apply.** `prepareVariables.ts` creates every collection, mode and variable
  before any value is written, so a reference to a collection defined later in the JSON
  resolves on the first Apply, and results do not depend on collection order.
- **One lookup per Apply.** `variableIndex.ts` fetches every variable once and resolves
  token paths from memory. The earlier lookup rescanned the whole file for each alias,
  which every `alpha()` token would now have paid for.
