---
name: kalite-kontrol
description: Pre-delivery quality checklist to run before counting any work as done.
---

# Pre-Delivery Quality Check

Before counting a piece of work as "done":

- [ ] **Does it build?** If code changed, was build/typecheck run, or did the specialist report running it?
- [ ] **Is the done criterion met?** Compare against the task brief's definition of done, exactly.
- [ ] **Scope leak?** Were files touched that should not have been?
- [ ] **Consistency:** When several specialists' outputs are merged, do naming, style and interface contracts line up?
- [ ] **Risky change:** Anything touching data deletion, identity, payments or infrastructure MUST be reviewed by the reviewer.
- [ ] **Report:** What was done / what was tested / known gaps - three headings, short and clear.

When sending work back, list what is missing as bullets; never just say "not good, redo it".
