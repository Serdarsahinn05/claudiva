---
name: review-checklist
description: Code review checklist: correctness, security, performance, maintainability.
---

# Code Review Checklist

## Correctness
- [ ] Edge cases: empty array, null/undefined, 0, negative, very large input.
- [ ] Error paths: are throw/reject caught, are resources (file, connection, timer) closed?
- [ ] Concurrency: shared state, race conditions, promises missing an await.
- [ ] Is the change compatible with ALL callers (if a signature/contract changed)?

## Security
- [ ] Is user input validated (injection, path traversal, XSS)?
- [ ] Are secrets (keys, passwords) in code/logs?
- [ ] Is the authorization check in the right layer?

## Performance
- [ ] IO/queries inside a loop? N+1?
- [ ] Is any growable data structure unbounded (memory leak)?

## Maintainability
- [ ] Misleading names? Dead code left behind?
- [ ] Tests: is a critical path left untested?
