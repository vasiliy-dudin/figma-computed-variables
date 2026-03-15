---
name: cleanup
description: Use when removing dead code, unused imports, or stale variables from the project. Activate when user says "cleanup", "remove dead code", "unused imports", "clean up the project".
---

# Cleanup — Remove Dead Code

1. Scan all `.ts` and `.tsx` files for:
   - Unused imports (imported but never referenced)
   - Unused variables and constants
   - Unused exported functions (exported but never imported elsewhere)
   - Commented-out code blocks (more than 2 lines)
   - Empty files or files with only imports

2. For each finding, output:
   ```
   🧹 [file]:[line] — [what's unused and why it's safe to remove]
   ```
   Group findings by file. Show the total count.

3. **Wait for approval before removing anything.**

4. After approval, remove all approved items.

5. Run `npx tsc --noEmit` to verify nothing broke.

6. Output: "Cleaned up [count] items. Type check passed ✓"
