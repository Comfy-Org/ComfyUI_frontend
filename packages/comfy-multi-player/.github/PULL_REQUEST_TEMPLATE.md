## Problem / Goal

<!-- What is broken, or what capability is missing? -->

## Proposed Solution

<!-- What does this change do, and why this approach? -->

## Acceptance Criteria

<!-- How does a reviewer confirm the change is correct? -->

**Affected invariants** — list every `KA-*` / `FC-*` invariant touched by this
change and state how each is preserved. Changes to op semantics, public
exports, the dependency set, or the widget catalog must cite the affected IDs
(see [`docs/INVARIANTS.md`](../docs/INVARIANTS.md)). Deliberate deviations
require an entry in
[`docs/decisions/EXCEPTIONS.md`](../docs/decisions/EXCEPTIONS.md) before merge.

**Local gates** — confirm all nine pass locally:

```sh
npm ci && npm run build && npm run check:purity && npm run check:imports \
  && npm run check:pins && npm run check:profile-claims \
  && npm run check:coderabbit && npm run verify:corpus && npm test
```
