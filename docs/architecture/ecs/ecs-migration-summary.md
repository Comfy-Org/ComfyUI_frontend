# ECS Migration Executive Summary

Status: Partial
Verified: 2026-08-16 against PR 14246

The graph architecture is moving from state and behavior concentrated in
LiteGraph classes to dedicated Pinia stores and focused systems. PR 14246
establishes the main state-ownership bridge while preserving the existing
workflow format, renderers, and extension-facing classes.

## Current result

- `nodeDataStore` owns renderer-facing node shell state.
- `linkStore` owns link topology and slot connectivity.
- `rerouteStore` owns reroute chain state; membership is derived.
- `widgetValueStore` owns widget values, render metadata, and order.
- Yjs-backed `layoutStore` owns persistent node, group, and reroute geometry.
- `badgeSystem` derives transient badge rows instead of storing them.
- Graph lifecycle registers, transfers, and tears down migrated state across
  root graphs and nested subgraph definitions.
- Identity normalization protects store ownership during load, copy/paste,
  insertion, conversion, and replacement.

Legacy classes remain compatibility facades. For node, link, reroute, and
widget state, they generally share the store's reactive object rather than
maintaining a second copy.

## What remains

This is not yet a fully command-driven ECS:

- Serializable operations currently cover layout, not all graph mutations.
- Cross-store changes have no workflow-wide transaction or rollback boundary.
- Undo/redo remains snapshot-based.
- Slots, widgets, and substantial graph behavior remain class-based.
- Widget order and live graph registries retain transitional dual
  representations.
- Extension compatibility and large-workflow performance need broader evidence
  before bridge APIs can be removed.

The immediate priority is to prove mixed undo/load-failure behavior, recursive
identity handling, extension compatibility, and renderer performance. The next
architectural step is to define mutation and transaction boundaries before
extracting more systems or removing legacy facades.

## Reference map

| Question                                                          | Reference                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| What has shipped and what remains?                                | [Migration plan](ecs-migration-plan.md)                               |
| How does implementation align with ADR 0003 and ADR 0008?         | [Decision traceability](ecs-decision-traceability.md)                 |
| Which source owns each kind of state?                             | [State authority audit](ecs-state-authority-audit.md)                 |
| How are entities registered, replaced, removed, and cleared?      | [Lifecycle audit](ecs-lifecycle-audit.md)                             |
| Which writes are commands, store actions, or direct mutations?    | [Mutation audit](ecs-mutation-audit.md)                               |
| How do IDs and graph scopes work?                                 | [Identity and scope audit](ecs-identity-scope-audit.md)               |
| What changes affect extensions?                                   | [Extension compatibility audit](ecs-extension-compatibility-audit.md) |
| Which invariants are tested and where are the gaps?               | [Verification audit](ecs-verification-audit.md)                       |
| Which existing architecture documents are stale or contradictory? | [Documentation audit](ecs-documentation-audit.md)                     |

The ADRs remain the decision records:
[ADR 0003](../../adr/0003-crdt-based-layout-system.md) governs centralized
CRDT layout, and [ADR 0008](../../adr/0008-entity-component-system.md) governs
the ECS direction. These audits report implementation status without
modifying those decisions.
