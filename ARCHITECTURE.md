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
4. **Storage Isolation** — `clientStorage` is plugin-scoped
5. **Message Validation** — all cross-context messages are typed

## Limitations

1. **Computed Values Are Static** — changes to dependencies don't auto-update computed values. You must click Apply again to recalculate.
2. **Mode Consistency Not Enforced** — tokens can have different modes across collections
5. **No Type Coercion** — `{number-token}px` won't convert number to string automatically
6. **Manual Sync Required** — plugin doesn't watch for external changes to Figma Variables
