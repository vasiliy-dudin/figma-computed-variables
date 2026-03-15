---
name: fix-errors
description: Use when there are TypeScript type errors to fix. Run typecheck, then fix all errors one by one, re-checking after each fix. Activate when user says "fix errors", "fix type errors", "fix all", "fix tsc".
---

# Fix Errors — Find and Fix All Type Errors

1. Run `npx tsc --noEmit`.
2. If no errors, output "No type errors ✓" and STOP.
3. If there are errors, sort them by category:
   - **Import errors** (missing modules, wrong paths) — fix first
   - **Type mismatches** (wrong argument types, missing properties) — fix second
   - **Other** (unused variables, implicit any) — fix last

4. Fix ONE error at a time:
   a. Show the error and your proposed fix.
   b. Apply the fix.
   c. Re-run `npx tsc --noEmit` to check if the fix introduced new errors.
   d. If new errors appeared, revert and try a different approach.

5. After all errors are fixed, run `npx tsc --noEmit` one final time.
6. Output: "All [count] errors fixed ✓"
