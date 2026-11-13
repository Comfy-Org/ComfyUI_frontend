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

The prototype renders the existing input boundary through NodeFrame.vue with
outputs and native widgets. Its title identifies the host by title and node ID.
An Exit subgraph footer runs the existing exit command to return to the parent
context. The action does nothing while the user picks nodes. Users enter a
different SubgraphNode to edit another instance.
The final empty output creates a new external input through
the existing connection handlers. Widgets display their own labels.
Explicit entry records a graph-scoped host locator. Direct entry infers a host
only when there is one candidate. Removing an explicitly selected host leaves
the context unresolved rather than selecting another host implicitly.

NodeFrame.vue owns the shared frame, NodeHeader the title and collapse control,
NodeBody the shared body spacing, NodeFooter the subgraph navigation action, and
NodeResizeHandle the resize affordance. The same footer renders enter and exit
actions; the header supports a read-only instance title. LGraphNode.vue remains
the ordinary node and composes the same parts. Input-boundary selection, port
projection and widget-source ownership live in composables, outside their views.
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

WidgetGrid has one opt-out, which turns off layout syncing. The input editor
uses it, and removes slot metadata and the context-menu handler from each
processed widget before passing it to the grid. The grid therefore renders no
socket and opens no graph action menu for those rows. The node menu resolves
selection in the displayed graph and cannot safely target a host or Primitive in
another graph. The editor suppresses the browser context menu. A focused text
field keeps its own menu. Users can locate the source to access its graph
actions.

Unconnected promoted inputs address the host's existing widget ID. Recognized
Primitive chains and reroutes resolve to the upstream widget's existing ID.
Computed, muted, and bypassed sources remain read-only. Ancestor-boundary inputs
are unavailable in this prototype; cross-boundary editing requires a separate
decision about nested invocation ownership.

Input names identify rows across reordering. Each row is keyed by host graph,
host ID, and input name, and its grid is keyed by widget ID. Removing an input
or changing its source therefore remounts the control. Nothing revalidates a
retained update when it applies, so the keys are the only guard against writing
to a stale widget. A row is inert in read-only mode, and the whole unit is inert
while the user picks nodes.

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
Unmount removes those measurements and restores the canvas presentation. The
view follows canvas coordinates without viewport clamping. Existing selection,
dragging, connection, and port-renaming handlers remain authoritative.

The IO node base gains a static socket-inset getter and no instance fields.
While a measurement exists, its bounds getter returns the projected bounds,
arrange takes the port offset from the measurement and leaves the size alone,
and draw returns early. Position, size, and serialization always read the saved
rectangle. The input node overrides arrange to keep the requested size as a
minimum.

Explicit resizing uses the shared useNodeResize interaction. Its resize callback
writes the input node's saved position and size directly, marks the canvas
dirty, and reports the measurement. The write does not go through a
LayoutOperation. Renderer measurements remain transient. Existing bounds retain
the requested size as a minimum, allowing textarea controls to grow and
preserving size across save/reload without new workflow fields. Pinned,
collapsed, read-only, and picking states block resizing. A gesture is dropped if
the definition changes while it runs.

Disconnect iterates a snapshot of the links so removing one cannot skip another.
Ctrl or Meta with Alt and a click on a port disconnects it. Same-tick rewires
and remaining fanout retain their widget. A completed disconnect followed by a
reconnect reuses the WidgetId and keeps the stored host value. The widget takes
the new target's constraints, and its entity object is new.

A visible socket can lie outside the node body, so a drop cannot rely only on
body hit testing. When Vue nodes are enabled and a drop hits no node body, the
link connector calls the canonical slot-layout lookup directly. This adds no
methods to graph entities, but the link connector and the IO node base now
import renderer modules.

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
adds no workflow fields or migration. Navigation through a different host
changes the editing target without changing the definition.

The input node can occupy more space than the previous boundary. Its widgets can
collapse, and the whole unit pans and zooms with the canvas.
Primitive edits affect all consumers of the source; the UI names that source
and provides a locate action.

## Integration guidance

Entity callback signatures are unchanged;
disconnecting a fanout now delivers every expected removal callback. Extensions
retaining widget entities across a completed disconnect must resolve them again
after reconnect, even when a WidgetId is reused. Existing workflow files need no
migration.

## References

- [Promoted widget ownership](SUBGRAPH-PROMOTION-0009-represent-promoted-widgets-as-linked-inputs.md)
- [Widget entities](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md)
- [Layout intent and transient measurements](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
- [Reference extension](https://github.com/nomadoor/ComfyUI-Subgraph-Input-Values)
