# Complexity and refactoring review

Apply this profile to new or significantly changed logic in `src/**`, especially `applier.ts` and the autogrow/connect paths.

- Flag high cyclomatic complexity (>10 high, >15 critical), deep nesting (>4 levels), oversized functions (>50 lines doing several things), long parameter lists (>5), and boolean expressions with more than three clauses. Prefer guard clauses, early returns, named booleans, and extracted cohesive helpers.
- Flag duplicated logic in the diff (two blocks doing essentially the same thing) and unnecessary indirection (wrappers that add nothing, single-use abstractions).
- Some complexity here is inherent to the domain: the applier is a protocol/state handler and the stamp comparator is exacting. Do not flag inherent protocol complexity or stable, well-tested code that merely happens to be dense. Do flag accidental complexity in new code that will make the next op kind or widget strategy harder to add safely.
- Always give a concrete refactor, not just "too complex". High severity when the complexity will likely cause a correctness bug during future edits (this package's mutations are hard to reason about under concurrency); medium for readability; low for optional simplification.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
