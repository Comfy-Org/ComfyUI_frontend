import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphCanvas, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const { appModeState } = vi.hoisted(() => ({
  appModeState: {} as { isAppMode: Ref<boolean> }
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isAppMode: appModeState.isAppMode,
    setMode: vi.fn()
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      ds: {
        scale: 1,
        offset: [0, 0] as [number, number],
        onChanged: undefined as
          | ((scale: number, offset: [number, number]) => void)
          | undefined,
        element: null,
        changeScale: vi.fn()
      },
      setDirty: vi.fn(),
      graph: null,
      selectedItems: new Set(),
      subgraph: undefined,
      canvas: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    }
  }
}))

function createMockCanvas(readOnly = false): LGraphCanvas {
  return {
    read_only: readOnly,
    canvas: document.createElement('canvas')
  } as unknown as LGraphCanvas
}

describe('useCanvasStore', () => {
  let store: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    appModeState.isAppMode = ref(false)
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useCanvasStore()
    vi.clearAllMocks()
  })

  describe('appScalePercentage', () => {
    it('rounds scale to integer percentage', async () => {
      const { app } = await import('@/scripts/app')

      app.canvas.ds.scale = 1.004
      store.initScaleSync()
      expect(store.appScalePercentage).toBe(100)

      app.canvas.ds.scale = 1.506
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)
      expect(store.appScalePercentage).toBe(151)
    })

    it('updates reactive value when rounded scale changes', async () => {
      const { app } = await import('@/scripts/app')

      app.canvas.ds.scale = 1.0
      store.initScaleSync()
      expect(store.appScalePercentage).toBe(100)

      app.canvas.ds.scale = 1.5
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)

      expect(store.appScalePercentage).toBe(150)
    })

    it('preserves original onChanged handler', async () => {
      const { app } = await import('@/scripts/app')
      const originalHandler = vi.fn()
      app.canvas.ds.onChanged = originalHandler

      app.canvas.ds.scale = 1.0
      store.initScaleSync()

      app.canvas.ds.scale = 2.0
      app.canvas.ds.onChanged!(app.canvas.ds.scale, app.canvas.ds.offset)

      expect(originalHandler).toHaveBeenCalledWith(2.0, app.canvas.ds.offset)
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

  it('Does not include groups in selected nodeIds', async () => {
    store.selectedItems = [new LGraphGroup()]

    expect(store.selectedNodeIds).toHaveLength(0)
  })

  describe('isReadOnly', () => {
    it('syncs initial read_only value when canvas is set', async () => {
      const mockCanvas = createMockCanvas(true)

      store.canvas = mockCanvas as unknown as LGraphCanvas
      await nextTick()

      expect(store.isReadOnly).toBe(true)
    })

    it('updates isReadOnly when litegraph:read-only-changed event fires', async () => {
      const mockCanvas = createMockCanvas(false)

      store.canvas = mockCanvas as unknown as LGraphCanvas
      await nextTick()

      expect(store.isReadOnly).toBe(false)

      // Simulate space key press → LGraphCanvas sets read_only = true
      mockCanvas.canvas.dispatchEvent(
        new CustomEvent('litegraph:read-only-changed', {
          detail: { readOnly: true }
        })
      )

      expect(store.isReadOnly).toBe(true)

      // Simulate space key release
      mockCanvas.canvas.dispatchEvent(
        new CustomEvent('litegraph:read-only-changed', {
          detail: { readOnly: false }
        })
      )

      expect(store.isReadOnly).toBe(false)
    })
  })
})
