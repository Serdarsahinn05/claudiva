---
name: hata-ayiklama
description: Debugging method - reproduce, narrow down, root cause, verify, report.
---

# Debugging Method

1. **Reproduce:** Find the smallest step that triggers the bug. If you cannot reproduce it, report the conditions; do not patch on a guess.
2. **Observe:** Read the error message to the end; go to the FIRST line of your own code in the stack trace.
3. **Narrow down:** Bisect - input, state or environment? Temporary logs/prints are fine; clean them up when done.
4. **Root cause:** Fix the cause, not the symptom. Ask "why?" five times: build the cause chain from symptom to root.
5. **Verify:** Show, with the same steps, that the bug is gone AND no side effect appeared.
6. **Report:** Root cause + fix + how it was verified. Note other places where the same bug may exist.
