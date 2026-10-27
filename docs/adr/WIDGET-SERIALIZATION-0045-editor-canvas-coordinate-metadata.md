# ADR-WIDGET-SERIALIZATION-0045: Preserve the Bounding Box Editor Coordinate Space

Date: 2026-10-17

## Status

Proposed

## Context

`CreateBoundingBoxes` stores editor boxes in canvas pixels. Its width and height
widgets describe that canvas, while linked prompt inputs can resolve to different
execution dimensions. Sending only pixel coordinates loses the original basis.
The backend cannot reconstruct that basis from the linked dimensions.

Workflow persistence reads widget values directly. API prompt generation invokes
`serializeValue` through `ExecutableNodeDTO` before replacing linked inputs.
This provides a narrow boundary that does not require migrating saved workflows
or retaining extra state in the normalized editor model.

Related: [ComfyUI #17097](https://github.com/Comfy-Org/ComfyUI/issues/17097).

## Decision

Only the `CreateBoundingBoxes` widget named `editor_state` adds optional per-box
`metadata._canvas_size` to its API value. It contains `width` and `height` as
positive, finite, integer-valued numbers read from the actual canvas widgets.
Missing or invalid dimensions preserve the legacy pixel payload. No default
canvas size is inferred.

The serializer waits for pending Vue updates, then deep-copies pixels and
metadata before adding the coordinate basis. It never changes `widget.value`,
workflow persistence, `last_incoming`, or other bounding-box widgets.

The paired backend change reads this metadata only when editor state supplies
the selected boxes. It normalizes against the editor basis and emits coordinates
at execution dimensions. Missing or invalid metadata retains legacy behavior.
Incoming boxes and their equality snapshot retain their existing pixel semantics.

## Consequences

- Existing workflows acquire the metadata when queued, without opening or
  redrawing the editor. Their saved representation remains unchanged.
- Both frontend and backend changes are needed to fix linked-dimension scaling.
  An older backend ignores the extra metadata; an older frontend sends no basis.
  Those mixed versions retain the previous scaling behavior.
- Background dimensions and deferred incoming boxes continue through the existing
  editor synchronization. The serializer captures their settled API state.
- `graphToPrompt` takes its workflow snapshot before API serialization. A resize
  followed by queueing within the same synchronous call can retain the existing
  pre-flush workflow snapshot. This change does not alter that lifecycle.

## Alternatives Considered

- Wrap the list in a canvas-and-boxes envelope. Older backends require a list and
  would discard that shape.
- Annotate every bounding-box widget. Altering `last_incoming` would change the
  comparison that decides whether upstream boxes replace editor state.
- Guess the canvas from execution dimensions or a default. Neither identifies
  the original coordinate basis.
- Persist coordinate hints in editor state. That adds migration and state
  synchronization requirements where an API-only copy suffices.
