---
name: next-task
description: Use to pick up and implement the next task from PLANNING.md. Full loop: read task, plan, wait for approval, implement, self-review, mark done. Activate when user says "next task", "next", "continue", "implement next", or just "/task".
---

# Next Task — Implement Next Task from PLANNING.md

## Step 1 — Find the Task

1. Read `PLANNING.md`. Find the first unchecked task (`- [ ]`).
2. If no unchecked tasks remain, report "All tasks complete ✓" and STOP.
3. State the task name and which files will be affected.

## Step 2 — Create an Implementation Plan

Present a brief plan:

```
### Task: [task name]

**Files to modify:**
- `path/to/file.ts` — what changes and why

**Files to create:**
- `path/to/new-file.ts` — purpose

**Types/Interfaces affected:**
- `TypeName` in `shared/types.ts` — what changes

**Approach:** [2-4 sentences]

**Risks:** [anything that could break, or "None identified"]
```

**STOP. Output "Ready to implement. Approve the plan?" and wait for confirmation.**

## Step 3 — Implement

1. Follow the approved plan exactly. Do not add scope.
2. One file at a time.
3. If you discover something unexpected, STOP and report it before continuing.

## Step 4 — Self-Review Checklist

```
### Self-Review: [task name]
- [ ] All new functions have explicit return types
- [ ] No `any` types introduced
- [ ] No magic strings or numbers
- [ ] All imports resolve
- [ ] Message types added to shared/types.ts (if applicable)
- [ ] Functions are ≤ 30 lines
- [ ] Files are ≤ 250 lines
```

## Step 5 — Mark Complete

Update `PLANNING.md`: change `- [ ]` to `- [x]`.

Output: "Task complete. Say 'next' for the next one."

**STOP. Do not continue to the next task automatically.**
