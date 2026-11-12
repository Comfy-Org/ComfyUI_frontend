# ADR-SUBGRAPH-INPUTS-0056: Internal editors share host widgets

Date: 2026-11-11

## Status

Proposed

## Context

A subgraph definition can have several SubgraphNode hosts with different
promoted values. Editing inputs while viewing the definition therefore requires
an explicit host identity. Navigation by definition UUID alone cannot select a
host safely.

Reimplementing controls beside the input boundary would duplicate numeric
constraints, combo behavior, text editing, extension rendering, and value
updates. Those contracts already belong to the widget rendering system.

## Decision

The prototype renders an input-values panel beside the boundary. Its instance
picker identifies the host by title and node ID and shows its containing graph.
Explicit entry records a graph-scoped host locator. Direct entry infers a host
only when there is one candidate. Removing an explicitly selected host leaves
the context unresolved rather than selecting another host implicitly.

Host candidates are NodeState records from nodeDataStore. Input connectivity
comes from linkStore. Values, widget metadata, and widget identities remain in
WidgetValueStore. The context store owns only ephemeral navigation selection.

The panel uses the same useProcessedWidgets model and WidgetGrid as the external
Vue SubgraphNode. It does not create widget entities, clone values, or implement
replacement controls. Native widget adapters can receive an ECS owner context
when their owner is outside the displayed graph. Their live compatibility
objects are resolved only at the adapter boundary.

Graph action menus are suppressed on panel controls. The existing node menu
resolves selection in the displayed graph and cannot safely target a host or
Primitive in another graph. Native text-field menus remain owned by their
controls. Users can locate the source to access its graph actions.

Unconnected promoted inputs address the host's existing widget ID. Recognized
Primitive chains and reroutes resolve to the upstream widget's existing ID.
Computed, muted, and bypassed sources remain read-only. Ancestor-boundary inputs
are unavailable in this prototype; cross-boundary editing requires a separate
decision about nested invocation ownership.

Input names identify rows across reordering. A commit revalidates the resolved
node and widget ID against its rendered target. Removed inputs and changed
sources cannot redirect a retained update handler to another widget.

Edits use the shared model's update handler, then request a canvas redraw and a
workflow history snapshot. WidgetValueStore emits the existing value intents.
The feature does not add graph-version writes or graph mutation callbacks.

The panel's size and position are transient presentation data. It follows the
existing boundary and camera without changing the boundary's saved geometry.
The actual sockets keep their existing layout and interaction behavior.

## Alternatives considered

### One control aligned to each socket

Real widgets have different heights, including multiline and custom widgets.
Forcing fixed-height rows would alter their behavior or require boundary layout
changes. The adjacent panel preserves complete controls and existing socket
geometry for the prototype.

### A separate implementation of boundary widgets

Duplicated controls could drift from the external host in validation, options,
and callbacks. Sharing the rendering model and components avoids that split.

### Editing interior defaults

Interior defaults are shared by the definition. Using them as the editing target
would lose host isolation and contradict promoted-widget ownership.

## Consequences

Both renderer modes use the existing Vue controls in the panel. The prototype
adds no workflow fields or migration. Switching the instance changes the editing
target without changing the definition.

The panel can occupy more space than socket-aligned rows. It can collapse and
scroll, and its transient bounds keep it accessible when the canvas is zoomed.
Primitive edits affect all consumers of the source; the UI names that source
and provides a locate action.

## References

- [Promoted widget ownership](SUBGRAPH-PROMOTION-0009-represent-promoted-widgets-as-linked-inputs.md)
- [Widget entities](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md)
- [Layout intent and transient measurements](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
- [Reference extension](https://github.com/nomadoor/ComfyUI-Subgraph-Input-Values)
