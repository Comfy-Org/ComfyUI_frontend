import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

// Mock the layout mutations module
vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: vi.fn()
}))

const ROOT_GRAPH_ID = createUuidv4()
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ rootGraphId: ROOT_GRAPH_ID })
}))

const mockedUseLayoutMutations = vi.mocked(useLayoutMutations)

describe('useNodeZIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the mutation to the viewed root graph, attributed to Vue', () => {
    const mockSetSource = vi.fn()
    const mockBringNodeToFront = vi.fn()

    mockedUseLayoutMutations.mockReturnValue(
      fromPartial({
        setSource: mockSetSource,
        bringNodeToFront: mockBringNodeToFront
      })
    )

    const { bringNodeToFront } = useNodeZIndex()

    bringNodeToFront(toNodeId('node1'))

    expect(mockSetSource).toHaveBeenCalledWith(LayoutSource.Vue)
    expect(mockBringNodeToFront).toHaveBeenCalledWith(ROOT_GRAPH_ID, 'node1')
  })
})
