# 9. Canvas Viewport System

Date: 2026-04-20

## Status

Proposed

## Context

LGraphCanvas uses a dual-canvas architecture: a foreground canvas (the DOM element) renders nodes, and a background canvas (offscreen) renders the grid, links, and groups. `drawFrontCanvas()` composites the background onto the foreground by dividing the background canvas dimensions by `devicePixelRatio` — assuming both canvases were DPR-scaled. `drawBackCanvas()` reinforces this assumption by applying `ctx.setTransform(scale, 0, 0, scale, 0, 0)` using DPR. Both canvases must have identical physical (DPR-scaled) dimensions for compositing to produce correct results.

Two independent resize paths exist today:

- **`resizeCanvas()` in app.ts** is DPR-aware: it multiplies CSS pixels by `devicePixelRatio` to set physical canvas dimensions and calls `ctx.scale()` on both contexts.
- **`LGraphCanvas.resize()`** is DPR-unaware: it sets both canvases to CSS pixel dimensions directly, producing canvases at 1× regardless of display density.

Neither path documents that it depends on the other, creating implicit temporal coupling. Code that calls one without the other produces a background/foreground size mismatch.

The original bug: when switching from app mode (canvas hidden via `v-show`) to graph mode, `resize()` was called to force dimensions onto the newly-visible canvas. Because `resize()` is DPR-unaware, the background canvas received CSS pixel dimensions while `drawFrontCanvas()` divided those dimensions by DPR (expecting physical pixels), producing a scaled-down composite. The canvas scheduler (`useCanvasScheduler`) solved the "hidden canvas" lifecycle problem (deferring draws until the canvas is visible) but left the DPR mismatch because it calls the DPR-unaware `LGraphCanvas.resize()`.

`window.devicePixelRatio` is read at 6+ call sites across LGraphCanvas (`drawFrontCanvas`, `drawBackCanvas`, `centerOnNode`, `renderInfo`, `processMouseDown` hit testing, font scaling) and 3+ call sites in app.ts/renderer code. Each reads independently with no shared source of truth, so any change to DPR handling requires auditing every call site.

## Decision

Introduce a `CanvasViewport` — a plain, frozen data object that serves as the single source of truth for canvas sizing:

```ts
interface CanvasViewport {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly dpr: number
  readonly physicalWidth: number // cssWidth * dpr
  readonly physicalHeight: number // cssHeight * dpr
  readonly generation: number // monotonically increasing
}
```

Two functions operate on this type:

- **`measureViewport(container, dpr?)`** — a pure function that produces a new `CanvasViewport` from DOM measurements. Accepts an optional DPR override for testing and for scenarios where DPR changes mid-session (display switching).
- **`applyViewport(viewport, fgCanvas, bgCanvas)`** — a side-effecting function that atomically sizes both foreground and background canvases to the viewport's physical dimensions and scales their 2D contexts. Both canvases are updated in a single call, eliminating the possibility of a partial resize.

A `devAssert(condition, message)` utility throws in DEV mode and `console.error`s in production. It is used at draw boundaries to enforce invariants:

- Foreground and background canvas dimensions are equal.
- The viewport generation is fresh (not stale from a previous resize cycle).

The existing `LGraphCanvas.resize()` method and `resizeCanvas()` in app.ts are both replaced by calls through the viewport system. Both paths collapse into one: measure → apply → draw.

The viewport system composes with the existing `CanvasScheduler` — the scheduler handles **when** (deferring until the canvas is visible), the viewport handles **what** (correct DPR-scaled dimensions applied atomically to both canvases). Neither modifies the other.

### Design Principles

Following the ECS principles established in [ADR 0008](0008-entity-component-system.md):

- `CanvasViewport` is a **plain data component** — no methods, no back-references, frozen after creation.
- `measureViewport` is a **pure system function** — testable without DOM (accepts dimension inputs).
- `applyViewport` is a **side-effecting system** — testable with mock canvas objects.
- No methods are added to `LGraphCanvas` or any other entity class.

### Alternatives Considered

1. **Reactive derivation (Vue `computed`)** — rejected because it would require Vue reactivity inside litegraph internals, crossing a hard architectural boundary between the Vue application layer and the litegraph rendering layer.
2. **Transaction/batch-commit pattern** — rejected as overkill for a single async boundary (the `requestAnimationFrame` call). The measure/apply split achieves the same atomicity guarantee with less machinery.
3. **Just fixing `resizeCanvas()` to also update bgcanvas** — rejected because it doesn't address the scattered DPR reads or prevent future divergence. A point fix solves today's bug but leaves the same class of bug latent at every other DPR read site.

## Consequences

### Positive

- Single source of truth for canvas dimensions and DPR eliminates an entire class of sizing bugs where foreground and background canvases diverge.
- The generation counter enables stale-state detection — any consumer can verify it is reading from a consistent resize cycle.
- Phase separation (measure vs apply) makes the resize lifecycle explicit and assertable.
- Pure functions (`measureViewport`) are trivially testable without DOM fixtures.
- Composes cleanly with the existing `CanvasScheduler` without modifying it.

### Negative

- All existing `window.devicePixelRatio` reads in LGraphCanvas need migration to use the viewport's `dpr` field. This migration is incremental and not blocking.
- Adds a new abstraction layer that all canvas-sizing code must flow through.
- A lint rule banning direct `window.devicePixelRatio` reads in canvas code requires team awareness during the migration period.

## Notes

- References [ADR 0008](0008-entity-component-system.md) for the design principles (plain data components, pure system functions, no methods on entities).
- The `devAssert` utility is general-purpose and can be used beyond canvas sizing for any invariant that should be loud in development but non-fatal in production.
- Migration of existing DPR reads in LGraphCanvas (`centerOnNode`, `renderInfo`, `processMouseDown` hit testing, `drawBackCanvas` `setTransform`, font scaling) can be done incrementally in follow-up PRs. This ADR covers the foundation and the critical resize path.
