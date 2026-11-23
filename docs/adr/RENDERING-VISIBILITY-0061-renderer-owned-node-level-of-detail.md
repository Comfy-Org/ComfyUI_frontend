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

Below LiteGraph's minimum-font-size threshold, Nodes 2.0 unmounts ordinary Vue
node components and a renderer-owned canvas draws node boxes, title bars,
slots, and widget rectangles from canonical graph geometry. The switch uses
hysteresis so a zoom gesture that dwells near the threshold does not mount and
unmount the whole graph repeatedly. Setting the threshold to 0 disables LOD.

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

### Retain unmounted nodes with `KeepAlive`

Deferred. Keeping component instances alive preserves component-local state
across the switch but retains memory for every node and couples LOD to viewport
retention. This decision stands alone; retention can layer on it later.

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

- Crossing the threshold remounts node components, so component-local state
  not held in a store is lost unless the node was pinned.
- The box canvas duplicates a small, intentionally simplified subset of
  LiteGraph node drawing.
- New lifecycle-sensitive content must join the pin scan if unmounting it
  would be unsafe.
