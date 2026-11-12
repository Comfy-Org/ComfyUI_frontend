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

The prototype renders the existing input boundary through LGraphNode.vue with
outputs and native widgets. Its title is an instance picker identifying the host
by title and node ID. The final empty output creates a new external input through
the existing connection handlers. Widgets display their own labels.
Explicit entry records a graph-scoped host locator. Direct entry infers a host
only when there is one candidate. Removing an explicitly selected host leaves
the context unresolved rather than selecting another host implicitly.

LGraphNode.vue owns the shared frame, NodeBody the shared body spacing, and
NodeResizeHandle the resize affordance. GraphNode.vue owns the ordinary node's
rendering integration. State and behavior belong to shared composables:
useGraphNodePresentation coordinates existing entity stores, useGraphNodeActions
owns commands, useGraphNodeWidgets resolves native widget/media presentation, and
useNodeShape derives shape tokens. Header and body components only render their
typed inputs and emit user events. Input-boundary selection, port projection and
widget-source ownership likewise live in composables, outside their views.
Virtual IO IDs are reused across definitions, so registering
them as ordinary node entities would collide. Sharing presentation preserves
their existing identity and connection lifecycle without fake entity records.

Host candidates are NodeState records from nodeDataStore. Input connectivity
comes from linkStore. Values, widget metadata, and widget identities remain in
WidgetValueStore. The context store owns only ephemeral navigation selection.

The input node uses the same useProcessedWidgets model and WidgetGrid as the external
Vue SubgraphNode. It does not create widget entities, clone values, or replace
widget callbacks. Processed widgets carry an explicit hostNodeLocatorId alongside
the interior source's nodeLocatorId. The existing useWidgetHostNode resolver
handles both roles at the adapter boundary and follows owner changes and graph
configuration. There is no separate injected owner mechanism.

WidgetGrid provides node and form presentations. Form presentation omits sockets,
layout measurements, input-selection actions, and graph action menus. The node menu
resolves selection in the displayed graph and cannot safely target a host or
Primitive in another graph. Native text-field menus remain owned by their
controls. Users can locate the source to access its graph actions. The shared
editor and the panel respect node-picking and read-only interaction modes.

Unconnected promoted inputs address the host's existing widget ID. Recognized
Primitive chains and reroutes resolve to the upstream widget's existing ID.
Computed, muted, and bypassed sources remain read-only. Ancestor-boundary inputs
are unavailable in this prototype; cross-boundary editing requires a separate
decision about nested invocation ownership.

Input names identify rows across reordering. The shared model revalidates the
current node, widget ID, workflow, connectivity, and editing mode before applying a retained
update. The shared value binding also checks widget lifetime and disabled state,
including value-control updates. Removed inputs and changed sources cannot
redirect an update to another widget.

WidgetValueStore supplies the existing state, render metadata, and visibility
together, so the renderer does not invent defaults for metadata belonging to a
registered widget. Shared value bindings own value updates, legacy callbacks,
and error clearing. WidgetValueStore emits the existing value intents.

Text edits are checkpointed when focus leaves the shared editor. Pointer edits
use the existing interaction history path. Individual keystrokes and scrub steps
do not request full workflow snapshots. Native browser undo is suppressed
synchronously in the existing global history listener; text editors retain their
own undo even when auto-queue-on-change is enabled. The feature adds no separate
history shortcut policy, graph-version writes, or graph mutation callbacks.

Shared-source attribution accumulates fanout along the source-resolution path.
A branch at an intervening reroute or Primitive is therefore reported without a
second traversal or a separate sharing heuristic.

Renderer measurements live in subgraphIoLayoutStore, scoped by definition and IO
node IDs. The existing IO arrangement uses the measured width, height, and port
offset to align connection anchors and hit targets with the rendered unit.
Projected bounds preserve the original port anchor and never overwrite saved
geometry. Registration occurs before the first canvas frame. The port view
invalidates on existing interface-edit events, including reordering, without
creating another source of port declarations.
Unmount removes those measurements and restores the canvas presentation. No
instance fields or methods are added. The view follows canvas coordinates without
viewport clamping. Existing selection, dragging, connection, and port-renaming
handlers remain authoritative.

Explicit resizing uses the shared useNodeResize interaction and serializable
BatchUpdateBoundsOperation. A focused IO adapter applies it through the existing
configuration boundary to saved bounding geometry. Renderer measurements remain
transient. Existing bounds retain the requested size as a minimum, allowing
textarea controls to grow and preserving size across save/reload without new
workflow fields. Pinned, read-only, and picking modes block resizing. Changing
the definition during a gesture invalidates its target.

Disconnect iterates a snapshot of the links so removing one cannot skip another.
Final widget demotion excludes the departing input from its own orphan check.
Same-tick rewires and remaining fanout retain their widget; a completed disconnect
followed by reconnect resolves a fresh widget and target defaults.

The renderer supplies the existing measured-slot lookup to link drops through a
lifetime-scoped adapter. A visible socket can lie outside the node body, so a
drop cannot rely only on body hit testing. This reuses the canonical slot lookup
without adding methods or renderer dependencies to graph entities.

## Alternatives considered

### One control aligned to each socket

Real widgets have different heights, including multiline and custom widgets.
Forcing fixed-height rows would alter their behavior. Outputs appear together
above the complete widget controls, following the existing node layout.

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

The input node can occupy more space than the previous boundary. Its widgets can
collapse, and the whole unit pans and zooms with the canvas.
Primitive edits affect all consumers of the source; the UI names that source
and provides a locate action.

## Integration guidance

Internal Vue callers that supply NodeState now use GraphNode.vue. LGraphNode.vue
is the shared presentation frame. Entity callback signatures are unchanged;
disconnecting a fanout now delivers every expected removal callback. Extensions
retaining widget entities across a completed disconnect must resolve them again
after reconnect, even when a WidgetId is reused. Existing workflow files need no
migration.

## References

- [Promoted widget ownership](SUBGRAPH-PROMOTION-0009-represent-promoted-widgets-as-linked-inputs.md)
- [Widget entities](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md)
- [Layout intent and transient measurements](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
- [Reference extension](https://github.com/nomadoor/ComfyUI-Subgraph-Input-Values)
