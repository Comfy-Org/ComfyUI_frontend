import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
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
    useCanvasStore().selectedItems = []
    useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
      changeTracker: { captureCanvasState }
    })
    vi.mocked(useSubgraphStore().publishSubgraph).mockResolvedValue(undefined)
  })

  it('preserves previews and history when unpacking fails', () => {
    const subgraphNode = createSubgraphNode()
    const unpackSubgraphNode = vi.fn(() => false)
    vi.mocked(useCanvasStore().getCanvas).mockReturnValue(
      fromPartial<LGraphCanvas>({
        graph: fromPartial<LGraph>({ unpackSubgraph: unpackSubgraphNode }),
        selectedItems: new Set([subgraphNode])
      })
    )

    useSubgraphOperations().unpackSubgraph()

    expect(unpackSubgraphNode).toHaveBeenCalledWith(subgraphNode, {
      skipMissingNodes: true
    })
    expect(useNodeOutputStore().revokeSubgraphPreviews).not.toHaveBeenCalled()
    expect(captureCanvasState).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary calls publishSubgraph when single SubgraphNode selected', async () => {
    useCanvasStore().selectedItems = [createSubgraphNode()]
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).toHaveBeenCalledOnce()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when no items selected', async () => {
    useCanvasStore().selectedItems = []
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when multiple items selected', async () => {
    useCanvasStore().selectedItems = [
      createSubgraphNode(),
      createSubgraphNode()
    ]
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).not.toHaveBeenCalled()
  })

  it('addSubgraphToLibrary does not call publishSubgraph when selected item is not a SubgraphNode', async () => {
    useCanvasStore().selectedItems = [createRegularNode()]
    const { addSubgraphToLibrary } = useSubgraphOperations()

    await addSubgraphToLibrary()

    expect(useSubgraphStore().publishSubgraph).not.toHaveBeenCalled()
  })
})
