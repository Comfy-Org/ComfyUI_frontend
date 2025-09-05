import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpatialIndex } from '@/composables/graph/useSpatialIndex'

// Mock @vueuse/core
vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: any[]) => any) => fn // Return function directly for testing
}))

describe('useSpatialIndex', () => {
  let spatialIndex: ReturnType<typeof useSpatialIndex>

  beforeEach(() => {
    spatialIndex = useSpatialIndex()
  })

  describe('initialization', () => {
    it('should start with null quadTree', () => {
      expect(spatialIndex.quadTree.value).toBeNull()
    })

    it('should initialize with default bounds when first node is added', () => {
      const { updateNode, quadTree, metrics } = spatialIndex

      updateNode('node1', { x: 100, y: 100 }, { width: 200, height: 100 })

      expect(quadTree.value).not.toBeNull()
      expect(metrics.value.totalNodes).toBe(1)
    })

    it('should initialize with custom bounds', () => {
      const { initialize, quadTree } = spatialIndex
      const customBounds = { x: 0, y: 0, width: 5000, height: 3000 }

      initialize(customBounds)

      expect(quadTree.value).not.toBeNull()
    })

    it('should increment rebuild count on initialization', () => {
      const { initialize, metrics } = spatialIndex

      expect(metrics.value.rebuildCount).toBe(0)
      initialize()
      expect(metrics.value.rebuildCount).toBe(1)
    })

    it('should accept custom options', () => {
      const customIndex = useSpatialIndex({
        maxDepth: 8,
        maxItemsPerNode: 6,
        updateDebounceMs: 32
      })

      customIndex.initialize()

      expect(customIndex.quadTree.value).not.toBeNull()
    })
  })

  describe('updateNode', () => {
    it('should add a new node to the index', () => {
      const { updateNode, metrics } = spatialIndex

      updateNode('node1', { x: 100, y: 100 }, { width: 200, height: 100 })

      expect(metrics.value.totalNodes).toBe(1)
    })

    it('should update existing node position', () => {
      const { updateNode, queryViewport } = spatialIndex

      // Add node
      updateNode('node1', { x: 100, y: 100 }, { width: 200, height: 100 })

      // Move node
      updateNode('node1', { x: 500, y: 500 }, { width: 200, height: 100 })

      // Query old position - should not find node
      const oldResults = queryViewport({
        x: 50,
        y: 50,
        width: 300,
        height: 200
      })
      expect(oldResults).not.toContain('node1')

      // Query new position - should find node
      const newResults = queryViewport({
        x: 450,
        y: 450,
        width: 300,
        height: 200
      })
      expect(newResults).toContain('node1')
    })

    it('should auto-initialize if quadTree is null', () => {
      const { updateNode, quadTree } = spatialIndex

      expect(quadTree.value).toBeNull()
      updateNode('node1', { x: 0, y: 0 }, { width: 100, height: 100 })
      expect(quadTree.value).not.toBeNull()
    })
  })

  describe('batchUpdate', () => {
    it('should update multiple nodes at once', () => {
      const { batchUpdate, metrics } = spatialIndex

      const updates = [
        {
          id: 'node1',
          position: { x: 100, y: 100 },
          size: { width: 200, height: 100 }
        },
        {
          id: 'node2',
          position: { x: 300, y: 300 },
          size: { width: 150, height: 150 }
        },
        {
          id: 'node3',
          position: { x: 500, y: 200 },
          size: { width: 100, height: 200 }
        }
      ]

      batchUpdate(updates)

      expect(metrics.value.totalNodes).toBe(3)
    })

    it('should handle empty batch', () => {
      const { batchUpdate, metrics } = spatialIndex

      batchUpdate([])

      expect(metrics.value.totalNodes).toBe(0)
    })

    it('should auto-initialize if needed', () => {
      const { batchUpdate, quadTree } = spatialIndex

      expect(quadTree.value).toBeNull()
      batchUpdate([
        {
          id: 'node1',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 }
        }
      ])
      expect(quadTree.value).not.toBeNull()
    })
  })

  describe('removeNode', () => {
    beforeEach(() => {
      spatialIndex.updateNode(
        'node1',
        { x: 100, y: 100 },
        { width: 200, height: 100 }
      )
      spatialIndex.updateNode(
        'node2',
        { x: 300, y: 300 },
        { width: 200, height: 100 }
      )
    })

    it('should remove node from index', () => {
      const { removeNode, metrics } = spatialIndex

      expect(metrics.value.totalNodes).toBe(2)
      removeNode('node1')
      expect(metrics.value.totalNodes).toBe(1)
    })

    it('should handle removing non-existent node', () => {
      const { removeNode, metrics } = spatialIndex

      expect(metrics.value.totalNodes).toBe(2)
      removeNode('node999')
      expect(metrics.value.totalNodes).toBe(2)
    })

    it('should handle removeNode when quadTree is null', () => {
      const freshIndex = useSpatialIndex()

      // Should not throw
      expect(() => freshIndex.removeNode('node1')).not.toThrow()
    })
  })

  describe('queryViewport', () => {
    beforeEach(() => {
      // Set up a grid of nodes
      spatialIndex.updateNode(
        'node1',
        { x: 0, y: 0 },
        { width: 100, height: 100 }
      )
      spatialIndex.updateNode(
        'node2',
        { x: 200, y: 0 },
        { width: 100, height: 100 }
      )
      spatialIndex.updateNode(
        'node3',
        { x: 0, y: 200 },
        { width: 100, height: 100 }
      )
      spatialIndex.updateNode(
        'node4',
        { x: 200, y: 200 },
        { width: 100, height: 100 }
      )
    })

    it('should find nodes within viewport bounds', () => {
      const { queryViewport } = spatialIndex

      // Query top-left quadrant
      const results = queryViewport({ x: -50, y: -50, width: 200, height: 200 })
      expect(results).toContain('node1')
      expect(results).not.toContain('node2')
      expect(results).not.toContain('node3')
      expect(results).not.toContain('node4')
    })

    it('should find multiple nodes in larger viewport', () => {
      const { queryViewport } = spatialIndex

      // Query entire area
      const results = queryViewport({ x: -50, y: -50, width: 400, height: 400 })
      expect(results).toHaveLength(4)
      expect(results).toContain('node1')
      expect(results).toContain('node2')
      expect(results).toContain('node3')
      expect(results).toContain('node4')
    })

    it('should return empty array for empty region', () => {
      const { queryViewport } = spatialIndex

      const results = queryViewport({
        x: 1000,
        y: 1000,
        width: 100,
        height: 100
      })
      expect(results).toEqual([])
    })

    it('should update metrics after query', () => {
      const { queryViewport, metrics } = spatialIndex

      queryViewport({ x: 0, y: 0, width: 300, height: 300 })

      expect(metrics.value.queryTime).toBeGreaterThan(0)
      expect(metrics.value.visibleNodes).toBe(4)
    })

    it('should handle query when quadTree is null', () => {
      const freshIndex = useSpatialIndex()

      const results = freshIndex.queryViewport({
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })
      expect(results).toEqual([])
    })
  })

  describe('queryRadius', () => {
    beforeEach(() => {
      // Set up nodes at different distances
      spatialIndex.updateNode(
        'center',
        { x: 475, y: 475 },
        { width: 50, height: 50 }
      )
      spatialIndex.updateNode(
        'near1',
        { x: 525, y: 475 },
        { width: 50, height: 50 }
      )
      spatialIndex.updateNode(
        'near2',
        { x: 425, y: 475 },
        { width: 50, height: 50 }
      )
      spatialIndex.updateNode(
        'far',
        { x: 775, y: 775 },
        { width: 50, height: 50 }
      )
    })

    it('should find nodes within radius', () => {
      const { queryRadius } = spatialIndex

      const results = queryRadius({ x: 500, y: 500 }, 100)

      expect(results).toContain('center')
      expect(results).toContain('near1')
      expect(results).toContain('near2')
      expect(results).not.toContain('far')
    })

    it('should handle zero radius', () => {
      const { queryRadius } = spatialIndex

      const results = queryRadius({ x: 500, y: 500 }, 0)

      // Zero radius creates a point query at (500,500)
      // The 'center' node spans 475-525 on both axes, so it contains this point
      expect(results).toContain('center')
    })

    it('should handle large radius', () => {
      const { queryRadius } = spatialIndex

      const results = queryRadius({ x: 500, y: 500 }, 1000)

      expect(results).toHaveLength(4) // Should find all nodes
    })
  })

  describe('clear', () => {
    beforeEach(() => {
      spatialIndex.updateNode(
        'node1',
        { x: 100, y: 100 },
        { width: 200, height: 100 }
      )
      spatialIndex.updateNode(
        'node2',
        { x: 300, y: 300 },
        { width: 200, height: 100 }
      )
    })

    it('should remove all nodes', () => {
      const { clear, metrics } = spatialIndex

      expect(metrics.value.totalNodes).toBe(2)
      clear()
      expect(metrics.value.totalNodes).toBe(0)
    })

    it('should reset metrics', () => {
      const { clear, queryViewport, metrics } = spatialIndex

      // Do a query to set visible nodes
      queryViewport({ x: 0, y: 0, width: 500, height: 500 })
      expect(metrics.value.visibleNodes).toBe(2)

      clear()
      expect(metrics.value.visibleNodes).toBe(0)
    })

    it('should handle clear when quadTree is null', () => {
      const freshIndex = useSpatialIndex()

      expect(() => freshIndex.clear()).not.toThrow()
    })
  })

  describe('rebuild', () => {
    it('should rebuild index with new nodes', () => {
      const { rebuild, metrics, queryViewport } = spatialIndex

      // Add initial nodes
      spatialIndex.updateNode(
        'old1',
        { x: 0, y: 0 },
        { width: 100, height: 100 }
      )
      expect(metrics.value.rebuildCount).toBe(1)

      // Rebuild with new set
      const newNodes = new Map([
        [
          'new1',
          { position: { x: 100, y: 100 }, size: { width: 50, height: 50 } }
        ],
        [
          'new2',
          { position: { x: 200, y: 200 }, size: { width: 50, height: 50 } }
        ]
      ])

      rebuild(newNodes)

      expect(metrics.value.totalNodes).toBe(2)
      expect(metrics.value.rebuildCount).toBe(2)

      // Old nodes should be gone
      const oldResults = queryViewport({
        x: -50,
        y: -50,
        width: 100,
        height: 100
      })
      expect(oldResults).not.toContain('old1')

      // New nodes should be findable
      const newResults = queryViewport({
        x: 50,
        y: 50,
        width: 200,
        height: 200
      })
      expect(newResults).toContain('new1')
      expect(newResults).toContain('new2')
    })

    it('should handle empty rebuild', () => {
      const { rebuild, metrics } = spatialIndex

      rebuild(new Map())

      expect(metrics.value.totalNodes).toBe(0)
    })
  })

  describe('metrics', () => {
    it('should track performance metrics', () => {
      const { metrics, updateNode, queryViewport } = spatialIndex

      // Initial state
      expect(metrics.value).toEqual({
        queryTime: 0,
        totalNodes: 0,
        visibleNodes: 0,
        treeDepth: 0,
        rebuildCount: 0
      })

      // Add nodes
      updateNode('node1', { x: 0, y: 0 }, { width: 100, height: 100 })
      expect(metrics.value.totalNodes).toBe(1)

      // Query
      queryViewport({ x: -50, y: -50, width: 200, height: 200 })
      expect(metrics.value.queryTime).toBeGreaterThan(0)
      expect(metrics.value.visibleNodes).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('should handle nodes with zero size', () => {
      const { updateNode, queryViewport } = spatialIndex

      updateNode('point', { x: 100, y: 100 }, { width: 0, height: 0 })

      // Should still be findable
      const results = queryViewport({ x: 50, y: 50, width: 100, height: 100 })
      expect(results).toContain('point')
    })

    it('should handle negative positions', () => {
      const { updateNode, queryViewport } = spatialIndex

      updateNode('negative', { x: -500, y: -500 }, { width: 100, height: 100 })

      const results = queryViewport({
        x: -600,
        y: -600,
        width: 200,
        height: 200
      })
      expect(results).toContain('negative')
    })

    it('should handle very large nodes', () => {
      const { updateNode, queryViewport } = spatialIndex

      updateNode('huge', { x: 0, y: 0 }, { width: 5000, height: 5000 })

      // Should be found even when querying small area within it
      const results = queryViewport({ x: 100, y: 100, width: 10, height: 10 })
      expect(results).toContain('huge')
    })
  })

  describe('debouncedUpdateNode', () => {
    it('should be available', () => {
      const { debouncedUpdateNode } = spatialIndex

      expect(debouncedUpdateNode).toBeDefined()
      expect(typeof debouncedUpdateNode).toBe('function')
    })
  })
})
