// Category: BC.06 — Custom canvas drawing (per-node and canvas-level)
// DB cross-ref: S2.N9, S3.C1, S3.C2
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1256
// compat-floor: blast_radius 5.25 ≥ 2.0 — MUST pass before v2 ships
// Migration: v1 node.onDrawForeground → v2 NodeHandle.onDraw (partial).
//            S3.C1 / S3.C2 canvas-level overrides: no v2 migration path yet (D9 Phase C).

import { describe, it } from 'vitest'

describe('BC.06 migration — custom canvas drawing (per-node and canvas-level)', () => {
  describe('per-node drawing migration (S2.N9)', () => {
    it.todo(
      'v1 node.onDrawForeground and v2 NodeHandle.onDraw both produce visually equivalent output on the canvas for the same drawing operations'
    )
    it.todo(
      'draw callback in v2 fires the same number of times per second as v1 onDrawForeground for a static scene'
    )
    it.todo(
      'v2 DrawContext.ctx is the same CanvasRenderingContext2D state as v1 receives (same transform, same clip)'
    )
  })

  describe('auto-deregistration vs manual cleanup', () => {
    it.todo(
      'v1 onDrawForeground continues to fire after node removal if the reference is not cleared (leak); v2 onDraw is auto-removed'
    )
    it.todo(
      'v2 auto-deregistration on node removal does not affect onDraw callbacks registered for other nodes'
    )
  })

  describe('canvas-level override coexistence (S3.C1, S3.C2)', () => {
    // COM-3668: Simon Tranter vetoed canvas-draw testing — no headless canvas renderer available.
    // Canvas-level prototype override testing deferred post-D9 Phase C.
    it.skip(
      'extensions that replace LGraphCanvas.prototype methods in v1 continue to function alongside v2 NodeHandle.onDraw registrations without conflict'
    )
    it.skip(
      'processContextMenu replacement in v1 is not disrupted by extensions migrated to v2 per-node APIs'
    )
  })
})
