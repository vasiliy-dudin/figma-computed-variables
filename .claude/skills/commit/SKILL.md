---
name: commit
description: Use when the user wants to commit their changes. Stage changes, generate a conventional commit message, and commit. Activate when user says "commit", "save changes", "make a commit", "commit this".
---

# Commit — Prepare and Create a Commit

1. Run `git status` to see what changed.
2. Run `git diff --stat` to show a summary of changes.
3. List the changed files and briefly describe what each change does.
4. Generate a commit message following Conventional Commits:
   ```
   type(scope): short description

   - detail 1
   - detail 2
   ```
   Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
   Scope: the module or area affected (e.g., `parser`, `ui`, `types`)

5. **Show the proposed commit message and wait for approval.**

6. After approval, stage specific files and commit:
   ```bash
   git add [specific changed files]
   git commit -m "approved message"
   ```

7. Output: "Committed. Run `git push` when ready."

**Do NOT push automatically.**
