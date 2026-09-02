# ECS migration summary

Status: Partial
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

The graph architecture is moving state and behavior out of LiteGraph classes
and into dedicated Pinia stores and focused systems. PR 14246 establishes the
main state-ownership bridge while preserving the existing workflow format,
renderers, and extension-facing classes.

## Current result

- `nodeDataStore` owns renderer-facing node shell state.
- `linkStore` owns link topology and slot connectivity.
- `rerouteStore` owns reroute chain state; membership is derived.
- `widgetValueStore` owns widget values, render metadata, and order.
- Yjs-backed `layoutStore` owns persistent node, group, and reroute geometry.
- `badgeSystem` derives transient badge rows instead of storing them.
- Graph lifecycle registers and transfers migrated state across root graphs and
  nested subgraph definitions. Clear paths tear it down; normal node removal
  can retain widget entries until explicit deletion or root clear.
- Identity normalization protects store ownership during load, copy/paste,
  insertion, conversion, and replacement.

Legacy classes remain compatibility facades. Node, link, reroute, and widget
state generally share the store's reactive object instead of maintaining a
second copy.

## What remains

This phase still has authority-centralization work:

- Slots, graph/subgraph definitions, groups, properties, metadata, and some
  durable render inputs remain class-owned.
- Widget values/order, outputs/previews, z-order, unknown-node records, and live
  graph registries retain duplicate or competing representations.
- Lifecycle and invalidation logic remains distributed across stores and legacy
  classes.
- Extension compatibility and large-workflow performance need broader evidence
  before bridge APIs can be removed.

The immediate priority is to prove mixed undo/load-failure behavior, recursive
identity handling, extension compatibility, and renderer performance while
centralizing the remaining Component and Entity data and deleting synchronization
bridges. A system-wide Command pattern, command replay/undo, workflow
transactions, and CRDT support beyond layout are later work outside this phase.

## Reference map

| Question                                                          | Reference                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| What has shipped and what remains?                                | [Migration plan](ecs-migration-plan.md)                               |
| How does implementation align with ADR-LAYOUT and ADR-ECS?        | [Decision traceability](ecs-decision-traceability.md)                 |
| Which source owns each kind of state?                             | [State authority audit](ecs-state-authority-audit.md)                 |
| How are entities registered, replaced, removed, and cleared?      | [Lifecycle audit](ecs-lifecycle-audit.md)                             |
| Which writes are commands, store actions, or direct mutations?    | [Mutation audit](ecs-mutation-audit.md)                               |
| How do IDs and graph scopes work?                                 | [Identity and scope audit](ecs-identity-scope-audit.md)               |
| What changes affect extensions?                                   | [Extension compatibility audit](ecs-extension-compatibility-audit.md) |
| Which invariants are tested and where are the gaps?               | [Verification audit](ecs-verification-audit.md)                       |
| Which existing architecture documents are stale or contradictory? | [Documentation audit](ecs-documentation-audit.md)                     |

The ADRs remain the decision records:
[ADR-LAYOUT](../../adr/LAYOUT-crdt-layout-intent-and-local-measurement.md) governs centralized
CRDT layout, and [ADR-ECS](../../adr/ECS-entity-component-system.md) governs
the ECS direction. These audits report implementation status without
modifying those decisions.
