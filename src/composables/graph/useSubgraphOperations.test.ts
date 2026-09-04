import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'

const mocks = vi.hoisted(() => ({
  publishSubgraph: vi.fn(),
  selectedItems: [] as unknown[],
  canvas: {
    subgraph: null,
    graph: null as { unpackSubgraph: ReturnType<typeof vi.fn> } | null,
    selectedItems: new Set<unknown>()
  },
  captureCanvasState: vi.fn(),
  revokeSubgraphPreviews: vi.fn()
}))

vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: () => ({
    getSelectedNodes: vi.fn(() => [])
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: vi.fn(() => mocks.canvas),
    get selectedItems() {
      return mocks.selectedItems
    },
    updateSelectedItems: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      changeTracker: { captureCanvasState: mocks.captureCanvasState }
    }
  })
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    revokeSubgraphPreviews: mocks.revokeSubgraphPreviews
  })
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: () => ({
    publishSubgraph: mocks.publishSubgraph
  })
}))

function createSubgraphNode(): SubgraphNode {
  const node = Object.create(SubgraphNode.prototype)
  return node
}

function createRegularNode(): LGraphNode {
  return new LGraphNode('testnode')
}

describe('useSubgraphOperations', () => {
  beforeEach(() => {
    mocks.selectedItems = []
    mocks.canvas.graph = null
    mocks.canvas.selectedItems.clear()
  })

  it('preserves previews and history when unpacking fails', async () => {
    const subgraphNode = createSubgraphNode()
    const unpackSubgraphNode = vi.fn(() => false)
    mocks.canvas.graph = { unpackSubgraph: unpackSubgraphNode }
    mocks.canvas.selectedItems.add(subgraphNode)

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    useSubgraphOperations().unpackSubgraph()

    expect(unpackSubgraphNode).toHaveBeenCalledWith(subgraphNode, {
      skipMissingNodes: true
    })
    expect(mocks.revokeSubgraphPreviews).not.toHaveBeenCalled()
    expect(mocks.captureCanvasState).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary calls publishSubgraph when single SubgraphNode selected', async () => {
    mocks.selectedItems = [createSubgraphNode()]

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(mocks.publishSubgraph).toHaveBeenCalledOnce()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when no items selected', async () => {
    mocks.selectedItems = []

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(mocks.publishSubgraph).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when multiple items selected', async () => {
    mocks.selectedItems = [createSubgraphNode(), createSubgraphNode()]

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(mocks.publishSubgraph).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when selected item is not a SubgraphNode', async () => {
    mocks.selectedItems = [createRegularNode()]

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(mocks.publishSubgraph).not.toHaveBeenCalled()
  })
})
