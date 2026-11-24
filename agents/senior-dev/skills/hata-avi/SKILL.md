---
name: hata-avi
description: Reproduces a bug, finds the root cause and fixes it; never patches the symptom.
---

# Bug Hunt

Solve a bug **by its root cause**. Patching the symptom is forbidden.

1. **Reproduce.** Find the smallest step that triggers it. If you cannot reproduce it, report the conditions; do not patch on a guess.
2. **Narrow down.** Input, state or environment? Bisect.
3. **Root cause.** Build the chain of causes from the symptom down to the root.
4. **Fix.** Only the root cause; do not spill out of scope.
5. **Verify.** Show, with the same steps, that the bug is gone AND no side effect appeared.

Write three separate headings in your report: **root cause**, **fix**, **how you verified it**.
Also note other places where the same bug could recur.

For the detailed method, see the `hata-ayiklama` skill.

## Missing information
Treat any text written after the command as input. If required information is missing, do not guess; ask ONE question, then continue.
