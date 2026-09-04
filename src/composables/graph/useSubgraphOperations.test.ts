import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { useSubgraphOperations } from './useSubgraphOperations'

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
    vi.mocked(useSubgraphStore().publishSubgraph).mockResolvedValue(undefined)
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
