// ${MODULE_NAME}.test.ts
// Lightweight tests — no framework required
// Run: npx ts-node ${MODULE_NAME}.test.ts

import { /* functions to test */ } from './${MODULE_NAME}';

// --- Test Utilities ---

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`FAIL [${label}]: expected ${e}, got ${a}`);
}

function assertThrows(fn: () => void, label: string): void {
  try {
    fn();
    throw new Error(`FAIL [${label}]: expected an error but none was thrown`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('FAIL')) throw e;
    // Expected error — pass
  }
}

// --- Happy Path ---

// assertEqual(myFunction('input'), expectedOutput, 'description');

// --- Edge Cases ---

// assertEqual(myFunction(''), defaultValue, 'empty input');
// assertEqual(myFunction(null), defaultValue, 'null input');

// --- Error Cases ---

// assertThrows(() => myFunction(invalidInput), 'should reject invalid input');

// --- Result ---

console.log('All tests passed ✓');
