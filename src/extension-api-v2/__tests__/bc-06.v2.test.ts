// Category: BC.06 — Custom canvas drawing (per-node and canvas-level)
// DB cross-ref: S2.N9, S3.C1, S3.C2
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1256
// compat-floor: blast_radius 5.25 ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: NodeHandle.onDraw(callback) for per-node drawing (S2.N9).
//                 Canvas-level overrides (S3.C1, S3.C2) are OUT OF v2 SCOPE — deferred to D9 Phase C.
//                 S3.C* stubs present for blast-radius tracking and strangler-fig planning.

import { describe, it } from 'vitest'

describe('BC.06 v2 contract — custom canvas drawing (per-node and canvas-level)', () => {
  describe('NodeHandle.onDraw(callback) — per-node foreground drawing (S2.N9)', () => {
    it.todo(
      'NodeHandle.onDraw(cb) registers cb to be called once per render frame while the node is visible'
    )
    it.todo(
      'callback receives a DrawContext with ctx (CanvasRenderingContext2D) and area (bounding rect) arguments'
    )
    it.todo(
      'drawing operations in the callback appear in the same layer as v1 onDrawForeground (above node body)'
    )
    it.todo(
      'the canvas transform is pre-applied when the callback fires — coordinates are in graph space, matching v1 behavior'
    )
    it.todo(
      'callback registered via NodeHandle.onDraw() is automatically deregistered when the node is removed'
    )
  })

  describe('canvas-level overrides — deferred (S3.C1, S3.C2)', () => {
    // COM-3668: Simon Tranter vetoed canvas-draw testing — no headless canvas renderer available.
    // Canvas-level prototype override testing deferred post-D9 Phase C.
    it.skip(
      '[D9 Phase C] v2 exposes no stable API for replacing LGraphCanvas.prototype.drawNodeShape — extensions using this pattern must remain on v1 shim'
    )
    it.skip(
      '[D9 Phase C] v2 exposes no stable API for replacing processContextMenu — context-menu customization is deferred to the ComfyUI menu extension point'
    )
    it.skip(
      '[D9 Phase C] blast-radius tracking: S3.C1 and S3.C2 overrides coexist with v2 per-node drawing without mutual interference'
    )
  })
})
