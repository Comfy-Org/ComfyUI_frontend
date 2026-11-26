import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@comfyorg/graph-state/layout/layoutMutations'
import { LayoutSource } from '@comfyorg/graph-state/layout/types'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createUuidv4 } from '@comfyorg/graph-model/uuid'

// Mock the layout mutations module
vi.mock(import('@comfyorg/graph-state/layout/layoutMutations'), () => ({
  useLayoutMutations: vi.fn()
}))

const CURRENT_GRAPH = fromPartial<LGraph>({ id: createUuidv4() })

const mockedUseLayoutMutations = vi.mocked(useLayoutMutations)

describe('useNodeZIndex', () => {
  it('scopes the mutation to the viewed root graph, attributed to Vue', () => {
    const mockSetNodeOrder = vi.fn()
    useCanvasStore().currentGraph = CURRENT_GRAPH

    mockedUseLayoutMutations.mockReturnValue(
      fromPartial({
        setNodeOrder: mockSetNodeOrder
      })
    )

    const { bringNodeToFront } = useNodeZIndex()

    bringNodeToFront(toNodeId('node1'))

    expect(mockedUseLayoutMutations).toHaveBeenCalledWith(LayoutSource.Vue)
    expect(mockSetNodeOrder).toHaveBeenCalledWith(
      CURRENT_GRAPH,
      'node1',
      'front'
    )
  })
})
