---
name: test-yaz
description: Writes a behavior-focused test suite for a module, runs it and reports.
---

# Write Tests

Write tests for the given module.

1. **Discover first.** Find the project's test setup and existing patterns; **follow them**, do not bring in a new style.
2. **Cover:** happy path + edge cases (empty, null, 0, negative, very large) + error paths.
3. **Run.** Actually run the tests.
4. **Report:** how many tests ran / passed / failed. If any failed, give the output as is.

If tests did not pass, **say so plainly**; do not assume they passed.

For priority and naming criteria, see the `test-stratejisi` skill.

## Missing information
Treat any text written after the command as input. If required information is missing, do not guess; ask ONE question, then continue.
