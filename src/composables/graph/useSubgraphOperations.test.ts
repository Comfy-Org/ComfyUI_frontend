import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'

const mocks = vi.hoisted(() => ({
  publishSubgraph: vi.fn(),
  selectedItems: [] as unknown[],
  getSelectedNodes: vi.fn((): unknown[] => []),
  getCanvas: vi.fn(),
  updateSelectedItems: vi.fn(),
  revokeSubgraphPreviews: vi.fn(),
  activeWorkflow: null as null | {
    changeTracker?: {
      captureCanvasState: () => void
    }
  }
}))

vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: () => ({
    getSelectedNodes: mocks.getSelectedNodes
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: mocks.getCanvas,
    get selectedItems() {
      return mocks.selectedItems
    },
    updateSelectedItems: mocks.updateSelectedItems
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mocks.activeWorkflow
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

function createCanvas({
  graph,
  subgraph,
  selectedItems = []
}: {
  graph?: {
    convertToSubgraph?: ReturnType<typeof vi.fn>
    unpackSubgraph?: ReturnType<typeof vi.fn>
  }
  subgraph?: {
    convertToSubgraph?: ReturnType<typeof vi.fn>
    unpackSubgraph?: ReturnType<typeof vi.fn>
  }
  selectedItems?: unknown[]
} = {}) {
  return {
    graph,
    subgraph,
    selectedItems: new Set(selectedItems),
    select: vi.fn()
  }
}

describe('useSubgraphOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedItems = []
    mocks.getSelectedNodes.mockReturnValue([])
    mocks.getCanvas.mockReturnValue(createCanvas())
    mocks.activeWorkflow = null
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

  it('reports selected subgraph and selectable node state', async () => {
    mocks.selectedItems = [createRegularNode()]
    mocks.getSelectedNodes.mockReturnValue([])

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { isSubgraphSelected, hasSelectableNodes } = useSubgraphOperations()

    expect(isSubgraphSelected()).toBe(false)
    expect(hasSelectableNodes()).toBe(false)

    mocks.selectedItems = [createSubgraphNode()]
    mocks.getSelectedNodes.mockReturnValue([createRegularNode()])

    expect(isSubgraphSelected()).toBe(true)
    expect(hasSelectableNodes()).toBe(true)
  })

  it('converts selected items to a subgraph and captures workflow state', async () => {
    const captureCanvasState = vi.fn()
    const node = createSubgraphNode()
    const graph = {
      convertToSubgraph: vi.fn(() => ({ node })),
      unpackSubgraph: vi.fn()
    }
    const canvas = createCanvas({
      graph,
      selectedItems: [createRegularNode()]
    })
    mocks.getCanvas.mockReturnValue(canvas)
    mocks.activeWorkflow = {
      changeTracker: {
        captureCanvasState
      }
    }

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { convertToSubgraph } = useSubgraphOperations()

    convertToSubgraph()

    expect(graph.convertToSubgraph).toHaveBeenCalledWith(canvas.selectedItems)
    expect(canvas.select).toHaveBeenCalledWith(node)
    expect(mocks.updateSelectedItems).toHaveBeenCalledOnce()
    expect(captureCanvasState).toHaveBeenCalledOnce()
  })

  it('does not select or capture when conversion has no graph or no result', async () => {
    const graph = {
      convertToSubgraph: vi.fn(() => null),
      unpackSubgraph: vi.fn()
    }
    const canvas = createCanvas({ graph })
    mocks.getCanvas
      .mockReturnValueOnce(createCanvas())
      .mockReturnValueOnce(canvas)

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { convertToSubgraph } = useSubgraphOperations()

    expect(convertToSubgraph()).toBeNull()
    expect(convertToSubgraph()).toBeUndefined()
    expect(canvas.select).not.toHaveBeenCalled()
    expect(mocks.updateSelectedItems).not.toHaveBeenCalled()
  })

  it('unpacks selected subgraph nodes from the active graph and revokes previews', async () => {
    const captureCanvasState = vi.fn()
    const subgraphNode = createSubgraphNode()
    const graph = {
      convertToSubgraph: vi.fn(),
      unpackSubgraph: vi.fn()
    }
    mocks.getCanvas.mockReturnValue(
      createCanvas({
        subgraph: graph,
        selectedItems: [subgraphNode, createRegularNode()]
      })
    )
    mocks.activeWorkflow = {
      changeTracker: {
        captureCanvasState
      }
    }

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { unpackSubgraph } = useSubgraphOperations()

    unpackSubgraph()

    expect(mocks.revokeSubgraphPreviews).toHaveBeenCalledWith(subgraphNode)
    expect(graph.unpackSubgraph).toHaveBeenCalledWith(subgraphNode, {
      skipMissingNodes: true
    })
    expect(captureCanvasState).toHaveBeenCalledOnce()
  })

  it('does not unpack when no graph or no subgraph nodes are selected', async () => {
    const graph = {
      convertToSubgraph: vi.fn(),
      unpackSubgraph: vi.fn()
    }
    mocks.getCanvas
      .mockReturnValueOnce(createCanvas())
      .mockReturnValueOnce(
        createCanvas({ graph, selectedItems: [createRegularNode()] })
      )

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { unpackSubgraph } = useSubgraphOperations()

    unpackSubgraph()
    unpackSubgraph()

    expect(graph.unpackSubgraph).not.toHaveBeenCalled()
    expect(mocks.revokeSubgraphPreviews).not.toHaveBeenCalled()
  })
})
