import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import type * as LitegraphUtilModule from '@/utils/litegraphUtil'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

function createMockWorkflow(path: string): LoadedComfyWorkflow {
  return new ComfyWorkflowClass({
    path,
    modified: Date.now(),
    size: 100
  }) as LoadedComfyWorkflow
}

vi.mock('@/utils/litegraphUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof LitegraphUtilModule>()
  return {
    ...actual,
    isLGraphNode: (item: unknown) =>
      typeof item === 'object' && item !== null && 'id' in item
  }
})

function createMockCanvas() {
  const selectedItems = new Set<LGraphNode>()
  const canvas = {
    selectedItems,
    allow_dragnodes: true,
    selectOnly: false,
    select: vi.fn((item: LGraphNode) => {
      selectedItems.add(item)
    }),
    deselect: vi.fn((item: LGraphNode) => {
      selectedItems.delete(item)
    })
  }
  return { canvas, asCanvas: canvas as unknown as LGraphCanvas }
}

describe('useAgentNodeSelectionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('enter() activates select-only mode and disables node dragging', () => {
    const canvasStore = useCanvasStore()
    const { canvas, asCanvas } = createMockCanvas()
    canvasStore.canvas = asCanvas

    const store = useAgentNodeSelectionStore()
    store.enter()

    expect(store.isActive).toBe(true)
    expect(canvas.selectOnly).toBe(true)
    expect(canvas.allow_dragnodes).toBe(false)
  })

  test('exit() restores the previous allow_dragnodes value and clears selectOnly', () => {
    const canvasStore = useCanvasStore()
    const { canvas, asCanvas } = createMockCanvas()
    canvas.allow_dragnodes = false
    canvasStore.canvas = asCanvas

    const store = useAgentNodeSelectionStore()
    store.enter()
    store.exit()

    expect(store.isActive).toBe(false)
    expect(canvas.selectOnly).toBe(false)
    expect(canvas.allow_dragnodes).toBe(false)
  })

  test('referencedNodes tracks canvas selection while active', async () => {
    const canvasStore = useCanvasStore()
    const { canvas, asCanvas } = createMockCanvas()
    canvasStore.canvas = asCanvas

    const store = useAgentNodeSelectionStore()
    store.enter()

    const node = createMockLGraphNode({ id: 1 })
    canvas.selectedItems.add(node)
    canvasStore.updateSelectedItems()
    await nextTick()

    expect(store.referencedNodes).toEqual([node])
  })

  test('referencedNodes freezes after exit() and no longer tracks canvas selection', async () => {
    const canvasStore = useCanvasStore()
    const { canvas, asCanvas } = createMockCanvas()
    canvasStore.canvas = asCanvas

    const store = useAgentNodeSelectionStore()
    store.enter()

    const node = createMockLGraphNode({ id: 1 })
    canvas.selectedItems.add(node)
    canvasStore.updateSelectedItems()
    await nextTick()
    expect(store.referencedNodes).toEqual([node])

    store.exit()

    const secondNode = createMockLGraphNode({ id: 2 })
    canvas.selectedItems.add(secondNode)
    canvasStore.updateSelectedItems()
    await nextTick()

    expect(store.referencedNodes).toEqual([node])
  })

  test('removeNode() deselects on canvas only when the node is currently selected', async () => {
    const canvasStore = useCanvasStore()
    const { canvas, asCanvas } = createMockCanvas()
    canvasStore.canvas = asCanvas

    const store = useAgentNodeSelectionStore()
    const node = createMockLGraphNode({ id: 1 })
    store.enter()
    canvas.selectedItems.add(node)
    canvasStore.updateSelectedItems()
    await nextTick()
    expect(store.referencedNodes).toEqual([node])

    store.removeNode(node)

    expect(canvas.deselect).toHaveBeenCalledWith(node)
    expect(store.referencedNodes).toEqual([])

    canvas.deselect.mockClear()
    store.removeNode(node)
    expect(canvas.deselect).not.toHaveBeenCalled()
  })

  test('addNode() is idempotent and selects the node on canvas', () => {
    const canvasStore = useCanvasStore()
    const { canvas, asCanvas } = createMockCanvas()
    canvasStore.canvas = asCanvas

    const store = useAgentNodeSelectionStore()
    const node = createMockLGraphNode({ id: 1 })

    store.addNode(node)
    store.addNode(node)

    expect(store.referencedNodes).toEqual([node])
    expect(canvas.select).toHaveBeenCalledTimes(1)
  })

  test('graphNodes refreshes after switching workflows even though the graph object is reused', () => {
    const canvasStore = useCanvasStore()
    const workflowStore = useWorkflowStore()

    const nodeA = createMockLGraphNode({ id: 1 })
    // Workflow switches reconfigure the same root LGraph instance in place
    // rather than replacing it with a new object.
    const graph = { nodes: [nodeA] }
    canvasStore.currentGraph = graph as unknown as LGraph
    workflowStore.activeWorkflow = createMockWorkflow('a.json')

    const store = useAgentNodeSelectionStore()
    expect(store.graphNodes).toEqual([nodeA])

    const nodeB = createMockLGraphNode({ id: 2 })
    graph.nodes = [nodeB]
    workflowStore.activeWorkflow = createMockWorkflow('b.json')

    expect(store.graphNodes).toEqual([nodeB])
  })
})
