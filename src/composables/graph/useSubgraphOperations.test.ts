import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast'
import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { useSubgraphOperations } from './useSubgraphOperations'

const captureCanvasState = vi.fn()

vi.mock<unknown>(
  import('@/composables/canvas/useSelectedLiteGraphItems'),
  () => ({
    useSelectedLiteGraphItems: () => ({
      getSelectedNodes: vi.fn(() => [])
    })
  })
)

function createSubgraphNode(): SubgraphNode {
  const node = Object.create(SubgraphNode.prototype)
  return node
}

function createRegularNode(): LGraphNode {
  return new LGraphNode('testnode')
}

describe('useSubgraphOperations', () => {
  beforeEach(() => {
    setCanvasSelection([])
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      changeTracker: { captureCanvasState }
    })
    vi.mocked(useSubgraphStore().publishSubgraph).mockResolvedValue(undefined)
  })

  it('preserves previews and history when every unpack is refused', () => {
    const firstSubgraphNode = createSubgraphNode()
    const secondSubgraphNode = createSubgraphNode()
    const unpackSubgraph = vi.fn(() => false)
    const revokeSubgraphPreviews = vi
      .spyOn(useNodeOutputStore(), 'revokeSubgraphPreviews')
      .mockImplementation(() => {})
    vi.mocked(useCanvasStore().getCanvas).mockReturnValue(
      fromPartial<LGraphCanvas>({
        graph: fromPartial<LGraph>({ unpackSubgraph }),
        selectedItems: new Set([firstSubgraphNode, secondSubgraphNode])
      })
    )

    useSubgraphOperations().unpackSubgraph()

    expect(unpackSubgraph).toHaveBeenCalledWith(firstSubgraphNode, {
      skipMissingNodes: true
    })
    expect(unpackSubgraph).toHaveBeenCalledWith(secondSubgraphNode, {
      skipMissingNodes: true
    })
    expect(revokeSubgraphPreviews).not.toHaveBeenCalled()
    expect(captureCanvasState).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledWith('Error', {
      description: 'Unable to unpack the selected subgraph.'
    })
  })

  it('updates previews and history only for successful unpacks', () => {
    const refusedNode = createSubgraphNode()
    const unpackedNode = createSubgraphNode()
    const unpackSubgraph = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const graph = fromPartial<LGraph>({ unpackSubgraph })
    const revokeSubgraphPreviews = vi
      .spyOn(useNodeOutputStore(), 'revokeSubgraphPreviews')
      .mockImplementation(() => {})
    vi.mocked(useCanvasStore().getCanvas).mockReturnValue(
      fromPartial<LGraphCanvas>({
        graph,
        selectedItems: new Set([refusedNode, unpackedNode])
      })
    )

    useSubgraphOperations().unpackSubgraph()

    expect(revokeSubgraphPreviews).toHaveBeenCalledOnce()
    expect(revokeSubgraphPreviews).toHaveBeenCalledWith(unpackedNode, graph)
    expect(captureCanvasState).toHaveBeenCalledOnce()
  })

  it('addSubgraphToLibrary calls publishSubgraph when single SubgraphNode selected', async () => {
    setCanvasSelection([createSubgraphNode()])
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).toHaveBeenCalledOnce()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when no items selected', async () => {
    setCanvasSelection([])
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when multiple items selected', async () => {
    setCanvasSelection([createSubgraphNode(), createSubgraphNode()])
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when selected item is not a SubgraphNode', async () => {
    setCanvasSelection([createRegularNode()])
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).not.toHaveBeenCalled()
  })
})
