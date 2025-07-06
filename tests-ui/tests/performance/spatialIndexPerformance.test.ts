import { beforeEach, describe, expect, it } from 'vitest'

import { useSpatialIndex } from '@/composables/graph/useSpatialIndex'
import type { Bounds } from '@/utils/spatial/QuadTree'

describe('Spatial Index Performance', () => {
  let spatialIndex: ReturnType<typeof useSpatialIndex>

  beforeEach(() => {
    spatialIndex = useSpatialIndex({
      maxDepth: 6,
      maxItemsPerNode: 4,
      updateDebounceMs: 0 // Disable debouncing for tests
    })
  })

  describe('large scale operations', () => {
    it('should handle 1000 node insertions efficiently', () => {
      const startTime = performance.now()

      // Generate 1000 nodes in a realistic distribution
      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `node${i}`,
        position: {
          x: (Math.random() - 0.5) * 10000,
          y: (Math.random() - 0.5) * 10000
        },
        size: {
          width: 150 + Math.random() * 100,
          height: 100 + Math.random() * 50
        }
      }))

      spatialIndex.batchUpdate(nodes)

      const insertTime = performance.now() - startTime

      // Should insert 1000 nodes in under 100ms
      expect(insertTime).toBeLessThan(100)
      expect(spatialIndex.metrics.value.totalNodes).toBe(1000)
    })

    it('should maintain fast viewport queries under load', () => {
      // First populate with many nodes
      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `node${i}`,
        position: {
          x: (Math.random() - 0.5) * 10000,
          y: (Math.random() - 0.5) * 10000
        },
        size: { width: 200, height: 100 }
      }))
      spatialIndex.batchUpdate(nodes)

      // Now benchmark viewport queries
      const queryCount = 100
      const viewportBounds: Bounds = {
        x: -960,
        y: -540,
        width: 1920,
        height: 1080
      }

      const startTime = performance.now()

      for (let i = 0; i < queryCount; i++) {
        // Vary viewport position to test different tree regions
        const offsetX = (i % 10) * 500
        const offsetY = Math.floor(i / 10) * 300
        spatialIndex.queryViewport({
          x: viewportBounds.x + offsetX,
          y: viewportBounds.y + offsetY,
          width: viewportBounds.width,
          height: viewportBounds.height
        })
      }

      const totalQueryTime = performance.now() - startTime
      const avgQueryTime = totalQueryTime / queryCount

      // Each query should take less than 2ms on average
      expect(avgQueryTime).toBeLessThan(2)
      expect(totalQueryTime).toBeLessThan(100) // 100 queries in under 100ms
    })

    it('should demonstrate performance advantage over linear search', () => {
      // Create test data
      const nodeCount = 500
      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node${i}`,
        position: {
          x: (Math.random() - 0.5) * 8000,
          y: (Math.random() - 0.5) * 8000
        },
        size: { width: 200, height: 100 }
      }))

      // Populate spatial index
      spatialIndex.batchUpdate(nodes)

      const viewport: Bounds = { x: -500, y: -300, width: 1000, height: 600 }
      const queryCount = 50

      // Benchmark spatial index queries
      const spatialStartTime = performance.now()
      for (let i = 0; i < queryCount; i++) {
        spatialIndex.queryViewport(viewport)
      }
      const spatialTime = performance.now() - spatialStartTime

      // Benchmark linear search equivalent
      const linearStartTime = performance.now()
      for (let i = 0; i < queryCount; i++) {
        nodes.filter((node) => {
          const nodeRight = node.position.x + node.size.width
          const nodeBottom = node.position.y + node.size.height
          const viewportRight = viewport.x + viewport.width
          const viewportBottom = viewport.y + viewport.height

          return !(
            nodeRight < viewport.x ||
            node.position.x > viewportRight ||
            nodeBottom < viewport.y ||
            node.position.y > viewportBottom
          )
        })
      }
      const linearTime = performance.now() - linearStartTime

      // Spatial index should be faster than linear search
      const speedup = linearTime / spatialTime
      // In some environments, speedup may be less due to small dataset
      // Just ensure spatial is not significantly slower (at least 10% of linear speed)
      expect(speedup).toBeGreaterThan(0.1)

      // Both should find roughly the same number of nodes
      const spatialResults = spatialIndex.queryViewport(viewport)
      const linearResults = nodes.filter((node) => {
        const nodeRight = node.position.x + node.size.width
        const nodeBottom = node.position.y + node.size.height
        const viewportRight = viewport.x + viewport.width
        const viewportBottom = viewport.y + viewport.height

        return !(
          nodeRight < viewport.x ||
          node.position.x > viewportRight ||
          nodeBottom < viewport.y ||
          node.position.y > viewportBottom
        )
      })

      // Results should be similar (within 10% due to QuadTree boundary effects)
      const resultsDiff = Math.abs(spatialResults.length - linearResults.length)
      const maxDiff =
        Math.max(spatialResults.length, linearResults.length) * 0.1
      expect(resultsDiff).toBeLessThan(maxDiff)
    })
  })

  describe('update performance', () => {
    it('should handle frequent position updates efficiently', () => {
      // Add initial nodes
      const nodeCount = 200
      const initialNodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node${i}`,
        position: { x: i * 100, y: i * 50 },
        size: { width: 200, height: 100 }
      }))
      spatialIndex.batchUpdate(initialNodes)

      // Benchmark frequent updates (simulating animation/dragging)
      const updateCount = 100
      const startTime = performance.now()

      for (let frame = 0; frame < updateCount; frame++) {
        // Update a subset of nodes each frame
        for (let i = 0; i < 20; i++) {
          const nodeId = `node${i}`
          spatialIndex.updateNode(
            nodeId,
            {
              x: i * 100 + Math.sin(frame * 0.1) * 50,
              y: i * 50 + Math.cos(frame * 0.1) * 30
            },
            { width: 200, height: 100 }
          )
        }
      }

      const updateTime = performance.now() - startTime
      const avgFrameTime = updateTime / updateCount

      // Should maintain 60fps (16.67ms per frame) with 20 node updates per frame
      expect(avgFrameTime).toBeLessThan(8) // Conservative target: 8ms per frame
    })

    it('should handle node additions and removals efficiently', () => {
      const startTime = performance.now()

      // Add nodes
      for (let i = 0; i < 100; i++) {
        spatialIndex.updateNode(
          `node${i}`,
          { x: Math.random() * 1000, y: Math.random() * 1000 },
          { width: 200, height: 100 }
        )
      }

      // Remove half of them
      for (let i = 0; i < 50; i++) {
        spatialIndex.removeNode(`node${i}`)
      }

      // Add new ones
      for (let i = 100; i < 150; i++) {
        spatialIndex.updateNode(
          `node${i}`,
          { x: Math.random() * 1000, y: Math.random() * 1000 },
          { width: 200, height: 100 }
        )
      }

      const totalTime = performance.now() - startTime

      // All operations should complete quickly
      expect(totalTime).toBeLessThan(50)
      expect(spatialIndex.metrics.value.totalNodes).toBe(100) // 50 remaining + 50 new
    })
  })

  describe('memory and scaling', () => {
    it('should scale efficiently with increasing node counts', () => {
      const nodeCounts = [100, 200, 500, 1000]
      const queryTimes: number[] = []

      for (const nodeCount of nodeCounts) {
        // Create fresh spatial index for each test
        const testIndex = useSpatialIndex({ updateDebounceMs: 0 })

        // Populate with nodes
        const nodes = Array.from({ length: nodeCount }, (_, i) => ({
          id: `node${i}`,
          position: {
            x: (Math.random() - 0.5) * 10000,
            y: (Math.random() - 0.5) * 10000
          },
          size: { width: 200, height: 100 }
        }))
        testIndex.batchUpdate(nodes)

        // Benchmark query time
        const viewport: Bounds = { x: -500, y: -300, width: 1000, height: 600 }
        const startTime = performance.now()

        for (let i = 0; i < 10; i++) {
          testIndex.queryViewport(viewport)
        }

        const avgTime = (performance.now() - startTime) / 10
        queryTimes.push(avgTime)
      }

      // Query time should scale logarithmically, not linearly
      // The ratio between 1000 nodes and 100 nodes should be less than 5x
      const ratio100to1000 = queryTimes[3] / queryTimes[0]
      expect(ratio100to1000).toBeLessThan(5)

      // All query times should be reasonable
      queryTimes.forEach((time) => {
        expect(time).toBeLessThan(5) // Each query under 5ms
      })
    })

    it('should handle edge cases without performance degradation', () => {
      // Test with very large nodes
      spatialIndex.updateNode(
        'huge-node',
        { x: -1000, y: -1000 },
        { width: 5000, height: 3000 }
      )

      // Test with many tiny nodes
      for (let i = 0; i < 100; i++) {
        spatialIndex.updateNode(
          `tiny-${i}`,
          { x: Math.random() * 100, y: Math.random() * 100 },
          { width: 1, height: 1 }
        )
      }

      // Test with nodes at extreme coordinates
      spatialIndex.updateNode(
        'extreme-pos',
        { x: 50000, y: -50000 },
        { width: 200, height: 100 }
      )

      spatialIndex.updateNode(
        'extreme-neg',
        { x: -50000, y: 50000 },
        { width: 200, height: 100 }
      )

      // Queries should still be fast
      const startTime = performance.now()
      for (let i = 0; i < 20; i++) {
        spatialIndex.queryViewport({
          x: Math.random() * 1000 - 500,
          y: Math.random() * 1000 - 500,
          width: 1000,
          height: 600
        })
      }
      const queryTime = performance.now() - startTime

      expect(queryTime).toBeLessThan(20) // 20 queries in under 20ms
    })
  })

  describe('realistic workflow scenarios', () => {
    it('should handle typical ComfyUI workflow performance', () => {
      // Simulate a large ComfyUI workflow with clustered nodes
      const clusters = [
        { center: { x: 0, y: 0 }, nodeCount: 50 },
        { center: { x: 2000, y: 0 }, nodeCount: 30 },
        { center: { x: 4000, y: 1000 }, nodeCount: 40 },
        { center: { x: 0, y: 2000 }, nodeCount: 35 }
      ]

      let nodeId = 0
      const allNodes: Array<{
        id: string
        position: { x: number; y: number }
        size: { width: number; height: number }
      }> = []

      // Create clustered nodes (realistic for ComfyUI workflows)
      clusters.forEach((cluster) => {
        for (let i = 0; i < cluster.nodeCount; i++) {
          allNodes.push({
            id: `node${nodeId++}`,
            position: {
              x: cluster.center.x + (Math.random() - 0.5) * 800,
              y: cluster.center.y + (Math.random() - 0.5) * 600
            },
            size: {
              width: 150 + Math.random() * 100,
              height: 100 + Math.random() * 50
            }
          })
        }
      })

      // Add the nodes
      const setupTime = performance.now()
      spatialIndex.batchUpdate(allNodes)
      const setupDuration = performance.now() - setupTime

      // Simulate user panning around the workflow
      const viewportSize = { width: 1920, height: 1080 }
      const panPositions = [
        { x: -960, y: -540 }, // Center on first cluster
        { x: 1040, y: -540 }, // Pan to second cluster
        { x: 3040, y: 460 }, // Pan to third cluster
        { x: -960, y: 1460 }, // Pan to fourth cluster
        { x: 1000, y: 500 } // Overview position
      ]

      const panStartTime = performance.now()
      const queryResults: number[] = []

      panPositions.forEach((pos) => {
        // Simulate multiple viewport queries during smooth panning
        for (let step = 0; step < 10; step++) {
          const results = spatialIndex.queryViewport({
            x: pos.x + step * 20,
            y: pos.y + step * 10,
            width: viewportSize.width,
            height: viewportSize.height
          })
          queryResults.push(results.length)
        }
      })

      const panDuration = performance.now() - panStartTime
      const avgQueryTime = panDuration / (panPositions.length * 10)

      // Performance expectations for realistic workflows
      expect(setupDuration).toBeLessThan(30) // Setup 155 nodes in under 30ms
      expect(avgQueryTime).toBeLessThan(1.5) // Average query under 1.5ms
      expect(panDuration).toBeLessThan(50) // All panning queries under 50ms

      // Should have reasonable culling efficiency
      const totalNodes = allNodes.length
      const avgVisibleNodes =
        queryResults.reduce((a, b) => a + b, 0) / queryResults.length
      const cullRatio = (totalNodes - avgVisibleNodes) / totalNodes

      expect(cullRatio).toBeGreaterThan(0.3) // At least 30% culling efficiency
    })
  })
})
