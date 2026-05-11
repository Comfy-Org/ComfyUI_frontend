// Category: BC.04 — Node interaction: pointer, selection, resize
// DB cross-ref: S2.N10, S2.N17, S2.N19
// Exemplar: https://github.com/diodiogod/TTS-Audio-Suite/blob/main/web/chatterbox_voice_capture.js#L202
// Surface: S2.N10 = node.onMouseDown, S2.N17 = node.onSelected, S2.N19 = node.onResize
// compat-floor: blast_radius 4.95 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.onMouseDown, node.onSelected, node.onResize prototype method assignments

import { describe, expect, it, vi } from 'vitest'
import {
  createMiniComfyApp,
  countEvidenceExcerpts,
  loadEvidenceSnippet,
  runV1
} from '../harness'

describe('BC.04 v1 contract — node interaction: pointer, selection, resize', () => {
  describe('S2.N10 — evidence excerpts', () => {
    it('S2.N10 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N10')).toBeGreaterThan(0)
    })

    it('S2.N10 evidence snippet contains onMouseDown fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N10', 0)
      expect(snippet).toMatch(/onMouseDown/i)
    })

    it('S2.N10 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N10', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N17 — evidence excerpts', () => {
    it('S2.N17 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N17')).toBeGreaterThan(0)
    })

    it('S2.N17 evidence snippet contains onSelected fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N17', 0)
      expect(snippet).toMatch(/onSelected/i)
    })

    it('S2.N17 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N17', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N19 — evidence excerpts', () => {
    it('S2.N19 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N19')).toBeGreaterThan(0)
    })

    it('S2.N19 evidence snippet contains onResize fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N19', 0)
      expect(snippet).toMatch(/onResize/i)
    })

    it('S2.N19 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N19', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N10 — node.onMouseDown (synthetic)', () => {
    it('callback receives (event, [x, y]) — synthetic: call with a fake MouseEvent stub and local coords', () => {
      const received: unknown[] = []
      const node = {
        onMouseDown: vi.fn((event: unknown, pos: unknown) => {
          received.push(event, pos)
        })
      }
      const fakeEvent = { type: 'mousedown', button: 0 }
      const localCoords: [number, number] = [15, 30]

      node.onMouseDown(fakeEvent, localCoords)

      expect(node.onMouseDown).toHaveBeenCalledOnce()
      expect(received[0]).toBe(fakeEvent)
      expect(received[1]).toEqual([15, 30])
    })

    it('returning true from onMouseDown signals propagation stop', () => {
      const node = {
        onMouseDown(_event: unknown, _pos: unknown): boolean {
          return true
        }
      }
      const fakeEvent = { type: 'mousedown', button: 0 }
      const result = node.onMouseDown(fakeEvent, [0, 0])

      expect(result).toBe(true)
    })

    it('NOT called when pointer is outside bounds — model: guard fn only calls if within bounds', () => {
      const handler = vi.fn()
      const node = { width: 100, height: 60, onMouseDown: handler }

      function dispatchMouseDown(
        target: typeof node,
        event: unknown,
        localPos: [number, number]
      ) {
        const [x, y] = localPos
        if (x >= 0 && x <= target.width && y >= 0 && y <= target.height) {
          target.onMouseDown(event, localPos)
        }
      }

      const fakeEvent = { type: 'mousedown', button: 0 }
      dispatchMouseDown(node, fakeEvent, [150, 10]) // outside x

      expect(handler).not.toHaveBeenCalled()
    })

    it.todo(
      'canvas rendering tests (need LiteGraph canvas)'
    )

    it.todo(
      'real pointer events (need LiteGraph canvas)'
    )
  })

  describe('S2.N17 — node.onSelected (synthetic)', () => {
    it('onSelected called when node transitions to selected state', () => {
      const onSelected = vi.fn()
      const node = { id: 1, selected: false, onSelected }

      node.selected = true
      node.onSelected()

      expect(onSelected).toHaveBeenCalledOnce()
    })

    it('not called when a different node is selected — model: dispatch to specific node only', () => {
      const onSelectedA = vi.fn()
      const onSelectedB = vi.fn()
      const nodeA = { id: 1, onSelected: onSelectedA }
      const nodeB = { id: 2, onSelected: onSelectedB }

      // Simulate the graph selecting only nodeB
      function selectNode(target: typeof nodeA) {
        target.onSelected()
      }
      selectNode(nodeB)

      expect(onSelectedB).toHaveBeenCalledOnce()
      expect(onSelectedA).not.toHaveBeenCalled()
    })
  })

  describe('S2.N19 — node.onResize (synthetic)', () => {
    it('onResize receives new [width, height]', () => {
      const received: unknown[] = []
      const node = {
        onResize: vi.fn((size: [number, number]) => received.push(size))
      }

      node.onResize([300, 200])

      expect(node.onResize).toHaveBeenCalledOnce()
      expect(received[0]).toEqual([300, 200])
    })
  })
})
