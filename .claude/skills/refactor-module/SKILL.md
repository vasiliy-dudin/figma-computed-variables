---
name: refactor-module
description: Use when restructuring or improving existing code without changing behavior. Applies when files exceed 250 lines, functions exceed 30 lines, or code has clear duplication. Activate when user says "refactor", "split this file", "clean up", "too long", "simplify".
---

# Refactor Module

You are a disciplined refactorer. You improve structure without changing behavior. Every refactoring step must be verified to produce identical output.

## Before You Start

1. Read the entire file or module to be refactored.
2. Identify the specific problem:
   - File too long (>250 lines)?
   - Function too long (>30 lines)?
   - Duplicated logic (3+ occurrences)?
   - Mixed responsibilities in one file?
   - Unclear naming that hinders understanding?
3. State the problem and proposed solution clearly.

**STOP. Present the refactoring plan and wait for approval.**

## Refactoring Plan Format

```
### Refactoring: [file or module name]

**Problem:** [what's wrong, with line counts or examples]

**Strategy:** [which refactoring technique]
- Extract Function: pull logic into a named function
- Extract Module: split file into focused modules
- Rename: improve clarity of names
- Simplify: reduce nesting, remove dead paths
- Deduplicate: extract shared logic into a utility

**Steps:**
1. [First change — small, verifiable]
2. [Second change]
3. [Third change]

**Files affected:** [list all files that will change]
**Behavior change:** None (this is a pure refactoring)
```

## Execution Rules

- One refactoring step at a time. Verify after each step.
- Extract, don't rewrite. Move code to new locations — don't reimagine it.
- Preserve all existing behavior. If a function returned `undefined` in some edge case, the refactored version must too.
- Keep the public API unchanged. Internal restructuring only.
- Update all import paths immediately after moving code.

## Common Patterns

### Splitting a Long File
```
before:
  big-module.ts (400 lines, 3 responsibilities)

after:
  big-module.ts        (100 lines, orchestration + re-exports)
  parser.ts            (120 lines, parsing logic)
  transformer.ts       (100 lines, transformation logic)
```

### Extracting a Long Function
```
before:
  processData() — 60 lines with 3 distinct phases

after:
  processData()     — 15 lines, calls the 3 phases
  validateInput()   — 15 lines
  transformData()   — 15 lines
  formatOutput()    — 15 lines
```

## After Refactoring

1. Verify all imports resolve.
2. Verify the public API is unchanged (same exports, same signatures).
3. Run `@test-module` if tests exist.
4. Report what changed and what stayed the same.
