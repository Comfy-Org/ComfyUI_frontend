import { createTestingPinia } from '@pinia/testing'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const mockAppModeState = vi.hoisted(() => ({
  isApiMode: { value: false },
  setMode: vi.fn()
}))
const mockActiveWorkflow = vi.hoisted(
  () => ({ value: null }) as { value: unknown }
)

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isAppMode: { value: false },
    isApiMode: mockAppModeState.isApiMode,
    isBuilderMode: { value: false },
    setMode: mockAppModeState.setMode
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
    }
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

describe('useCanvasStore', () => {
  let store: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useCanvasStore()
    vi.clearAllMocks()
    mockActiveWorkflow.value = null
  })

  describe('apiMode entry', () => {
    // Use a real pinia so the writable computed setter runs (createTestingPinia
    // makes getters overridable, which would bypass the setter under test).
    let realStore: ReturnType<typeof useCanvasStore>

    beforeEach(() => {
      setActivePinia(createPinia())
      realStore = useCanvasStore()
    })

    it('opens the Swagger when the workflow already has linear data', () => {
      mockActiveWorkflow.value = {
        changeTracker: {
          activeState: { extra: { linearData: { inputs: [['1', 'text']] } } }
        }
      }

      realStore.apiMode = true

      expect(realStore.apiShowSwagger).toBe(true)
      expect(mockAppModeState.setMode).toHaveBeenCalledWith('api')
    })

    it('opens the builder/preview when the workflow has no linear data', () => {
      mockActiveWorkflow.value = {
        changeTracker: {
          activeState: { extra: { linearData: { inputs: [], outputs: [] } } }
        }
      }

      realStore.apiMode = true

      expect(realStore.apiShowSwagger).toBe(false)
      expect(mockAppModeState.setMode).toHaveBeenCalledWith('api')
    })
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
})
