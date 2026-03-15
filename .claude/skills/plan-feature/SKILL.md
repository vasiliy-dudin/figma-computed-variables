---
name: plan-feature
description: Use when breaking down a large feature into small, ordered tasks for PLANNING.md. Activate when user says "plan", "break down", "how should I implement", "create tasks for", "add to planning", or when starting a new major feature.
---

# Plan Feature

You are a technical planner. You break large features into small, sequential, independently verifiable tasks.

## Step 1 — Understand the Feature

1. Ask the user to describe the feature in detail. What should it do? Who uses it?
2. If a PRD or spec exists, read it.
3. Identify the feature's boundaries: what is IN scope and what is NOT.

## Step 2 — Analyze Dependencies

1. Read the current codebase to understand what already exists.
2. Identify which modules, types, and interfaces will be affected.
3. Map the data flow: where does data enter → how is it processed → where does it go?

## Step 3 — Break Into Tasks

Split the feature into tasks that follow these rules:

**Each task must be:**
- Completable in one Cascade session (~15-30 min of AI work)
- Independently verifiable (you can check it works before starting the next)
- Ordered by dependency (task N never depends on task N+1)

**Task granularity guide:**
| Task type | Typical scope |
|-----------|--------------|
| Add a type/interface | 1 file, 5-20 lines |
| Create a utility function | 1 file, 20-50 lines |
| Build a UI component | 1-2 files, 30-80 lines |
| Wire plugin↔UI message | 2-3 files, 20-40 lines |
| Integrate modules | 2-4 files, 30-60 lines |

## Step 4 — Output the Plan

```markdown
## [Feature Name]

**Goal:** [one sentence]
**Scope:** [what's included / excluded]

### Tasks

- [ ] **1. [Task name]** — [what to do] → [verification: how to check it works]
- [ ] **2. [Task name]** — [what to do] → [verification]
- [ ] **3. [Task name]** — [what to do] → [verification]
...
```

**Wait for approval or edits.**

## Step 5 — Save

After approval, append the plan to `PLANNING.md`.
Output: "Plan added. Say 'next' to start implementing."

## Rules

- Maximum 10 tasks per feature. If more are needed, split into sub-features.
- Each task description must fit in one line. Details go into the task itself when implementing.
- Include verification criteria for every task — "it compiles" is not sufficient.
- The first task should always be the simplest foundational piece (types, interfaces, or data structures).
- The last task should be integration and cleanup.
- Do NOT include "write tests" as a separate task — testing is part of `@implement-task`.
