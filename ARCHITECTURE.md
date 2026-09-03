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
│   ├── variableWriter.ts  # Apply TokenJSON → Figma
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
3. **Alpha modification:** `"{red.100}, 50%"` → computed RGBA
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
variableWriter.ts creates/updates Figma variables
    ├─ Find or create collections
    ├─ Merge modes
    ├─ Resolve expressions via resolver.ts
    └─ Set values (alias or computed)
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
Token value: "{foundation.color.red}, 50%"
    ↓
resolver.parseExpression()
    ├─ Detects alpha modifier
    └─ Returns AST: { type: 'alpha', tokenPath: '...', alpha: 0.5 }
    ↓
resolver.resolveToken()
    ├─ Recursively resolves dependencies
    ├─ Applies alpha to RGBA
    └─ Returns computed value or alias reference
    ↓
variableWriter.setVariableValue()
    └─ Sets in Figma (native alias or computed value)
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
- Expressions with `@`, math, concat → **computed value** (static)

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
- `zod` — runtime schema validation
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
7. **Cannot Create Composed Colors** — the plugin can read Figma's native "reference + opacity" colour variables but cannot write them; the Plugin API refuses. See [Composed Color Variables](#composed-color-variables-figma-alias--opacity) for the full investigation.

## Composed Color Variables (Figma alias + opacity)

**Status as of 2026-09, checked against `@figma/plugin-typings@1.137.0` and Figma desktop.**

This section is a research record. The conclusion below is a hard "no" *today*, but the
restriction looks deliberate and temporary, so this documents everything needed to
re-test it cheaply later rather than re-deriving it from scratch.

### What the feature is

Figma's UI lets a colour variable reference another colour variable **and** carry its own
opacity — shown in the Variables panel as the alias plus an opacity percentage. This is
the long-requested "alias with alpha", and it is what `alpha({token}, X%)` would ideally
produce, so that changing the base colour keeps every derived token live.

### How Figma stores it

Read from `variable.valuesByMode[modeId]` on a variable created by hand in the UI:

```json
{
  "type": "VARIABLE_EXPRESSION",
  "expressionFunction": "COMPOSE_COLOR",
  "expressionArguments": [
    { "type": "VARIABLE_ALIAS", "id": "VariableID:1:3" },
    50
  ]
}
```

- Opacity is the **second** element of `expressionArguments`, a percentage on a **0-100**
  scale — the same scale `resolveAmount()` already returns for `alpha()`, so no conversion
  is needed in either direction.
- Neither `VARIABLE_EXPRESSION` (in the `VariableValue` union) nor `COMPOSE_COLOR` (in
  `ExpressionFunction`) exists in the published typings. The `Expression` interface that
  *is* in the typings belongs to the prototyping/conditionals system and has a different
  shape — no `type` field, and `expressionArguments: VariableData[]` wrappers. Do not be
  misled by it, as the first attempt here was.

### Why writing is impossible

`Variable.setValueForMode()` is the only method that sets a variable value — confirmed by
reading the whole `Variable` interface, which otherwise exposes only `resolveForConsumer`,
a readonly `valuesByMode`, `remove()` and `scopes`. It rejects composed colours:

```
in setValueForMode: Composed color variable values are not supported
```

Seven candidate payloads were tried. The failures split into two distinct groups, and
that split is the actual evidence:

| # | Payload | Result |
|---|---------|--------|
| A | `type` + raw args `[alias, 50]` | **Feature gate** — `Composed color variable values are not supported` |
| B | No `type`, raw args | Schema error |
| C | `type` + `VariableData`-wrapped args | Schema error |
| D | No `type`, wrapped args | Schema error |
| E | `type` + raw args, opacity as `0.5` | **Feature gate** |
| F | `VariableData` envelope around the expression | Schema error |
| G | **Verbatim echo** of a value read from a real variable | **Feature gate** |

The schema errors (B, C, D, F) are the useful ones: Figma's validator spelled out the
schema it expects, confirming shape A is exactly right —

```
Invalid literal value, expected "VARIABLE_EXPRESSION" at .type
Invalid literal value, expected "COMPOSE_COLOR" at .expressionFunction
Required value missing at .expressionArguments[0].id
Invalid literal value, expected "VARIABLE_ALIAS" at .expressionArguments[1].type
Expected number, received object at .expressionArguments[1]
```

So the value form is well-formed and recognised by the runtime; a **separate, later guard**
rejects it on principle. Case G is decisive: Figma refused to accept back a value it had
produced and stored itself, unmodified.

Additional findings:

- `enableProposedApi: true` does **not** lift the restriction. It would be useless anyway —
  plugins with that flag cannot be published, not even privately to an organisation.
- Chained opacity is impossible even in the UI: a variable referencing a variable that
  already carries opacity is stored as a plain `VARIABLE_ALIAS` with no opacity of its own,
  and Figma will not let you set one.

### What the plugin does instead

Since it can read but not write, the plugin's job is to avoid destroying these values:

| Concern | Behaviour | Implementation |
|---------|-----------|----------------|
| Import used to return `#000000` for them | Emits `alpha({path}, X%)` | `formatComposeColor()` in `plugin/variableReader.ts` |
| Unresolvable alias target (library variable, deleted variable) | Emits a deliberately invalid path so the existing reference validator reports it at Apply time, instead of silently emptying the value | `UNRESOLVED_COMPOSE_COLOR_TARGET_PREFIX` in `plugin/variableReader.ts` |
| Apply used to flatten them into static colours | Skips the write when the stored value already matches the token's intent | `isComposedColorUnchanged()` in `plugin/variableWriter.ts` |
| Recognising the shape | Type guard, rejects any other `VARIABLE_EXPRESSION` function | `plugin/composeColor.ts` |
| Telling the user | `ApplyResult.preservedComposedColors`, surfaced in the Apply toast | `plugin/variableWriter.ts`, `ui/app.tsx` |

Note that the equivalence check compares **id → path**, not path → id: resolving a path to
a variable means `findVariableByPath()`, which rescans every variable in the file. Going
backwards costs two lookups by id instead.

### How to re-test when revisiting

1. In a Figma file, create a colour variable `base` with a solid colour, then a second
   variable `overlay` set in the UI to reference `base` with, say, 50% opacity.
2. In plugin code, read `overlay`'s `valuesByMode` and confirm the shape above still holds
   — if Figma changed the representation, everything below is void.
3. Attempt `setValueForMode` with that exact value on a throwaway variable.
   - Still `Composed color variable values are not supported` → nothing has changed, stop.
   - Accepted → the gate is lifted; continue.
4. Also re-check whether a *fractional* percentage (e.g. `12.5`) is accepted, and whether
   the target may itself be a plain alias variable. Both were untestable while the gate
   was closed, and both affect the design below.

### Design worked out for when it opens up

Kept because the non-obvious parts cost real effort to work out:

- **Only a bare `alpha({token}, amount)` qualifies.** Anything else — `darken(alpha(...))`,
  a chain of `alpha` over `alpha` — must keep producing a computed colour, since Figma
  cannot express it.
- **Only when the base colour is fully opaque.** Today `alpha()` *multiplies* alpha down
  the chain (`0.5 × 0.5 = 0.25`). Restricting to an opaque base sidesteps every case where
  Figma's composition semantics might differ from that, keeping results identical to today.
- **The opacity check must resolve with the feature flag OFF.** Otherwise the resolver
  returns the reference variant, follows `targetPath` onward, and sees the *base* colour's
  `a = 1.0` instead of the intermediate token's real opacity — silently qualifying a token
  that should have been excluded.
- **Clamp the percentage to 0-100 before writing.** `resolveAmount()` returns it raw, so
  `alpha({x}, 150%)` yields `150`; today that clamps downstream in `applyAlpha()` to
  `a = 1.0`, and writing `150` would diverge.
- **Verify the write by reading it back** rather than trusting it to throw. On the machine
  where the feature is unavailable the failure mode is unknown, so read
  `valuesByMode[modeId]` after writing, fall back to the computed colour on mismatch, and
  cache the outcome for the session. This also avoids a capability probe, which would have
  to create and delete a temporary collection — mutating the user's document, dirtying the
  file, polluting undo history and syncing to collaborators.
- **Two prerequisites become load-bearing** (both are pre-existing defects, harmless today
  because so few tokens take the alias path):
  - `findVariableByPath()` rescans every variable per alias. Once every `alpha()` token
    needs a target lookup, this needs to become a `Map` built once per apply.
  - `applyToVariables()` creates variables and resolves alias targets in the same pass, so
    a first Apply fails for aliases pointing at a collection defined later in the JSON.
    Splitting it into create-then-populate fixes this and makes results independent of key
    order.
