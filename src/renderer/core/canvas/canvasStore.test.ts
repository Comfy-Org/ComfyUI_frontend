import { fromPartial } from '@total-typescript/shoehorn'
import { nextTick } from 'vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { selectableKeyOf } from '@/lib/litegraph/src/utils/selectableItems'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/litegraphTestUtils'
import { reconcileAgentAdapters } from '@/workbench/extensions/agent/crdt/agentNodeMaterializer'

vi.mock<unknown>(import('@/scripts/app'), () => ({
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
      app.canvas.ds.onChanged(app.canvas.ds.scale, app.canvas.ds.offset)

      expect(originalHandler).toHaveBeenCalledWith(2.0, app.canvas.ds.offset)
    })
  })

  describe('node:before-removed selection cleanup', () => {
    it.for(['direct', 'materialized'] as const)(
      'clears selection before onRemoved during %s replacement',
      async (mode) => {
        const graph = new LGraph()
        const node = new LGraphNode('test')
        node.type = 'test-node'
        graph.add(node)

        const scope = graphScopeOf(graph)
        const selectionStore = useSelectionStore()
        const canvas = createTestCanvas(
          graph,
          createMockCanvasRenderingContext2D()
        )
        document.body.append(canvas.canvas)
        onTestFinished(() => {
          canvas.unbindEvents()
          canvas.canvas.remove()
        })
        store.canvas = canvas
        await nextTick()
        canvas.select(node)
        expect(store.selectedItems).toContain(node)

        let stillSelectedInOnRemoved: boolean | undefined
        node.onRemoved = () => {
          stillSelectedInOnRemoved = store.selectedItems.includes(node)
        }

        const replace = {
          direct: () => {
            graph.remove(node)
            const replacement = new LGraphNode('replacement')
            replacement.id = node.id
            graph.add(replacement)
          },
          materialized: () => {
            const nodes = useNodeDataStore()
            const state = nodes.getNode(scope.rootGraphId, node.id)
            assert.exists(state)
            const replacement = {
              ...state,
              lastSerialization: node.serialize()
            }
            nodes.deleteNode(scope, state)
            nodes.registerNode(scope, replacement)
            reconcileAgentAdapters(graph)
          }
        }
        replace[mode]()

        expect(
          stillSelectedInOnRemoved,
          'selectedItems must not contain the node when onRemoved fires'
        ).toBe(false)
        expect(store.selectedItems).toEqual([])
        const replacement = graph.getNodeById(node.id)
        assert.exists(replacement)
        expect(replacement).not.toBe(node)
        expect(selectionStore.selectedKeys(scope)).toEqual([])
        expect([...canvas.selectedItems]).toEqual([])
        expect(replacement.selected).toBeFalsy()
      }
    )
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

  it('resolves selected keys against the current graph and excludes groups from selectedNodeIds', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    const group = new LGraphGroup()
    graph.add(node)
    graph.add(group)
    store.canvas = fromPartial<LGraphCanvas>({
      canvas: document.createElement('canvas'),
      graph
    })
    await nextTick()

    useSelectionStore().apply(graphScopeOf(graph), {
      type: 'selection.replace',
      keys: [selectableKeyOf(group), selectableKeyOf(node)]
    })

    expect(store.selectedItems).toEqual([group, node])
    expect([...store.selectedNodeIds]).toEqual([node.id])
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
