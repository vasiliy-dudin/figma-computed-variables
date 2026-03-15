---
name: typecheck
description: Use when user wants to check TypeScript compilation errors without fixing them. Activate when user says "typecheck", "check types", "tsc", "any type errors?", "does it compile".
---

# Typecheck — Full Project Type Check

1. Run `npx tsc --noEmit` in the project root.
2. If no errors: output "Type check passed ✓ — no errors found." and STOP.
3. If there are errors, for each error output:
   ```
   ❌ [file]:[line] — [error message]
   ```
4. Group errors by file. Show the total count at the end.
5. Do NOT fix errors automatically — wait for the user to ask.
6. If the user says "fix", hand off to the fix-errors skill.
