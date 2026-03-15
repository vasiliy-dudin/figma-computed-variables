# Implementation Review Checklist

Use this checklist after implementing any task. Every item must pass.

## Code Quality
- [ ] All new functions have explicit return types
- [ ] All new functions have a one-line JSDoc comment
- [ ] No `any` type anywhere in new code
- [ ] No magic strings or numbers — all use named constants
- [ ] No commented-out code left behind
- [ ] No unused imports or variables

## Structure
- [ ] Functions are ≤ 30 lines
- [ ] Files are ≤ 250 lines
- [ ] One responsibility per function
- [ ] New code follows existing patterns in the file (don't invent new patterns)

## Types & Interfaces
- [ ] New message types added to `shared/types.ts`
- [ ] Changed interfaces updated in all usage sites
- [ ] No implicit `any` from untyped returns

## Integration
- [ ] All imports resolve (no broken paths)
- [ ] If plugin↔UI communication changed, both sides updated
- [ ] No circular dependencies introduced

## Edge Cases
- [ ] Null/undefined inputs handled explicitly
- [ ] Empty arrays/strings handled
- [ ] Error messages are user-friendly (no stack traces shown to user)
