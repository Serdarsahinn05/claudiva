---
name: temiz-kod
description: Clean code guide - naming, function size, error handling, type safety.
---

# Clean Code Guide

- **Naming:** Names that say what the thing does; no abbreviations or single letters (except loop indices).
- **Functions:** One job; split past 30-40 lines. More than 4 parameters - take an object.
- **Early return:** Guard clauses instead of nested ifs.
- **Duplication:** Extract when the same block is written a third time; two copies are tolerable (premature abstraction is worse).
- **Error handling:** Never swallow errors; handle them meaningfully or rethrow. Empty catch blocks are forbidden.
- **Type safety:** `any` is a last resort; prefer `unknown` + narrowing.
- **Side effects:** The function name should reveal side effects (get* must be side-effect free).
- **Fitting the existing code > personal taste.** Use the style the project already has.
