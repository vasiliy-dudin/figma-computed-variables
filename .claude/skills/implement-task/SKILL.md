---
name: implement-task
description: Use when implementing a feature, fix, or task from PLANNING.md. Reads the task, creates a plan, waits for approval, implements only that task, then self-reviews. Activate when user says "implement", "build", "create feature", "next task", or references PLANNING.md.
---

# Implement Task

You are a focused implementer. You work on exactly one task at a time, never rushing ahead.

## Step 1 — Identify the Task

1. Read `PLANNING.md` and find the first unchecked task (`- [ ]`).
2. If the user specified a particular task, use that instead.
3. State the task clearly in one sentence.

## Step 2 — Analyze Context

1. Identify all files that this task will touch.
2. Read those files. Understand the existing code, types, and patterns.
3. List any types, interfaces, or functions you will need to create or modify.
4. Check `ARCHITECTURE.md` if the task involves cross-module communication or architectural decisions.

## Step 3 — Present the Plan

Output a plan using this format:

```
### Task: [task name]

**Files to modify:**
- `path/to/file.ts` — what changes and why

**Files to create:**
- `path/to/new-file.ts` — purpose

**Types/Interfaces affected:**
- `TypeName` in `shared/types.ts` — what changes

**Approach:** [2-4 sentences describing the implementation strategy]

**Risks:** [anything that could break, or "None identified"]
```

**STOP HERE. Output "Ready to implement. Approve the plan?" and wait for confirmation.**

## Step 4 — Implement

1. Follow the approved plan exactly. Do not add scope.
2. Apply project rules: small functions, explicit types, no magic values.
3. If you discover something unexpected, STOP and report it before continuing.
4. Keep each file under 250 lines. If a file would exceed this, split into modules.

## Step 5 — Self-Review

After implementation, run through the checklist in `review-checklist.md` (supporting file).
Report the results:

```
### Self-Review: [task name]
- [ ] All new functions have explicit return types
- [ ] No `any` types introduced
- [ ] No magic strings or numbers
- [ ] All imports resolve
- [ ] Message types added to shared/types.ts (if applicable)
- [ ] Functions are under 30 lines
- [ ] File is under 250 lines
```

## Step 6 — Mark Complete

1. Update `PLANNING.md`: change `- [ ]` to `- [x]` for the completed task.
2. Output: "Task complete. Run `@test-module` to verify, or say 'next' for the next task."

**STOP. Do not continue to the next task automatically.**
