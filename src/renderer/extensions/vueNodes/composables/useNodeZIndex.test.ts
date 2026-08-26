import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

// Mock the layout mutations module
vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: vi.fn()
}))

const CURRENT_GRAPH = fromPartial({ id: createUuidv4() })
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ currentGraph: CURRENT_GRAPH })
}))

const mockedUseLayoutMutations = vi.mocked(useLayoutMutations)

describe('useNodeZIndex', () => {
  it('scopes the mutation to the viewed root graph, attributed to Vue', () => {
    const mockSetNodeOrder = vi.fn()

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
