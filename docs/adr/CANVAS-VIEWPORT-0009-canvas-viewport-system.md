# ADR-CANVAS-VIEWPORT-0009: Canvas Viewport System

Date: 2026-09-28

## Status

Proposed

## Context

LGraphCanvas uses a dual-canvas architecture: a foreground canvas (the DOM element) renders nodes, and a background canvas (offscreen) renders the grid, links, and groups. `drawFrontCanvas()` composites the background onto the foreground by dividing the background canvas dimensions by `devicePixelRatio` — assuming both canvases were DPR-scaled. `drawBackCanvas()` reinforces this assumption by applying `ctx.setTransform(scale, 0, 0, scale, 0, 0)` using DPR. Both canvases must have identical physical (DPR-scaled) dimensions for compositing to produce correct results.

Two independent resize paths exist today:

- **`resizeCanvas()` in app.ts** is DPR-aware for the foreground canvas: it multiplies CSS pixels by `devicePixelRatio` to set that canvas's physical dimensions and scales its context. The background canvas is sized and transformed later by `drawBackCanvas()`.
- **`LGraphCanvas.resize()`** is DPR-unaware: it sets both canvases to CSS pixel dimensions directly, producing canvases at 1× regardless of display density.

Neither path documents that it depends on the other, creating implicit temporal coupling. Code that calls one without the other produces a background/foreground size mismatch.

The original bug: when switching from app mode (canvas hidden via `v-show`) to graph mode, `resize()` was called to force dimensions onto the newly-visible canvas. Because `resize()` is DPR-unaware, the background canvas received CSS pixel dimensions while `drawFrontCanvas()` divided those dimensions by DPR (expecting physical pixels), producing a scaled-down composite. This change introduces a canvas scheduler (`useCanvasScheduler`) to solve the hidden-canvas lifecycle problem by deferring work until the canvas is visible, together with the viewport system to remove the DPR mismatch when that work runs.

`window.devicePixelRatio` is read at 6+ call sites across LGraphCanvas (`drawFrontCanvas`, `drawBackCanvas`, `centerOnNode`, `renderInfo`, `processMouseDown` hit testing, font scaling) and 3+ call sites in app.ts/renderer code. Each reads independently with no shared source of truth, so any change to DPR handling requires auditing every call site.

## Decision

Introduce a `CanvasViewport` — a plain, frozen snapshot of the dimensions and DPR used for one canvas-sizing operation:

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

Viewport measurement normalizes every finite positive DPR to at least `1`, preserving at least one backing pixel per CSS pixel so browser zoom values below `1` do not blur the canvas. Physical dimensions use this normalized DPR rather than the raw browser value.

Two functions operate on this type:

- **`measureViewport(cssWidth, cssHeight, rawDpr, prevGeneration?)`** — a pure function that produces a new `CanvasViewport` from numeric dimensions and DPR. The optional previous generation supports deterministic generation tracking. `measureViewportFromElement(element, rawDpr?, prevGeneration?)` is the DOM adapter used by canvas lifecycle code.
- **`applyViewport(viewport, fgCanvas, bgCanvas, consumer?)`** — a side-effecting function that atomically sizes both foreground and background canvases to the viewport's physical dimensions, scales their 2D contexts, and passes the applied CSS dimensions to an optional viewport consumer such as `DragAndScale`. Both canvases are updated in a single call, eliminating the possibility of a partial resize or a later layout read to recover the CSS size.

The existing `LGraphCanvas.resize()` method and `resizeCanvas()` in app.ts both delegate their sizing work to the viewport system. Both paths follow the same sequence: measure → apply → draw.

`LGraphCanvas` caches the active DPR in its `dpr` property. The three viewport callers update that cache after applying a viewport: `resizeCanvas()` and the scheduled graph-load path in app.ts, plus `LGraphCanvas.resize()`. Most internal consumers (`drawFrontCanvas`, `drawBackCanvas`, `centerOnNode`, `renderInfo`, `processMouseDown` hit testing, and LOD threshold calculation) read the cache. Direct browser-DPR readers remain in `LGraphCanvas.setCanvas()`, `LGraphCanvas.resize()` during measurement, and `useBoundingBoxes`; viewport measurement functions also read the browser value, while `layoutStore` retains a browser fallback for legacy callers. The viewport system therefore coordinates canvas sizing but does not yet own a single DPR read or write boundary.

The new `CanvasScheduler` and viewport system have separate responsibilities: the scheduler handles **when** by deferring work until the canvas is visible, while the viewport handles **what** by applying correct DPR-scaled dimensions atomically to both canvases.

### Design Principles

Following the principles established in [ADR-ECS-0008](ECS-0008-entity-component-system.md):

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

- Applying one viewport snapshot to both canvases eliminates an entire class of sizing bugs where foreground and background canvases diverge.
- The generation counter enables stale-state detection — any consumer can verify it is reading from a consistent resize cycle.
- Phase separation (measure vs apply) makes the resize lifecycle explicit and testable.
- Pure functions (`measureViewport`) are trivially testable without DOM fixtures.
- Separates hidden-canvas scheduling from the dimensions and transforms applied when scheduled work runs.

### Negative

- Adds a new abstraction layer that all canvas-sizing code must flow through.
- `LGraphCanvas.setCanvas()`, `LGraphCanvas.resize()`, and `useBoundingBoxes` still read `window.devicePixelRatio` directly. `layoutStore` accepts a caller-supplied `dpr` and falls back to the browser value for legacy callers. A future refactor could consolidate these reads and the three viewport-driven cache writes behind one boundary.

## Notes

- References [ADR-ECS-0008](ECS-0008-entity-component-system.md) for the design principles (plain data components, pure system functions, no methods on entities).
