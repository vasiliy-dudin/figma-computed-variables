---
name: review-changes
description: Use when reviewing the most recently changed or staged files via git diff. Checks correctness, readability, types, and architecture. Activate when user says "review changes", "review my diff", "review what I changed", "check my changes", or after a coding session.
---

# Review Changes — Code Review via Git Diff

1. Run `git diff HEAD` (or `git diff --cached` if changes are staged) to identify what changed.
2. For each changed file, review against these criteria:

   **Correctness:** Does the logic do what it should? Edge cases handled?
   **Readability:** Can another developer understand this in 30 seconds?
   **Types:** Explicit return types? No `any`? Proper narrowing?
   **Architecture:** Respects plugin↔UI boundary? Message types in `shared/types.ts`?

3. For each issue, output:
   ```
   ⚠️ [file]:[line] — [issue description]
   Suggestion: [specific fix]
   Severity: critical | warning | nit
   ```

4. End with a summary:
   ```
   ## Review Summary
   - Critical: [count]
   - Warnings: [count]
   - Nits: [count]
   - Verdict: PASS / PASS WITH WARNINGS / NEEDS CHANGES
   ```

5. Do NOT modify any files. This is a read-only skill.
