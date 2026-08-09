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

  describe('bringNodeToFront', () => {
    it('should bring node to front with default source', () => {
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

    it('should bring node to front with custom source', () => {
      const mockSetSource = vi.fn()
      const mockBringNodeToFront = vi.fn()

      mockedUseLayoutMutations.mockReturnValue(
        fromPartial({
          setSource: mockSetSource,
          bringNodeToFront: mockBringNodeToFront
        })
      )

      const { bringNodeToFront } = useNodeZIndex()

      bringNodeToFront(toNodeId('node2'), LayoutSource.Canvas)

      expect(mockSetSource).toHaveBeenCalledWith(LayoutSource.Canvas)
      expect(mockBringNodeToFront).toHaveBeenCalledWith(ROOT_GRAPH_ID, 'node2')
    })

    it('should use custom layout source from options', () => {
      const mockSetSource = vi.fn()
      const mockBringNodeToFront = vi.fn()

      mockedUseLayoutMutations.mockReturnValue(
        fromPartial({
          setSource: mockSetSource,
          bringNodeToFront: mockBringNodeToFront
        })
      )

      const { bringNodeToFront } = useNodeZIndex({
        layoutSource: LayoutSource.External
      })

      bringNodeToFront(toNodeId('node3'))

      expect(mockSetSource).toHaveBeenCalledWith(LayoutSource.External)
      expect(mockBringNodeToFront).toHaveBeenCalledWith(ROOT_GRAPH_ID, 'node3')
    })

    it('should override layout source with explicit source parameter', () => {
      const mockSetSource = vi.fn()
      const mockBringNodeToFront = vi.fn()

      mockedUseLayoutMutations.mockReturnValue(
        fromPartial({
          setSource: mockSetSource,
          bringNodeToFront: mockBringNodeToFront
        })
      )

      const { bringNodeToFront } = useNodeZIndex({
        layoutSource: LayoutSource.External
      })

      bringNodeToFront(toNodeId('node4'), LayoutSource.Canvas)

      expect(mockSetSource).toHaveBeenCalledWith(LayoutSource.Canvas)
      expect(mockBringNodeToFront).toHaveBeenCalledWith(ROOT_GRAPH_ID, 'node4')
    })
  })
})
