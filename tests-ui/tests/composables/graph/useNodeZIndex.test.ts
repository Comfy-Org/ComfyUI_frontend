import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeZIndex } from '@/composables/graph/useNodeZIndex'
import { LayoutSource } from '@/renderer/core/layout/types'

// Mock the layout mutations module
const mockLayoutMutations = {
  setSource: vi.fn(),
  bringNodeToFront: vi.fn()
}

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => mockLayoutMutations
}))

describe('useNodeZIndex', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('bringNodeToFront', () => {
    it('should bring node to front with default source', () => {
      const { bringNodeToFront } = useNodeZIndex()

      bringNodeToFront('node1')

      expect(mockLayoutMutations.setSource).toHaveBeenCalledWith(
        LayoutSource.Vue
      )
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith('node1')
    })

    it('should bring node to front with custom source', () => {
      const { bringNodeToFront } = useNodeZIndex()

      bringNodeToFront('node2', LayoutSource.Canvas)

      expect(mockLayoutMutations.setSource).toHaveBeenCalledWith(
        LayoutSource.Canvas
      )
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith('node2')
    })

    it('should use custom default source from options', () => {
      const { bringNodeToFront } = useNodeZIndex({
        defaultSource: LayoutSource.External
      })

      bringNodeToFront('node3')

      expect(mockLayoutMutations.setSource).toHaveBeenCalledWith(
        LayoutSource.External
      )
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith('node3')
    })

    it('should override default source with explicit source parameter', () => {
      const { bringNodeToFront } = useNodeZIndex({
        defaultSource: LayoutSource.External
      })

      bringNodeToFront('node4', LayoutSource.Canvas)

      expect(mockLayoutMutations.setSource).toHaveBeenCalledWith(
        LayoutSource.Canvas
      )
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith('node4')
    })
  })
})
