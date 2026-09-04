# 24. Nodes 2.0 Viewport Retention and Level of Detail

Date: 2026-08-17

## Status

Proposed

## Context

Nodes 2.0 renders node bodies as Vue DOM. Large workflows therefore incur
layout and paint work for nodes far outside the viewport. At low zoom,
LiteGraph already switches canvas nodes to a simplified representation, but
Nodes 2.0 continued rendering full-detail DOM.

Renderer visibility must not become graph state. Detaching a node must not
change its position, size, links, serialized data, or component-local state.
Focused controls, live media, iframe contents, and link drags must also survive
viewport and level-of-detail transitions.

## Decision

At readable zoom, workflows with at least 150 nodes attach only nodes that
intersect an expanded viewport. The renderer scans canonical bounds from
`layoutStore` at a throttled cadence and keeps nodes with missing or invalid
bounds attached. A 90% exit threshold prevents mode churn near 150 nodes.

Each node is wrapped in Vue `KeepAlive`. Leaving the active set removes its DOM
tree from layout and paint while retaining the component instance. Focused,
live-media, iframe, and active link-drag source nodes remain attached when they
leave the viewport.

Below LiteGraph's existing minimum-font-size threshold, a renderer-owned canvas
draws node boxes, title bars, slots, and widget rectangles. Pinned nodes remain
real Vue components above the box layer. LiteGraph temporarily resumes node hit
testing because ordinary Vue node elements are detached in this mode.

The implementation follows the existing module direction:

- graph and layout stores provide node membership and canonical geometry;
- renderer composables derive viewport membership, lifecycle pins, and LOD
  state without writing that state back to entities;
- renderer presentation code converts graph nodes to cached plain box models
  and paints those models on the overlay canvas.

Graph and layout stores remain authoritative for workflow membership and
geometry. Renderer attachment state is neither serialized nor written back to
entities.

## Alternatives considered

### Keep every Vue node attached

Rejected for large workflows because offscreen DOM remains part of browser
style, layout, and paint work.

### Destroy offscreen components

Rejected as the default because it loses component-local state and creates
extension lifecycle risk without a demonstrated interaction-performance win
over `KeepAlive`.

### Add another spatial index and mount scheduler

Rejected for this implementation. A throttled linear scan is small at the
current activation threshold and avoids a second geometry index, invalidation
contract, admission queue, and timing state machine. The low-quality box layer
scans current graph membership and caches its plain drawing models between
content and geometry changes.

## Consequences

### Positive

- Offscreen node DOM no longer participates in browser rendering work.
- Component instances and lifecycle-sensitive state survive detachment.
- Nodes 2.0 follows the existing LiteGraph low-quality threshold and setting.
- Visibility policy, safety pins, and LOD rendering are independently testable.
- The graph model remains independent of renderer attachment.

### Negative

- `KeepAlive` retains component memory for detached nodes.
- Viewport membership can lag camera movement by up to the 100 ms throttle.
- New lifecycle-sensitive content must join the pin collector if detaching it
  would be unsafe.
- The low-quality canvas duplicates a small, intentionally simplified subset
  of LiteGraph node drawing.

## Evidence

On the 245-node workflow used for the original performance investigation,
removing offscreen DOM improved scripted interactions across Chromium, Firefox,
and WebKit. `KeepAlive` and destructive unmounting were in the same performance
tier, indicating that active DOM size was the primary gain. A three-run smoke
comparison of the simplified implementation measured 8.3 ms/frame versus 8.6
ms/frame on `main`, with 0 ms total blocking time for both.

Behavioral coverage verifies component identity across viewport and LOD
transitions, focused-node retention, link-drag retention, stable graph sizes,
ECS slot-offset refresh, and legacy-widget redraw.
