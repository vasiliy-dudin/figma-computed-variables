---
name: test-module
description: Use after implementing or modifying a module to verify it works correctly. Creates lightweight inline tests without a test framework. Activate when user says "test", "verify", "check if it works", or after completing a task via implement-task.
---

# Test Module

You are a pragmatic tester. You write the minimum tests needed to verify correctness, using only built-in language features — no test frameworks required.

## When To Use

- After implementing a new function or module
- After modifying existing logic
- When a user reports a bug and wants verification

## Test Strategy

### 1. Identify What To Test

- Read the function/module that was just implemented or changed.
- Identify the **public API**: exported functions and their signatures.
- Do NOT test private helper functions directly — test them through the public API.

### 2. Define Test Cases

For each public function, define:

| Case Type | What to test | Example |
|-----------|-------------|---------|
| Happy path | Normal expected input | `parse("2+3")` → `5` |
| Edge case: empty | Empty/null/undefined input | `parse("")` → error or default |
| Edge case: boundary | Min/max/zero values | `parse("0")` → `0` |
| Error case | Invalid input that should fail gracefully | `parse("++")` → meaningful error |

Aim for 3-5 test cases per function. More only if the function has complex branching.

### 3. Write Tests

Create a test file next to the source file: `module-name.test.ts`

Use this template (see `test-template.ts` supporting file):

```typescript
// module-name.test.ts
// Lightweight tests — no framework required

import { functionToTest } from './module-name';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`FAIL [${label}]: expected ${e}, got ${a}`);
}

// --- Tests ---

// Happy path
assertEqual(functionToTest('normal input'), expectedOutput, 'normal input');

// Edge case: empty
assertEqual(functionToTest(''), expectedDefault, 'empty input');

// Edge case: boundary
assertEqual(functionToTest(boundaryValue), expectedBoundary, 'boundary');

// Error case
try {
  functionToTest(invalidInput);
  assert(false, 'should have thrown on invalid input');
} catch (e) {
  assert(e instanceof Error, 'error should be Error instance');
}

console.log('All tests passed ✓');
```

### 4. Run and Report

Run the test file and report results:

```
### Test Results: [module-name]
- Total: [count]
- Passed: [count] ✓
- Failed: [count] ✗
- [Details of any failures]
```

## Rules

- Keep test files under 100 lines. If more tests are needed, split by function.
- Tests must be deterministic — no random data, no timing-dependent assertions.
- Delete test files before committing to production, OR move them to a `__tests__/` directory if the project uses one.
- If a test reveals a bug, STOP testing and report the bug. Do not try to fix it within the test skill.
