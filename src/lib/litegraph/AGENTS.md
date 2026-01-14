# Litegraph Guidelines

## Code Style

- Prefer single line `if` syntax for concise expressions
- Take advantage of `TypedArray` `subarray` when appropriate
- The `size` and `pos` properties of `Rectangle` share the same array buffer
- Do not replace `&&=` or `||=` without reason; comment if you do
- Prefer returning `undefined` over `null`
- Type assertions are a last resort (acceptable for legacy code interop)

## ESLint

Run ESLint instead of manually fixing style issues:
```bash
pnpm lint:fix
```

## Circular Dependencies in Tests

**CRITICAL**: Always import from the barrel export for subgraph code:

```typescript
// ✅ Correct - barrel import
import { LGraph, Subgraph, SubgraphNode } from "@/lib/litegraph/src/litegraph"

// ❌ Wrong - causes circular dependency
import { LGraph } from "@/lib/litegraph/src/LGraph"
```

**Root cause**: `LGraph` ↔ `Subgraph` circular dependency (Subgraph extends LGraph, LGraph creates Subgraph instances).

## Test Helpers

```typescript
import { createTestSubgraph, createTestSubgraphNode } from "./fixtures/subgraphHelpers"

function createTestSetup() {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  return { subgraph, subgraphNode }
}
```
