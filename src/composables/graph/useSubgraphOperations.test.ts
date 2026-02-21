import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  publishSubgraph: vi.fn()
}))

vi.mock('@/composables/canvas/useSelectedLiteGraphItems', () => ({
  useSelectedLiteGraphItems: () => ({
    getSelectedNodes: vi.fn(() => [])
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: vi.fn(),
    selectedItems: [],
    updateSelectedItems: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

vi.mock('@/stores/imagePreviewStore', () => ({
  useNodeOutputStore: () => ({
    revokeSubgraphPreviews: vi.fn()
  })
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: () => ({
    publishSubgraph: mocks.publishSubgraph
  })
}))

describe('useSubgraphOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('addSubgraphToLibrary calls publishSubgraph to save the subgraph', async () => {
    const { useSubgraphOperations } =
      await import('@/composables/graph/useSubgraphOperations')
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(mocks.publishSubgraph).toHaveBeenCalledOnce()
  })
})
