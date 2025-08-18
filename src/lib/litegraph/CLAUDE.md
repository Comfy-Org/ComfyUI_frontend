- This codebase has extensive eslint autofix rules and IDEs are configured to use eslint as the format on save tool. Run ESLint instead of manually figuring out whitespace fixes or other trivial style concerns. Review the results and correct any remaining eslint errors.
- Take advantage of `TypedArray` `subarray` when appropriate.
- The `size` and `pos` properties of `Rectangle` share the same array buffer (`subarray`); they may be used to set the rectangles size and position.
- Prefer single line `if` syntax over adding curly braces, when the statement has a very concise expression and concise, single line statement.
- Do not replace `&&=` or `||=` with `=` when there is no reason to do so. If you do find a reason to remove either `&&=` or `||=`, leave a comment explaining why the removal occurred.
- You are allowed to research code on https://developer.mozilla.org/ and https://stackoverflow.com without asking.
- When adding features, always write vitest unit tests using cursor rules in @.cursor
- When writing methods, prefer returning idiomatic JavaScript `undefined` over `null`.

# Bash commands

- `npm run typecheck` Run the typechecker
- `npm run build` Build the project
- `npm run lint:fix` Run ESLint

# Code style

- Always prefer best practices when writing code.
- Write using concise, legible, and easily maintainable code.
- Avoid repetition where possible, but not at the expense of code legibility.
- Type assertions are an absolute last resort. In almost all cases, they are a crutch that leads to brittle code.

# Workflow

- Be sure to typecheck when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance

# Testing Guidelines

## Avoiding Circular Dependencies in Tests

**CRITICAL**: When writing tests for subgraph-related code, always import from the barrel export to avoid circular dependency issues:

```typescript
// ✅ CORRECT - Use barrel import
import { LGraph, Subgraph, SubgraphNode } from "@/lib/litegraph/src/litegraph"

// ❌ WRONG - Direct imports cause circular dependency
import { LGraph } from "@/lib/litegraph/src/LGraph"
import { Subgraph } from "@/lib/litegraph/src/subgraph/Subgraph" 
import { SubgraphNode } from "@/lib/litegraph/src/subgraph/SubgraphNode"
```

**Root cause**: `LGraph` and `Subgraph` have a circular dependency:
- `LGraph.ts` imports `Subgraph` (creates instances with `new Subgraph()`)
- `Subgraph.ts` extends `LGraph` 

The barrel export (`@/litegraph`) handles this properly, but direct imports cause module loading failures.

## Test Setup for Subgraphs

Use the provided test helpers for consistent setup:

```typescript
import { createTestSubgraph, createTestSubgraphNode } from "./fixtures/subgraphHelpers"

function createTestSetup() {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  return { subgraph, subgraphNode }
}
```
