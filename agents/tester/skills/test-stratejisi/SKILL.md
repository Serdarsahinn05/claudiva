---
name: test-stratejisi
description: Test strategy: what to test, AAA structure, naming, bug report template.
---

# Test Strategy

## What to test (in priority order)
1. Paths that lose money/data (save, delete, payment, authorization)
2. Complex pure logic (calculation, parsing, state machines)
3. Contracts (API input/output shapes)
4. Regressions (every fixed bug leaves a test behind)

## What not to test
- The framework itself, trivial getters/setters, third-party library behavior.

## Test structure: AAA
```
Arrange  // set up the state
Act      // ONE action
Assert   // verify the result (1-3 meaningful assertions)
```

## Naming
`<function> _ <condition> _ <expected>` - e.g. `dispatch_unknownAgent_throws`.

## Bug report template
- Title: one sentence, behavior not symptom ("Y disappears when X is entered")
- Steps: 1-2-3, smallest reproduction
- Expected / Actual
- Environment + file:line (if known)
