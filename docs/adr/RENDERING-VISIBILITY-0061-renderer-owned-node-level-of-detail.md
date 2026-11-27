# ADR-RENDERING-VISIBILITY-0061: Nodes 2.0 level of detail

Date: 2026-11-23

## Status

Proposed

## Context

Nodes 2.0 renders node bodies as Vue DOM. When zoomed out past the point where
node text is legible, every node still participates in style, layout, and
paint, although the user can no longer read or operate any of it. LiteGraph
already switches canvas nodes to a simplified representation below the
`LiteGraph.Canvas.MinFontSizeForLOD` threshold; Nodes 2.0 did not.

Renderer detail must not become graph state. Switching detail levels must not
change a node's position, size, links, or serialized data. Focused controls,
live media, iframe contents, and link drags must survive the switch.

## Decision

Below LiteGraph's minimum-font-size threshold, Nodes 2.0 deactivates ordinary
Vue node components inside a per-node `KeepAlive` and a renderer-owned canvas
draws node boxes, title bars,
slots, and widget rectangles from canonical graph geometry. The switch uses
hysteresis so a zoom gesture that dwells near the threshold does not mount and
unmount the whole graph repeatedly. Setting the threshold to 0 disables LOD.

Leaving LOD reattaches the cached component and its DOM instead of mounting a
new one. A node that has never been mounted, such as one in a graph loaded
below the threshold, mounts on leaving LOD only if it is in view; otherwise it
mounts when it first scrolls into view. Nodes added while above the threshold
mount immediately. A deactivated node stops observing its size, so a detached element
cannot report a zero size into the layout store.

Nodes that hold live DOM state when LOD begins stay mounted above the box
layer: the focused node, nodes with an iframe or playing media, and the source
nodes of an active link drag. Coachmark targets register a per-node opt-out
and also stay mounted.

While boxes are showing, LiteGraph resumes node hit testing for select, drag,
resize, and title double-click. Slot, widget, title-button, badge, and
`onMouseDown` hits stay disabled because the boxes draw no target for them.

The box overlay idles unless camera, layout, geometry, theme, DPR, element
size, or node content changes, and it caches plain box models between those
changes.

## Alternatives considered

### Unmount nodes below the threshold

Rejected after measurement. Without `KeepAlive`, every zoom across the
threshold mounted or unmounted the whole graph, so a 1000-node zoom gesture
near the threshold blocked the main thread for 35 to 39 seconds against about
one second on `main`, and later interactions ran with nearly twice the heap.

### Restore nodes over several frames

Rejected after measurement. Mounting visible nodes first and the rest in
batches spread the same cost over seconds of janky frames: each canvas redraw
reads layout for every mounted node, so small batches pay a forced layout
hundreds of times, and large batches block like a single mount.

### Mount every node on the first zoom past the threshold

Rejected after measurement. With `KeepAlive` alone, the first zoom-in on a
graph loaded below the threshold mounted all of its nodes at once, so a
1000-node zoom gesture blocked for about 15 seconds against about one second
on `main`.

### Keep every Vue node mounted and hide it with CSS

Rejected because hidden DOM still costs style recalculation and memory, and
`content-visibility` does not remove the per-node reactive work.

### Draw boxes with the LiteGraph canvas renderer

Rejected because Nodes 2.0 does not depend on the LiteGraph node drawing path,
and the boxes need the Vue renderer's theme tokens.

## Consequences

### Positive

- Zoomed-out graphs no longer carry full node DOM.
- Nodes 2.0 follows the existing LiteGraph low-quality threshold and setting.
- Threshold policy, box models, and drawing are independently testable.
- The graph model stays independent of renderer detail.

### Negative

- In a graph loaded below the threshold, offscreen nodes have no DOM until
  they first scroll into view, so code that queries node elements finds only
  nodes that have been on screen.
- Deactivated components stay in memory, so heap grows towards `main` as more
  of the graph is viewed in detail.
- The box canvas duplicates a small, intentionally simplified subset of
  LiteGraph node drawing.
- New lifecycle-sensitive content must join the pin scan if unmounting it
  would be unsafe.
