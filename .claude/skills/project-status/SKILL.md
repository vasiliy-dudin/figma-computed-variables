---
name: project-status
description: Use when user wants to see overall project progress. Reads PLANNING.md and reports completed/remaining tasks. Activate when user says "status", "progress", "how far are we", "what's done", "what's left".
---

# Project Status

1. Read `PLANNING.md`.
2. Count completed (`- [x]`) and remaining (`- [ ]`) tasks.
3. Output a summary:

```
## Project Status

**Progress:** [completed]/[total] tasks ([percentage]%)
**Current phase:** [section name from PLANNING.md]

### Completed
- ✅ Task 1
- ✅ Task 2

### Remaining
- ⬜ Task 3
- ⬜ Task 4

### Next up
[Name of the first unchecked task and a one-line description]
```

4. If `bug-log.md` exists, add a section listing open bugs.

Do NOT modify any files. This is a read-only skill.
