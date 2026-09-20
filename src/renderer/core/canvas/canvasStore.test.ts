import { fromPartial } from '@total-typescript/shoehorn'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphCanvas, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

function createMockCanvas(readOnly = false): LGraphCanvas {
  return fromPartial<LGraphCanvas>({
    read_only: readOnly,
    canvas: document.createElement('canvas')
  })
}

describe('useCanvasStore', () => {
  let store: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    store = useCanvasStore()
  })

  describe('appScalePercentage', () => {
    function createScaleCanvas(scale: number) {
      const ds = {
        scale,
        offset: [0, 0] as [number, number],
        onChanged: undefined as
          | ((scale: number, offset: [number, number]) => void)
          | undefined,
        element: document.createElement('canvas'),
        changeScale: vi.fn()
      }
      return fromPartial<LGraphCanvas>({
        ds,
        setDirty: vi.fn(),
        canvas: document.createElement('canvas')
      })
    }

    it('rounds scale to integer percentage', async () => {
      const canvas = createScaleCanvas(1.004)
      store.canvas = canvas
      await nextTick()

      store.initScaleSync()
      expect(store.appScalePercentage).toBe(100)

      canvas.ds.scale = 1.506
      canvas.ds.onChanged!(canvas.ds.scale, canvas.ds.offset)
      expect(store.appScalePercentage).toBe(151)
    })

    it('updates reactive value when rounded scale changes', async () => {
      const canvas = createScaleCanvas(1.0)
      store.canvas = canvas
      await nextTick()

      store.initScaleSync()
      expect(store.appScalePercentage).toBe(100)

      canvas.ds.scale = 1.5
      canvas.ds.onChanged!(canvas.ds.scale, canvas.ds.offset)

      expect(store.appScalePercentage).toBe(150)
    })

    it('preserves original onChanged handler', async () => {
      const canvas = createScaleCanvas(1.0)
      const originalHandler = vi.fn()
      canvas.ds.onChanged = originalHandler
      store.canvas = canvas
      await nextTick()

      store.initScaleSync()

      canvas.ds.scale = 2.0
      canvas.ds.onChanged(canvas.ds.scale, canvas.ds.offset)

      expect(originalHandler).toHaveBeenCalledWith(2.0, canvas.ds.offset)
    })

    it('is a no-op before the canvas exists', () => {
      store.canvas = null

      store.initScaleSync()
      store.setAppZoomFromPercentage(150)
      store.cleanupScaleSync()

      expect(store.appScalePercentage).toBe(100)
    })

    it('zooms the canvas around its centre from a percentage', async () => {
      const canvas = createScaleCanvas(1.0)
      canvas.ds.element.width = 400
      canvas.ds.element.height = 200
      store.canvas = canvas
      await nextTick()

      store.setAppZoomFromPercentage(150)

      expect(canvas.ds.changeScale).toHaveBeenCalledWith(1.5, [200, 100])
      expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
      expect(store.appScalePercentage).toBe(150)
    })
  })

  describe('node:before-removed selection cleanup', () => {
    it('removes the node from store.selectedItems before its onRemoved fires', async () => {
      const graph = new LGraph()
      const node = new LGraphNode('test')
      graph.add(node)

      const selectedItems = new Set<Positionable>([node])
      const fakeCanvas = {
        canvas: document.createElement('canvas'),
        graph,
        selectedItems,
        deselect: vi.fn((item: Positionable) => {
          selectedItems.delete(item)
        })
      }
      store.canvas = fakeCanvas as unknown as LGraphCanvas
      await nextTick()
      store.updateSelectedItems()
      expect(store.selectedItems).toContain(node)

      let stillSelectedInOnRemoved: boolean | undefined
      node.onRemoved = () => {
        stillSelectedInOnRemoved = store.selectedItems.includes(node)
      }

      graph.remove(node)

      expect(
        stillSelectedInOnRemoved,
        'selectedItems must not contain the node when onRemoved fires'
      ).toBe(false)
      expect(store.selectedItems).toEqual([])
    })
  })

  describe('rootGraphId', () => {
    it('tracks the graph id reassigned by a workflow load', async () => {
      const graph = new LGraph()
      const fakeCanvas = {
        canvas: document.createElement('canvas'),
        graph,
        selectedItems: new Set()
      }
      store.canvas = fakeCanvas as unknown as LGraphCanvas
      await nextTick()
      expect(store.rootGraphId).toBe(graph.id)

      const workflowId = '11111111-1111-4111-8111-111111111111'
      graph.configure({ ...graph.serialize(), id: workflowId })

      expect(store.rootGraphId).toBe(workflowId)
    })
  })

  it('Does not include groups in selected nodeIds', async () => {
    store.selectedItems = [new LGraphGroup()]

    expect(store.selectedNodeIds).toHaveLength(0)
  })

  describe('isReadOnly', () => {
    it('syncs initial read_only value when canvas is set', async () => {
      const mockCanvas = createMockCanvas(true)

      store.canvas = mockCanvas
      await nextTick()

      expect(store.isReadOnly).toBe(true)
    })

    it('updates isReadOnly when litegraph:read-only-changed event fires', async () => {
      const mockCanvas = createMockCanvas(false)

      store.canvas = mockCanvas
      await nextTick()

      expect(store.isReadOnly).toBe(false)

      mockCanvas.canvas.dispatchEvent(
        new CustomEvent('litegraph:read-only-changed', {
          detail: { readOnly: true }
        })
      )

      expect(store.isReadOnly).toBe(true)

      mockCanvas.canvas.dispatchEvent(
        new CustomEvent('litegraph:read-only-changed', {
          detail: { readOnly: false }
        })
      )

      expect(store.isReadOnly).toBe(false)
    })
  })
})
