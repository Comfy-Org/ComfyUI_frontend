# ADR-CANVAS-0052: Shared position presentation boundary

Date: 2026-11-03

## Status

Accepted

## Context

Sharing geometry does not synchronize DOM nodes with canvas-rendered links
and groups. Independent animation callbacks can draw canvas pixels from an
earlier position, then publish a newer DOM position before the browser paints.
A canvas-only FPS limit makes that difference persist across refreshes.

## Decision

Use the canvas frame as the presentation boundary for both renderers.
Calculate pending drag and auto-pan updates, flush layout notifications, draw
canvas, then publish node positions and the camera to Vue. Vue applies those
updates in its microtask flush before browser paint. Durable geometry remains
in layout operations; the displayed position is a local presentation snapshot.

Flush notifications before drawing so a deferred invalidation cannot request
another draw of geometry that the current frame already displayed. Pending
input keeps the latest accepted drag coordinates. Release applies pending
movement before snapping; cancellation discards it.

Keep the existing canvas loop and FPS setting. A separate application-owned
loop would introduce competing lifecycle ownership for extension-created
canvases. Frame participants attach to their canvas and detach with their
interaction or component lifetime.

## Alternatives and consequences

Reordering independent animation callbacks is insufficient: registration order
can change, and capped canvas drawing runs at a different cadence. Drawing
canvas again from each drag callback fixes one interaction by adding work and
leaves group dragging and camera movement unsynchronized.

DOM position updates now obey the canvas cadence, including low FPS limits.
Auto-pan uses elapsed time, bounded after stalls, so ordinary frame limiting
does not proportionally slow panning. This establishes alignment, not a
frame-rate guarantee; drawing cost and frame-time tails need separate evidence.
