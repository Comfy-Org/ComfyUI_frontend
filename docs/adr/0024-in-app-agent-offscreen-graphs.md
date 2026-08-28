# 0024. In-App Agent Offscreen Graphs and Target Addressing

Date: 2026-08-28

## Status

Proposed

## Context

An In-App Agent turn can continue working on workflow A while the user views and edits
workflow B. The active canvas is therefore a presentation choice, not the address of the
agent's mutation. A follower that samples the active graph at apply time can write A's
remote effects into B. A single follower document also cannot isolate two agent targets or
hold effects for a target whose graph is not currently loaded.

The cross-repository contract is recorded in the program's
[ADR-015](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-015-target-graph-addressing-and-offscreen-queues.md).
This ADR places the frontend obligations at the store, follower, and rendering boundaries.

## Decision

Every remote mutation batch is routed by its explicit canonical `workflow_id` document
identity. The frontend will maintain target-keyed follower sessions rather than selecting a
scope from `canvasStore` or `app.graph` at apply time.

Each target session owns its follower Y.Doc, resolved `GraphScope`, state-vector and sequence
baseline, document lineage, and bounded pending-effect queue. A loaded target applies through
the yjs-backed ECS/domain stores even when it is offscreen. An unloaded target is queued by
target identity until its domain registration is available, or recovered with a
target-scoped state-vector resubscribe after queue loss or overflow. A target mismatch is a
rejection, never an active-canvas fallback.

Remote apply may update target domain and target-aware layout state only. It must not focus a
tab, alter selection or presence, call active-canvas-only APIs, or require a renderer-attached
graph. Layout remains in the separate frontend-owned Y.Doc described by [ADR-0003](0003-crdt-based-layout-system.md).
The follower remains host-to-follower for raw Yjs updates; semantic operations and their
original `[base_version, actor, op_id]` identity remain governed by the shared applier.

Reconnection and ordinary sequence-gap recovery use the matching target session's state
vector and retain its Y.Doc. Only an explicit `doc_reset` may replace that document, after
reset has been dispatched to its consumers. DQ-11(c)'s `node_incarnation` is preserved as
shared-applier data and is never inferred from the active canvas or regenerated during queue
drain.

## Consequences

### Positive

- Agent changes remain attached to the intended graph across tab switches.
- Multiple targets can follow and apply independently.
- Offscreen application does not interrupt user focus or depend on a mounted renderer.
- Per-target replay preserves the existing state-vector and reset lifecycle rules.
- Target-aware store notifications provide a clean path for visible rendering without making
  rendering the mutation authority.

### Negative

- The follower needs a registry and target lifecycle instead of one process-local document.
- Unloaded-target queues require bounds, observability, registration, and resync behavior.
- Active-canvas invalidation calls must move to a target-aware notification boundary.
- Workflow-to-graph resolution must be explicit; a direct workflow-ID-to-graph-ID cast is not
  sufficient for nested graphs, reloads, or multiple representations.

## Notes

The program audit of the fec-9 candidate branches found that `bindScope()` fixes one
active-canvas race for one target, but does not provide the multi-target registry, unloaded
queue, or active-canvas isolation required here. See
`reports/review-queue/offscreen-graphs-gap.md` in the program repository.

Required coverage includes simultaneous A/B targets, active-canvas switching during an A
apply, unloaded-target queue and drain, per-target reconnect/reset, no active-canvas side
effects, and DQ-11(c) re-add behavior.

## Glossary

- **Target graph** — the workflow/document named by an agent command's `workflow_id`, whether
  or not it is visible.
- **Target session** — one target's follower document, graph scope, queue, replay state, and
  lineage lifecycle.
- **Offscreen graph** — a target that is not the active visible canvas.
- **ECS/domain store** — the typed frontend state path that owns graph entities; LiteGraph is a
  downstream render/compatibility projection.
- **State vector** — Yjs's summary of updates known by one document replica, used to request a
  target-scoped delta.
- **`doc_reset`** — an explicit lineage-break frame that permits replacing a target follower
  document after consumers are notified.
- **`node_incarnation`** — DQ-11(c)'s stamp namespace for a node after delete/re-add with the
  same node ID.
