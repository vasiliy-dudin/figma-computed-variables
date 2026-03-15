---
description: TypeScript coding standards for this project
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript Standards

## Type Safety

- `strict: true` is enabled in tsconfig. NEVER weaken it.
- ALWAYS provide explicit return types for exported functions.
- Use `interface` for object shapes that will be extended. Use `type` for unions, intersections, and simple aliases.
- Use `unknown` instead of `any`. Narrow types with type guards or assertions.
- Use `as const` for literal arrays and objects when values should not change.

## Patterns

- Prefer `const` over `let`. NEVER use `var`.
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of manual null checks.
- Prefer early returns to reduce nesting.
- Prefer `Map` and `Set` over plain objects when keys are dynamic.
- Use discriminated unions for state management instead of boolean flags.

## Imports

- Group imports: (1) external packages, (2) internal absolute paths, (3) relative paths.
- Remove unused imports immediately.
- Prefer named exports over default exports.

## Async

- ALWAYS handle promise rejections. No floating promises.
- Prefer `async/await` over `.then()` chains.
- Use `Promise.all()` for independent parallel operations.
