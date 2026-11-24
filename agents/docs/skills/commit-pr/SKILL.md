---
name: commit-pr
description: Produces a commit message and PR description for the current changes.
---

# Commit + PR Text

Inspect the changes in the working directory (`git status`, `git diff`) and produce **only the text**.

## 1. Commit message
- One-line summary in the imperative mood (~50 characters)
- If needed, a blank line + body: **why**, not **what**

## 2. PR description
- **What:** the change in one paragraph
- **Why:** which need/bug
- **How it was tested:** concrete steps

## Important
Do **not** make the change yourself, do **not** commit, do **not** push. Only produce and show the text.

## Missing information
Treat any text written after the command as input. If required information is missing, do not guess; ask ONE question, then continue.
