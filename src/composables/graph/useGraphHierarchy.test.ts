import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import * as measure from '@/lib/litegraph/src/measure'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { useGraphHierarchy } from './useGraphHierarchy'

vi.mock('@/renderer/core/canvas/canvasStore')

describe('useGraphHierarchy', () => {
  let mockCanvasStore: ReturnType<typeof useCanvasStore>
  let mockNode: LGraphNode
  let mockGroups: LGraphGroup[]

  beforeEach(() => {
    mockNode = {
      boundingRect: [100, 100, 50, 50]
    } as unknown as LGraphNode

    mockGroups = []

    mockCanvasStore = {
      canvas: {
        graph: {
          groups: mockGroups
        }
      }
    } as unknown as ReturnType<typeof useCanvasStore>

    vi.mocked(useCanvasStore).mockReturnValue(mockCanvasStore)
  })

  describe('findParentGroup', () => {
    it('returns null when no groups exist', () => {
      const { findParentGroup } = useGraphHierarchy()

      const result = findParentGroup(mockNode)

      expect(result).toBeNull()
    })

    it('returns null when node is not in any group', () => {
      const group = {
        boundingRect: [0, 0, 50, 50]
      } as unknown as LGraphGroup
      mockGroups.push(group)

      vi.spyOn(measure, 'containsCentre').mockReturnValue(false)

      const { findParentGroup } = useGraphHierarchy()
      const result = findParentGroup(mockNode)

      expect(result).toBeNull()
    })

    it('returns the only group when node is in exactly one group', () => {
      const group = {
        boundingRect: [0, 0, 200, 200]
      } as unknown as LGraphGroup
      mockGroups.push(group)

      vi.spyOn(measure, 'containsCentre').mockReturnValue(true)

      const { findParentGroup } = useGraphHierarchy()
      const result = findParentGroup(mockNode)

      expect(result).toBe(group)
    })

    it('returns the smallest group when node is in multiple groups', () => {
      const largeGroup = {
        boundingRect: [0, 0, 300, 300]
      } as unknown as LGraphGroup
      const smallGroup = {
        boundingRect: [50, 50, 100, 100]
      } as unknown as LGraphGroup
      mockGroups.push(largeGroup, smallGroup)

      vi.spyOn(measure, 'containsCentre').mockReturnValue(true)
      vi.spyOn(measure, 'containsRect').mockReturnValue(false)

      const { findParentGroup } = useGraphHierarchy()
      const result = findParentGroup(mockNode)

      expect(result).toBe(smallGroup)
    })

    it('returns the inner group when one group contains another', () => {
      const outerGroup = {
        boundingRect: [0, 0, 300, 300]
      } as unknown as LGraphGroup
      const innerGroup = {
        boundingRect: [50, 50, 100, 100]
      } as unknown as LGraphGroup
      mockGroups.push(outerGroup, innerGroup)

      vi.spyOn(measure, 'containsCentre').mockReturnValue(true)
      vi.spyOn(measure, 'containsRect').mockImplementation(
        (container, contained) => {
          // outerGroup contains innerGroup
          if (container === outerGroup.boundingRect) {
            return contained === innerGroup.boundingRect
          }
          return false
        }
      )

      const { findParentGroup } = useGraphHierarchy()
      const result = findParentGroup(mockNode)

      expect(result).toBe(innerGroup)
    })

    it('handles null canvas gracefully', () => {
      mockCanvasStore.canvas = null

      const { findParentGroup } = useGraphHierarchy()
      const result = findParentGroup(mockNode)

      expect(result).toBeNull()
    })

    it('handles null graph gracefully', () => {
      mockCanvasStore.canvas!.graph = null

      const { findParentGroup } = useGraphHierarchy()
      const result = findParentGroup(mockNode)

      expect(result).toBeNull()
    })
  })
})
