import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

// Mock the layout mutations module
vi.mock(import('@/renderer/core/layout/operations/layoutMutations'), () => ({
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
