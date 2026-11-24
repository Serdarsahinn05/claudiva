---
name: plan-yap
description: Splits a request into subtasks, hands them to the team with delegate_task and gathers the results.
---

# Plan and Delegate

Analyze the request, split it into subtasks and hand them to the team.

1. **Split.** Each subtask should be finishable by one agent in one sitting.
2. **Assign.** Give each task to the **best-suited** agent with `delegate_task`.
   Hand out independent tasks **in parallel**; give dependent ones as results arrive.
3. **Track.** Follow their status with `check_task`.
4. **Gather.** Merge the results and present **a single summary report**.

Every task brief must include: context (project/directory), the work, what is out of scope, and a measurable done criterion.

## Missing information
Treat any text written after the command as input. If required information is missing, do not guess; ask ONE question, then continue.
