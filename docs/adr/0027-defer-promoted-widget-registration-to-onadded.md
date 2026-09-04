# 27. Defer Promoted-Widget Registration to `onAdded()`

Date: 2026-09-01

## Status

Accepted

## Context

`SubgraphNode._setWidget` registers each promoted input's widget state in
`useWidgetValueStore`, keyed by `widgetId(rootGraph.id, this.id, name)`. Before
a node is added to a graph, `this.id` is `UNASSIGNED_NODE_ID` (`-1`) — a value
every not-yet-added `SubgraphNode` shares, including clipboard clones that are
built, resolved, and then discarded without ever being added.

Registering during construction therefore keyed widget state under that shared
`-1` id. A clone built and discarded (e.g. Ctrl+C then Escape) could leave its
value registered under `graphId:-1:name`. A later, unrelated `SubgraphNode`
with a same-named promoted input — created anywhere in the session — would
then inherit the discarded clone's value the first time its bindings rebuilt,
because the registry still held state at that shared key (#16250).

## Decision

`_setWidget` no longer registers while `this.id === UNASSIGNED_NODE_ID`; it
clears `input.widgetId` and returns. `onAdded()` performs the deferred
registration once the node has its real, unique id, re-resolving any input
whose `widgetId` was left unset during construction.

## Consequences

- No promoted widget state is ever written under the shared `UNASSIGNED_NODE_ID`
  key, so a discarded clone can no longer leak its value into a later,
  unrelated instance.
- Extensions or app code that read a promoted input's `widgetId` or store-backed
  value immediately after construction (before the node is added to a graph)
  will see it unset until `onAdded()` runs. Registration was never
  synchronous with construction in the shared-key case anyway — the value was
  wrong or overwritten, not merely late.
- `onAdded()` was already responsible for id-migration when a node's minted id
  differs from a previously-assigned one; it now also owns first-time
  registration, keeping all promoted-widget store writes in one lifecycle
  point after `this.id` is real.

## References

- #16250 — Promoted widget values leak across unrelated SubgraphNode instances
  (shared `nodeId=-1` registration key).
