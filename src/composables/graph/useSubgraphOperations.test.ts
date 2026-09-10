import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'

const mocks = vi.hoisted(() => ({
  captureCanvasState: vi.fn(),
  getCanvas: vi.fn(),
  publishSubgraph: vi.fn(),
  revokeSubgraphPreviews: vi.fn(),
  selectedItems: [] as unknown[]
}))

vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: () => ({
    getSelectedNodes: vi.fn(() => [])
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: mocks.getCanvas,
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
    vi.clearAllMocks()
    mocks.selectedItems = []
  })

  it('preserves previews and history when every unpack is refused', async () => {
    const subgraphNode = createSubgraphNode()
    const unpackSubgraph = vi.fn(() => false)
    mocks.getCanvas.mockReturnValue(
      fromPartial<LGraphCanvas>({
        graph: fromPartial<LGraph>({ unpackSubgraph }),
        selectedItems: new Set([subgraphNode])
      })
    )

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    useSubgraphOperations().unpackSubgraph()

    expect(unpackSubgraph).toHaveBeenCalledWith(subgraphNode, {
      skipMissingNodes: true
    })
    expect(mocks.revokeSubgraphPreviews).not.toHaveBeenCalled()
    expect(mocks.captureCanvasState).not.toHaveBeenCalled()
  })

  it('updates previews and history only for successful unpacks', async () => {
    const refusedNode = createSubgraphNode()
    const unpackedNode = createSubgraphNode()
    const unpackSubgraph = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const graph = fromPartial<LGraph>({ unpackSubgraph })
    mocks.getCanvas.mockReturnValue(
      fromPartial<LGraphCanvas>({
        graph,
        selectedItems: new Set([refusedNode, unpackedNode])
      })
    )

    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    useSubgraphOperations().unpackSubgraph()

    expect(mocks.revokeSubgraphPreviews).toHaveBeenCalledOnce()
    expect(mocks.revokeSubgraphPreviews).toHaveBeenCalledWith(
      unpackedNode,
      graph
    )
    expect(mocks.captureCanvasState).toHaveBeenCalledOnce()
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
