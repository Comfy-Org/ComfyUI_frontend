/**
 * Performance benchmark for QuadTree vs linear culling
 * Measures query performance at different node counts and zoom levels
 */
import { type Bounds, QuadTree } from '../../../src/utils/spatial/QuadTree'

export interface BenchmarkResult {
  nodeCount: number
  queryCount: number
  linearTime: number
  quadTreeTime: number
  speedup: number
  culledPercentage: number
}

export interface NodeData {
  id: string
  bounds: Bounds
}

export class QuadTreeBenchmark {
  private worldBounds: Bounds = {
    x: -5000,
    y: -5000,
    width: 10000,
    height: 10000
  }

  // Generate random nodes with realistic clustering
  generateNodes(count: number): NodeData[] {
    const nodes: NodeData[] = []

    for (let i = 0; i < count; i++) {
      // 70% clustered, 30% scattered
      const isClustered = Math.random() < 0.7

      let x: number, y: number

      if (isClustered) {
        // Pick a cluster center
        const clusterX = (Math.random() - 0.5) * 8000
        const clusterY = (Math.random() - 0.5) * 8000

        // Add node near cluster with gaussian distribution
        x = clusterX + (Math.random() - 0.5) * 500
        y = clusterY + (Math.random() - 0.5) * 500
      } else {
        // Scattered randomly
        x = (Math.random() - 0.5) * 9000
        y = (Math.random() - 0.5) * 9000
      }

      nodes.push({
        id: `node_${i}`,
        bounds: {
          x,
          y,
          width: 200 + Math.random() * 100,
          height: 100 + Math.random() * 50
        }
      })
    }

    return nodes
  }

  // Linear viewport culling (baseline)
  linearCulling(nodes: NodeData[], viewport: Bounds): string[] {
    const visible: string[] = []

    for (const node of nodes) {
      if (this.boundsIntersect(node.bounds, viewport)) {
        visible.push(node.id)
      }
    }

    return visible
  }

  // QuadTree viewport culling
  quadTreeCulling(quadTree: QuadTree<string>, viewport: Bounds): string[] {
    return quadTree.query(viewport)
  }

  // Check if two bounds intersect
  private boundsIntersect(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }

  // Run benchmark for specific configuration
  runBenchmark(
    nodeCount: number,
    viewportSize: { width: number; height: number },
    queryCount: number = 100
  ): BenchmarkResult {
    // Generate nodes
    const nodes = this.generateNodes(nodeCount)

    // Build QuadTree
    const quadTree = new QuadTree<string>(this.worldBounds, {
      maxDepth: Math.ceil(Math.log2(nodeCount / 4)),
      maxItemsPerNode: 4
    })

    for (const node of nodes) {
      quadTree.insert(node.id, node.bounds, node.id)
    }

    // Generate random viewports for testing
    const viewports: Bounds[] = []
    for (let i = 0; i < queryCount; i++) {
      const x =
        (Math.random() - 0.5) * (this.worldBounds.width - viewportSize.width)
      const y =
        (Math.random() - 0.5) * (this.worldBounds.height - viewportSize.height)
      viewports.push({
        x,
        y,
        width: viewportSize.width,
        height: viewportSize.height
      })
    }

    // Benchmark linear culling
    const linearStart = performance.now()
    let linearVisibleTotal = 0
    for (const viewport of viewports) {
      const visible = this.linearCulling(nodes, viewport)
      linearVisibleTotal += visible.length
    }
    const linearTime = performance.now() - linearStart

    // Benchmark QuadTree culling
    const quadTreeStart = performance.now()
    let quadTreeVisibleTotal = 0
    for (const viewport of viewports) {
      const visible = this.quadTreeCulling(quadTree, viewport)
      quadTreeVisibleTotal += visible.length
    }
    const quadTreeTime = performance.now() - quadTreeStart

    // Calculate metrics
    const avgVisible = linearVisibleTotal / queryCount
    const culledPercentage = ((nodeCount - avgVisible) / nodeCount) * 100

    return {
      nodeCount,
      queryCount,
      linearTime,
      quadTreeTime,
      speedup: linearTime / quadTreeTime,
      culledPercentage
    }
  }

  // Run comprehensive benchmark suite
  runBenchmarkSuite(): BenchmarkResult[] {
    const nodeCounts = [50, 100, 200, 500, 1000, 2000, 5000]
    const viewportSizes = [
      { width: 1920, height: 1080 }, // Full HD
      { width: 800, height: 600 }, // Zoomed in
      { width: 4000, height: 3000 } // Zoomed out
    ]

    const results: BenchmarkResult[] = []

    for (const nodeCount of nodeCounts) {
      for (const viewportSize of viewportSizes) {
        const result = this.runBenchmark(nodeCount, viewportSize)
        results.push(result)

        console.log(
          `Nodes: ${nodeCount}, ` +
            `Viewport: ${viewportSize.width}x${viewportSize.height}, ` +
            `Linear: ${result.linearTime.toFixed(2)}ms, ` +
            `QuadTree: ${result.quadTreeTime.toFixed(2)}ms, ` +
            `Speedup: ${result.speedup.toFixed(2)}x, ` +
            `Culled: ${result.culledPercentage.toFixed(1)}%`
        )
      }
    }

    return results
  }

  // Find optimal maxDepth for given node count
  findOptimalDepth(nodeCount: number): number {
    const nodes = this.generateNodes(nodeCount)
    const viewport = { x: 0, y: 0, width: 1920, height: 1080 }

    let bestDepth = 1
    let bestTime = Infinity

    for (let depth = 1; depth <= 10; depth++) {
      const quadTree = new QuadTree<string>(this.worldBounds, {
        maxDepth: depth,
        maxItemsPerNode: 4
      })

      // Build tree
      for (const node of nodes) {
        quadTree.insert(node.id, node.bounds, node.id)
      }

      // Measure query time
      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        quadTree.query(viewport)
      }
      const time = performance.now() - start

      if (time < bestTime) {
        bestTime = time
        bestDepth = depth
      }
    }

    return bestDepth
  }
}
