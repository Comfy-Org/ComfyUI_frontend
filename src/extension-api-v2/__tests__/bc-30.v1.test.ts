// Category: BC.30 — Graph change tracking, batching, and reactivity flush
// DB cross-ref: S11.G1, S11.G3, S11.G4
// Exemplar: https://github.com/nodetool-ai/nodetool/blob/main/subgraphs.md#L1
// blast_radius: 5.48
// compat-floor: blast_radius ≥ 2.0
// v1 contract: graph._version++, graph.beforeChange(), graph.afterChange(), node.setDirtyCanvas(true, true)

import { describe, it, expect, vi } from 'vitest'

// ── v1 LiteGraph mock ───────────────────────────────────────────────────────

interface V1Node {
  id: number
  type: string
  setDirtyCanvas(foreground: boolean, background: boolean): void
}

interface V1Graph {
  _nodes: V1Node[]
  _version: number
  _changeDepth: number
  _canvasNeedsDraw: boolean
  add(node: V1Node): void
  remove(node: V1Node): void
  beforeChange(): void
  afterChange(): void
}

function createV1Graph(): V1Graph {
  return {
    _nodes: [],
    _version: 1,
    _changeDepth: 0,
    _canvasNeedsDraw: false,

    add(node: V1Node) {
      this._nodes.push(node)
      this._version++
    },

    remove(node: V1Node) {
      const idx = this._nodes.indexOf(node)
      if (idx >= 0) {
        this._nodes.splice(idx, 1)
        this._version++
      }
    },

    beforeChange() {
      this._changeDepth++
    },

    afterChange() {
      this._changeDepth--
      if (this._changeDepth === 0) {
        this._canvasNeedsDraw = true
      }
    }
  }
}

function createV1Node(id: number, type: string): V1Node {
  return {
    id,
    type,
    setDirtyCanvas(_foreground: boolean, _background: boolean) {
      // Schedules canvas repaint
    }
  }
}

describe('BC.30 v1 contract — graph change tracking, batching, and reactivity flush', () => {
  describe('S11.G1 — _version monotonic counter', () => {
    it('graph._version is a numeric property that increments with each structural change', () => {
      const graph = createV1Graph()

      expect(typeof graph._version).toBe('number')

      const initialVersion = graph._version
      graph.add(createV1Node(1, 'TestNode'))

      expect(graph._version).toBe(initialVersion + 1)
    })

    it('extension can increment graph._version to signal a change', () => {
      const graph = createV1Graph()

      const before = graph._version
      graph._version++ // Manual increment

      expect(graph._version).toBe(before + 1)
    })

    it('reading graph._version before and after a node add/remove shows the value increased', () => {
      const graph = createV1Graph()

      const v1 = graph._version
      const node = createV1Node(1, 'TestNode')
      graph.add(node)
      const v2 = graph._version
      graph.remove(node)
      const v3 = graph._version

      expect(v2).toBeGreaterThan(v1)
      expect(v3).toBeGreaterThan(v2)
    })

    it('_version is used for change detection (dirty checking pattern)', () => {
      const graph = createV1Graph()
      let cachedVersion = graph._version
      let cacheInvalidated = false

      function checkCache() {
        if (graph._version !== cachedVersion) {
          cacheInvalidated = true
          cachedVersion = graph._version
        }
      }

      checkCache()
      expect(cacheInvalidated).toBe(false)

      graph.add(createV1Node(1, 'TestNode'))
      checkCache()

      expect(cacheInvalidated).toBe(true)
    })
  })

  describe('S11.G3 — beforeChange / afterChange batching', () => {
    it('calling graph.beforeChange() suspends incremental canvas redraws', () => {
      const graph = createV1Graph()

      graph.beforeChange()
      expect(graph._changeDepth).toBe(1)

      // Canvas should not be marked dirty until afterChange
      graph.add(createV1Node(1, 'TestNode'))
      expect(graph._canvasNeedsDraw).toBe(false)
    })

    it('calling graph.afterChange() after a batch triggers a consolidated redraw', () => {
      const graph = createV1Graph()

      graph.beforeChange()
      graph.add(createV1Node(1, 'Node1'))
      graph.add(createV1Node(2, 'Node2'))
      graph.afterChange()

      expect(graph._canvasNeedsDraw).toBe(true)
    })

    it('nested beforeChange/afterChange calls are ref-counted', () => {
      const graph = createV1Graph()

      graph.beforeChange() // depth = 1
      graph.beforeChange() // depth = 2

      graph.add(createV1Node(1, 'TestNode'))

      graph.afterChange() // depth = 1
      expect(graph._canvasNeedsDraw).toBe(false) // Still batching

      graph.afterChange() // depth = 0
      expect(graph._canvasNeedsDraw).toBe(true) // Now flushed
    })

    it('only the outermost afterChange triggers the flush', () => {
      const graph = createV1Graph()
      let flushCount = 0
      const originalAfterChange = graph.afterChange.bind(graph)
      graph.afterChange = function () {
        originalAfterChange()
        if (this._changeDepth === 0) {
          flushCount++
        }
      }

      graph.beforeChange()
      graph.beforeChange()
      graph.afterChange()
      graph.afterChange()

      expect(flushCount).toBe(1)
    })
  })

  describe('S11.G4 — setDirtyCanvas imperative flush', () => {
    it('node.setDirtyCanvas(true, false) marks the foreground canvas dirty', () => {
      const setDirtyCanvasSpy = vi.fn()
      const node: V1Node = {
        id: 1,
        type: 'TestNode',
        setDirtyCanvas: setDirtyCanvasSpy
      }

      node.setDirtyCanvas(true, false)

      expect(setDirtyCanvasSpy).toHaveBeenCalledWith(true, false)
    })

    it('node.setDirtyCanvas(true, true) marks both foreground and background canvases dirty', () => {
      const setDirtyCanvasSpy = vi.fn()
      const node: V1Node = {
        id: 1,
        type: 'TestNode',
        setDirtyCanvas: setDirtyCanvasSpy
      }

      node.setDirtyCanvas(true, true)

      expect(setDirtyCanvasSpy).toHaveBeenCalledWith(true, true)
    })

    it('setDirtyCanvas is called imperatively after property changes', () => {
      const setDirtyCanvasSpy = vi.fn()
      const node: V1Node & { title: string } = {
        id: 1,
        type: 'TestNode',
        title: 'Original',
        setDirtyCanvas: setDirtyCanvasSpy
      }

      // Typical v1 pattern: mutate property, then trigger repaint
      node.title = 'Updated'
      node.setDirtyCanvas(true, false)

      expect(setDirtyCanvasSpy).toHaveBeenCalled()
    })
  })
})
