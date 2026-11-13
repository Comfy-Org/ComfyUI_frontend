# ADR-SUBGRAPH-INPUTS-0056: Internal editors share host widgets

Date: 2026-11-11

## Status

Proposed

## Context

A subgraph definition can have several SubgraphNode hosts, each with its own
promoted values. Editing inputs while viewing the definition needs a host
identity, and the definition UUID alone cannot supply one.

Reimplementing controls at the input boundary would duplicate numeric
constraints, combo options, text editing, extension rendering, and value
updates. Those contracts already belong to the widget rendering system.

## Decision

The input boundary renders the selected host's existing widgets. It creates no
widget entities and clones no values.

Host selection follows four rules. Entering through a SubgraphNode records that
host. Entering directly infers a host only when exactly one candidate exists.
Removing the recorded host leaves the context unresolved instead of choosing
another. Widgets rendered inside the subgraph resolve the same selected host as
their viewed host.

Each input row resolves its value source. An unconnected input edits the host's
widget. Primitive and reroute chains edit the upstream widget. Computed, muted,
bypassed, and ancestor-boundary sources are read-only. Graph context menus are
disabled at the boundary, because they act on the displayed graph and cannot
target a host or Primitive in another graph. Users locate the source to reach
its actions.

IO measurements are transient, kept per IO node, and never overwrite saved
geometry. Resizing the input node writes its saved rectangle directly instead of
issuing a LayoutOperation. This is an explicit exception to
[ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md).

## Alternatives considered

- **A separate set of boundary controls.** These would drift from the external
  host in validation, options, and callbacks.
- **One fixed-height control per socket.** Multiline and custom widgets have
  their own heights, and forcing a row height changes their behavior.
- **Editing interior defaults.** Defaults are shared by every host, so editing
  them breaks host isolation and promoted-widget ownership.
- **Registering IO nodes as layout entities.** IO node IDs repeat in every
  definition, so root-scoped layout keys would collide. This needs
  definition-scoped layout keys and IO-aware versions of every layout consumer.

## Consequences

Both renderers use the existing Vue widgets at the boundary. Workflows gain no
fields and need no migration. Editing a Primitive source affects all of its
consumers, so the row names the source and offers a locate action.

Reconnecting a disconnected input reuses its WidgetId, but the widget entity object is new, so
extensions that keep widget entities must resolve them again.

## References

- [Promoted widget ownership](SUBGRAPH-PROMOTION-0009-represent-promoted-widgets-as-linked-inputs.md)
- [Widget entities](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md)
- [Layout intent and transient measurements](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
- [Reference extension](https://github.com/nomadoor/ComfyUI-Subgraph-Input-Values)
