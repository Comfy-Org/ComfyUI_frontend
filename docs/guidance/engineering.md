---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# Engineering Guidelines

1. If a complex type definition is inlined in multiple related places, extract and name it for reuse.
2. Minimize the surface area (exported values) of each module and composable. Do not add barrel files that re-export within `src/`.
3. Use function declarations instead of function expressions where possible.
4. Minimize nesting; prefer early returns.
5. Do not add alias helpers whose implementation is just a single-line call to another function.
   - Bad: `function id(value) { return toNodeId(value) }`
   - Use the real function directly, or introduce a named helper only when it adds validation, branching, domain meaning, or shared behavior beyond renaming.
6. Prioritize clean, stable public APIs that restrict extension access; thousands of users and custom-node extensions depend on them.

## Code Review

- Treat every added comment other than curt JSDoc on an exported API as a blocking finding, including comments that explain why. Ask for a rename, an extraction, a type, or a test, and move the rationale to the commit message, the PR description, or an ADR.
- Flag over-engineering: code more generic than the problem in front of it, or functionality the system does not need yet.
