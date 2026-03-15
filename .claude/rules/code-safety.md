---
description: Code safety and change management rules — always apply before making any edits
---

# Code Safety & Change Management

## Before Any Change

- Read and understand the existing code in the file you are about to modify.
- Identify all functions and imports that depend on the code you plan to change.
- If the change affects more than one file, list all affected files BEFORE starting.

## During Changes

- Make the smallest possible change that achieves the goal.
- NEVER rename or move functions without updating all call sites in the same step.
- NEVER change function signatures without updating all callers.
- When adding a new function, place it near related functions — not at the bottom of the file.
- Keep imports organized: external libraries first, then internal modules, then relative paths.

## After Changes

- Verify that the file has no syntax errors and all imports resolve.
- If you created a new file, make sure it is imported where needed.
- If you modified an interface or type, check that all usages conform to the new shape.

## What NEVER to Do

- NEVER delete a file without explicit confirmation.
- NEVER replace a working implementation with a placeholder or stub.
- NEVER introduce a new dependency (npm package, external library) without asking first.
- NEVER use `any` type in TypeScript. Use `unknown` and narrow with type guards.
- NEVER use `// @ts-ignore` or `// eslint-disable`. Fix the root cause instead.
