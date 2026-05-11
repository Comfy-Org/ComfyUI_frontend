// Category: BC.06 — Custom canvas drawing (per-node and canvas-level)
// DB cross-ref: S2.N9, S3.C1, S3.C2
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1256
// Surface: S2.N9 = node.onDrawForeground, S3.C1 = LGraphCanvas.prototype overrides, S3.C2 = ContextMenu replacement
// compat-floor: blast_radius 5.25 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.onDrawForeground(ctx, area), LGraphCanvas.prototype.processContextMenu = ...,
//              LGraphCanvas.prototype.drawNodeShape = ... etc.
// v1_scope_note: Simon Tranter (COM-3668) vetoed canvas drawing overrides as "too hacky/specific".
//                S3.C* patterns tracked for blast-radius / strangler-fig planning only.

import { describe, expect, it } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.06 v1 contract — custom canvas drawing (per-node and canvas-level)', () => {
  describe('S2.N9 — node.onDrawForeground (synthetic)', () => {
    it('onDrawForeground callback is invoked with (ctx, visibleArea)', () => {
      const mockCtx = { fillRect: () => {}, strokeRect: () => {} }
      const mockArea = [0, 0, 800, 600]
      const received: unknown[][] = []

      const node = {
        onDrawForeground(ctx: unknown, visibleArea: unknown) {
          received.push([ctx, visibleArea])
        }
      }

      node.onDrawForeground(mockCtx, mockArea)

      expect(received).toHaveLength(1)
      expect(received[0][0]).toBe(mockCtx)
      expect(received[0][1]).toBe(mockArea)
    })

    it('ctx argument is the same object passed in (identity check)', () => {
      const mockCtx = { fillRect: () => {} }
      let capturedCtx: unknown

      const node = {
        onDrawForeground(ctx: unknown, _area: unknown) {
          capturedCtx = ctx
        }
      }

      node.onDrawForeground(mockCtx, [])

      expect(capturedCtx).toBe(mockCtx)
    })

    it.todo(
      'ctx passed to onDrawForeground is the same CanvasRenderingContext2D used by LiteGraph for the node layer'
    )
    it.todo(
      'onDrawForeground is NOT called for nodes outside the visible area (culled by LiteGraph)'
    )
    it.todo(
      'canvas transform (scale, translate) is already applied when onDrawForeground fires — coordinates are in graph space'
    )
  })

  describe('S3.C1 — LGraphCanvas.prototype method overrides (synthetic)', () => {
    it('overriding a prototype method changes behavior for all instances', () => {
      interface MockCanvas { drawNodeShape(ctx: object, node: object): string }
      const LGraphCanvasProto: MockCanvas = { drawNodeShape: () => 'default' }

      LGraphCanvasProto.drawNodeShape = (_ctx, _node) => 'custom'

      const instance = Object.create(LGraphCanvasProto) as MockCanvas
      expect(instance.drawNodeShape({}, {})).toBe('custom')
    })

    it('last-writer-wins — two overrides, second wins', () => {
      interface MockCanvas { drawNodeShape(ctx: object, node: object): string }
      const LGraphCanvasProto: MockCanvas = { drawNodeShape: () => 'default' }

      LGraphCanvasProto.drawNodeShape = () => 'first'
      LGraphCanvasProto.drawNodeShape = () => 'second'

      const instance = Object.create(LGraphCanvasProto) as MockCanvas
      expect(instance.drawNodeShape({}, {})).toBe('second')
    })

    it.todo(
      'actual canvas rendering with CanvasRenderingContext2D'
    )
    it.todo(
      'real LiteGraph canvas instance shares the same prototype'
    )
  })

  describe('S3.C2 — ContextMenu global replacement (synthetic)', () => {
    it('replacing processContextMenu replaces the handler', () => {
      interface MockCanvas { processContextMenu(event: object): string }
      const LGraphCanvasProto: MockCanvas = { processContextMenu: () => 'default-menu' }

      LGraphCanvasProto.processContextMenu = (_event) => 'custom-menu'

      const instance = Object.create(LGraphCanvasProto) as MockCanvas
      expect(instance.processContextMenu({})).toBe('custom-menu')
    })

    it('calling original inside wrapper preserves default entries (chain-call test)', () => {
      const entries: string[] = []

      interface MockCanvas { processContextMenu(event: object): void }
      const LGraphCanvasProto: MockCanvas = {
        processContextMenu(_event: object) {
          entries.push('default')
        }
      }

      const original = LGraphCanvasProto.processContextMenu.bind(LGraphCanvasProto)
      LGraphCanvasProto.processContextMenu = function (event) {
        entries.push('custom')
        original(event)
      }

      const instance = Object.create(LGraphCanvasProto) as MockCanvas
      instance.processContextMenu({})

      expect(entries).toEqual(['custom', 'default'])
    })

    it.todo(
      'actual canvas rendering'
    )
    it.todo(
      'real LiteGraph canvas'
    )
  })

  describe('S2.N9 — evidence excerpts', () => {
    it('S2.N9 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N9')).toBeGreaterThan(0)
    })

    it('S2.N9 evidence snippet contains onDrawForeground fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N9', 0)
      expect(snippet).toMatch(/onDrawForeground/i)
    })

    it('S2.N9 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N9', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S3.C1 — evidence excerpts', () => {
    it('S3.C1 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S3.C1')).toBeGreaterThan(0)
    })

    it('S3.C1 evidence snippet contains drawNodeShape or prototype fingerprint', () => {
      const count = countEvidenceExcerpts('S3.C1')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S3.C1', i)
        if (/drawNodeShape|prototype/i.test(snippet)) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S3.C1 excerpt with drawNodeShape or prototype fingerprint').toBe(true)
    })

    it('S3.C1 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S3.C1', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S3.C2 — evidence excerpts', () => {
    it.todo('S3.C2 evidence excerpts — pattern not yet in database snapshot')
  })
})
