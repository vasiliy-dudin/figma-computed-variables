---
description: Core project context — what this project is, tech stack, architecture rules, and what not to touch
---

# Project Context — Figma Computed Variables Plugin

## What This Project Is

A Figma plugin built with TypeScript that provides dynamic expression evaluation for design tokens.
The plugin has two runtime environments: the Figma sandbox (plugin code) and the UI iframe.
They communicate exclusively through `figma.ui.postMessage` / `parent.postMessage`.

## Technology Stack

- **Language:** TypeScript (strict mode)
- **Plugin API:** Figma Plugin API
- **UI Framework:** Preact + `@create-figma-plugin/ui` components
- **Build Tool:** esbuild
- **No backend. No database. No external API calls at runtime.**

## Project Structure

```
src/
├── plugin/          # Figma sandbox code (runs in Figma main thread)
│   ├── main.ts      # Entry point for plugin logic
│   └── ...
├── ui/              # UI iframe code (Preact components)
│   ├── app.tsx      # Main UI component
│   └── ...
├── shared/          # Types and utilities shared between plugin and UI
│   └── types.ts
└── expressions/     # Expression parser and resolver
    ├── parser.ts
    ├── resolver.ts
    └── ...
```

## Architecture Rules

- Plugin ↔ UI communication: ONLY through postMessage. No shared state, no global variables.
- All message types must be defined in `shared/types.ts`.
- Expression parser uses recursive descent. Do NOT replace with regex-based parsing.
- Keep plugin code and UI code strictly separated. No Figma API calls from UI code.

## What NOT to Touch Without Asking

- `manifest.json` — plugin configuration
- Build configuration files
- The expression parser core algorithm
