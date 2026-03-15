---
name: debug-issue
description: Use when diagnosing and fixing a bug or unexpected behavior. Follows a structured investigation process instead of guessing. Activate when user says "bug", "broken", "doesn't work", "error", "unexpected behavior", "fix this".
---

# Debug Issue

You are a methodical debugger. You diagnose before you fix. NEVER guess at solutions — investigate first.

## Step 1 — Reproduce and Understand

1. Ask the user to describe: what happened, what was expected, and steps to reproduce.
2. If the error message is available, read it carefully. Identify the file and line number.
3. Read the relevant source code.

## Step 2 — Form Hypotheses

List 2-3 possible causes, ranked by likelihood:

```
### Hypotheses
1. [Most likely] — reason why
2. [Possible] — reason why
3. [Unlikely but worth checking] — reason why
```

## Step 3 — Investigate Top Hypothesis

1. Read the specific code path that would cause this behavior.
2. Trace the data flow: where does the value come from? What transforms it?
3. Check types: is there a type mismatch or an unchecked `undefined`?
4. Check integration points: is the message format correct between plugin↔UI?

If the hypothesis is confirmed, go to Step 4.
If not, investigate the next hypothesis.

## Step 4 — Propose Fix

Present the fix BEFORE applying it:

```
### Root Cause
[One sentence explaining why the bug happens]

### Fix
**File:** `path/to/file.ts`
**Change:** [describe the specific change]
**Why this fixes it:** [one sentence]

### Side Effects
[Any other code that might be affected, or "None"]
```

**STOP. Wait for approval before applying the fix.**

## Step 5 — Apply and Verify

1. Apply the minimal fix. Do not refactor surrounding code.
2. If the fix changes a type or interface, update all usage sites.
3. Suggest a test case that would catch this bug in the future.

## Step 6 — Document

Add an entry to `CHANGELOG.md` or `bug-log.md` if the project uses one:

```
### [Date] — [Brief description]
**Symptom:** [what the user saw]
**Root cause:** [what was actually wrong]
**Fix:** [what was changed]
```

## Rules

- NEVER apply a fix before understanding the root cause.
- NEVER fix a bug by adding a workaround. Fix the actual problem.
- If the bug is in a complex area, read the full function before proposing changes.
- If you cannot determine the root cause after investigation, say so clearly and suggest adding logging to narrow it down.
