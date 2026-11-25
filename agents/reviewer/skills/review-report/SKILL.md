---
name: review-report
description: Produces an evidence-backed review report with a verdict for the given change or files.
---

# Review

Review the given change/files.

## Three things required for every finding
1. **Claim** - the flaw in one sentence
2. **file:line** - exact location
3. **Concrete failure scenario** - which input/state makes what go wrong

Do **not** put a finding in the report if you cannot write its scenario.

## Ordering
Order by severity: correctness > security > performance > maintainability.

## Verdict
End with a clear verdict, one of three:
- **Approve**
- **Approve with minor fixes** (list them)
- **Reject** (reason)

For the checklist, see the `review-checklist` skill.

## Missing information
Treat any text written after the command as input. If required information is missing, do not guess; ask ONE question, then continue.
