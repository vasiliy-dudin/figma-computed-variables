---
description: UI and Preact component standards for the plugin UI layer
paths:
  - "src/ui/**/*.ts"
  - "src/ui/**/*.tsx"
---

# UI & Preact Standards

Use `@create-figma-plugin/ui` components, styles, and structure as much as possible.

## Component Structure

- One component per file. File name matches component name: `TokenList.tsx` → `export function TokenList`.
- Keep components under 150 lines. If a component grows larger, extract sub-components.
- Props must be defined as a TypeScript interface directly above the component.

## Smart vs Dumb Components

- **Smart components** (containers): manage state, handle side effects, call postMessage. Located in `ui/containers/`.
- **Dumb components** (presentational): receive props, render UI, emit callbacks. Located in `ui/components/`. They must NOT import anything from `plugin/` or call `postMessage` directly.
