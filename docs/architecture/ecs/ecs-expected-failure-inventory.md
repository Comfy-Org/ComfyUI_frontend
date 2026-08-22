# ECS expected-failure inventory

This inventory covers the compatibility regressions marked with Vitest
`.fails()` on the ECS migration stack and its reproduction PRs. A marker should
be removed only after the same test passes as a plain `it()` test.

## Activated by this stack

Five reproduction tests now pass normally:

| Source          | Tests | Resolution                                                                                                                                  |
| --------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| #15592 / #15577 |     3 | Preserve the input-referenced link through deduplication, retain it through serialization, and identify the occupied target in the warning. |
| #15595          |     2 | Rehydrate indexed plain-object input slots so spread copies retain live connectivity.                                                       |

## Remaining expected failures

Eight tests remain marked `.fails()`:

| Area                                 | Tests | Required fix                                                                                                  |
| ------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------- |
| Legacy slot link creation            |     2 | Proxy additions through `input.link` and `output.links` into link-store registration, not only removals.      |
| Input-slot realignment (#15581)      |     4 | Remove or relocate unmatched blockers in the same topology update so valid sibling moves land without errors. |
| Enumerable `LLink` topology (#15594) |     2 | Expose topology fields as own enumerable properties so link spread copies preserve their endpoints.           |

The markers live in:

- `src/lib/litegraph/src/node/legacySlotLinkMutations.test.ts`
- `src/lib/litegraph/src/LGraph.inputSlotRealign.test.ts`
- `src/lib/litegraph/src/LLink.spreadCopy.test.ts`
