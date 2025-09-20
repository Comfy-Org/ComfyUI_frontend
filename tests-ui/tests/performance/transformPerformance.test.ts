import { beforeEach, describe, expect, it } from 'vitest'

import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

// Mock canvas context for testing
const createMockCanvasContext = () => ({
  ds: {
    offset: [0, 0] as [number, number],
    scale: 1
  }
})

// Skip this entire suite on CI to avoid flaky performance timing
const isCI = Boolean(process.env.CI)
const describeIfNotCI = isCI ? describe.skip : describe

describeIfNotCI.skip('Transform Performance', () => {
  let transformState: ReturnType<typeof useTransformState>
  let mockCanvas: any

  beforeEach(() => {
    transformState = useTransformState()
    mockCanvas = createMockCanvasContext()
  })

  describe('coordinate conversion performance', () => {
    it('should handle large batches of coordinate conversions efficiently', () => {
      // Set up a realistic transform state
      mockCanvas.ds.offset = [500, 300]
      mockCanvas.ds.scale = 1.5
      transformState.syncWithCanvas(mockCanvas)

      const conversionCount = 10000
      const points = Array.from({ length: conversionCount }, () => ({
        x: Math.random() * 5000,
        y: Math.random() * 3000
      }))

      // Benchmark canvas to screen conversions
      const canvasToScreenStart = performance.now()
      const screenPoints = points.map((point) =>
        transformState.canvasToScreen(point)
      )
      const canvasToScreenTime = performance.now() - canvasToScreenStart

      // Benchmark screen to canvas conversions
      const screenToCanvasStart = performance.now()
      const backToCanvas = screenPoints.map((point) =>
        transformState.screenToCanvas(point)
      )
      const screenToCanvasTime = performance.now() - screenToCanvasStart

      // Performance expectations
      expect(canvasToScreenTime).toBeLessThan(20) // 10k conversions in under 20ms
      expect(screenToCanvasTime).toBeLessThan(20) // 10k conversions in under 20ms

      // Verify accuracy of round-trip conversion
      const maxError = points.reduce((max, original, i) => {
        const converted = backToCanvas[i]
        const errorX = Math.abs(original.x - converted.x)
        const errorY = Math.abs(original.y - converted.y)
        return Math.max(max, errorX, errorY)
      }, 0)

      expect(maxError).toBeLessThan(0.001) // Sub-pixel accuracy
    })

    it('should maintain performance across different zoom levels', () => {
      const zoomLevels = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
      const conversionCount = 1000
      const testPoints = Array.from({ length: conversionCount }, () => ({
        x: Math.random() * 2000,
        y: Math.random() * 1500
      }))

      const performanceResults: number[] = []

      zoomLevels.forEach((scale) => {
        mockCanvas.ds.scale = scale
        transformState.syncWithCanvas(mockCanvas)

        const startTime = performance.now()
        testPoints.forEach((point) => {
          const screen = transformState.canvasToScreen(point)
          transformState.screenToCanvas(screen)
        })
        const duration = performance.now() - startTime

        performanceResults.push(duration)
      })

      // Performance should be consistent across zoom levels
      const maxTime = Math.max(...performanceResults)
      const minTime = Math.min(...performanceResults)
      const variance = (maxTime - minTime) / minTime

      expect(maxTime).toBeLessThan(20) // All zoom levels under 20ms
      expect(variance).toBeLessThan(3.0) // Less than 300% variance between zoom levels
    })

    it('should handle extreme coordinate values efficiently', () => {
      // Test with very large coordinate values
      const extremePoints = [
        { x: -100000, y: -100000 },
        { x: 100000, y: 100000 },
        { x: 0, y: 0 },
        { x: -50000, y: 50000 },
        { x: 1e6, y: -1e6 }
      ]

      // Test at extreme zoom levels
      const extremeScales = [0.001, 1000]

      extremeScales.forEach((scale) => {
        mockCanvas.ds.scale = scale
        mockCanvas.ds.offset = [1000, 500]
        transformState.syncWithCanvas(mockCanvas)

        const startTime = performance.now()

        // Convert each point 100 times
        extremePoints.forEach((point) => {
          for (let i = 0; i < 100; i++) {
            const screen = transformState.canvasToScreen(point)
            transformState.screenToCanvas(screen)
          }
        })

        const duration = performance.now() - startTime

        expect(duration).toBeLessThan(5) // Should handle extremes efficiently
        expect(
          Number.isFinite(transformState.canvasToScreen(extremePoints[0]).x)
        ).toBe(true)
        expect(
          Number.isFinite(transformState.canvasToScreen(extremePoints[0]).y)
        ).toBe(true)
      })
    })
  })

  describe('viewport culling performance', () => {
    it('should efficiently determine node visibility for large numbers of nodes', () => {
      // Set up realistic viewport
      const viewport = { width: 1920, height: 1080 }

      // Generate many node positions
      const nodeCount = 1000
      const nodes = Array.from({ length: nodeCount }, () => ({
        pos: [Math.random() * 10000, Math.random() * 6000] as ArrayLike<number>,
        size: [
          150 + Math.random() * 100,
          100 + Math.random() * 50
        ] as ArrayLike<number>
      }))

      // Test at different zoom levels and positions
      const testConfigs = [
        { scale: 0.5, offset: [0, 0] },
        { scale: 1.0, offset: [2000, 1000] },
        { scale: 2.0, offset: [-1000, -500] }
      ]

      testConfigs.forEach((config) => {
        mockCanvas.ds.scale = config.scale
        mockCanvas.ds.offset = config.offset
        transformState.syncWithCanvas(mockCanvas)

        const startTime = performance.now()

        // Test viewport culling for all nodes
        const visibleNodes = nodes.filter((node) =>
          transformState.isNodeInViewport(node.pos, node.size, viewport)
        )

        const cullTime = performance.now() - startTime

        expect(cullTime).toBeLessThan(10) // 1000 nodes culled in under 10ms
        expect(visibleNodes.length).toBeLessThan(nodeCount) // Some culling should occur
        expect(visibleNodes.length).toBeGreaterThanOrEqual(0) // Sanity check
      })
    })

    it('should optimize culling with adaptive margins', () => {
      const viewport = { width: 1280, height: 720 }
      const testNode = {
        pos: [1300, 100] as ArrayLike<number>, // Just outside viewport
        size: [200, 100] as ArrayLike<number>
      }

      // Test margin adaptation at different zoom levels
      const zoomTests = [
        { scale: 0.05, expectedVisible: true }, // Low zoom, larger margin
        { scale: 1.0, expectedVisible: true }, // Normal zoom, standard margin
        { scale: 4.0, expectedVisible: false } // High zoom, tighter margin
      ]

      const marginTests: boolean[] = []
      const timings: number[] = []

      zoomTests.forEach((test) => {
        mockCanvas.ds.scale = test.scale
        mockCanvas.ds.offset = [0, 0]
        transformState.syncWithCanvas(mockCanvas)

        const startTime = performance.now()
        const isVisible = transformState.isNodeInViewport(
          testNode.pos,
          testNode.size,
          viewport,
          0.2 // 20% margin
        )
        const duration = performance.now() - startTime

        marginTests.push(isVisible)
        timings.push(duration)
      })

      // All culling operations should be very fast
      timings.forEach((time) => {
        expect(time).toBeLessThan(0.1) // Individual culling under 0.1ms
      })

      // Verify adaptive behavior (margins should work as expected)
      expect(marginTests[0]).toBe(zoomTests[0].expectedVisible)
      expect(marginTests[2]).toBe(zoomTests[2].expectedVisible)
    })

    it('should handle size-based culling efficiently', () => {
      // Test nodes of various sizes
      const nodeSizes = [
        [1, 1], // Tiny node
        [5, 5], // Small node
        [50, 50], // Medium node
        [200, 100], // Large node
        [500, 300] // Very large node
      ]

      const viewport = { width: 1920, height: 1080 }

      // Position all nodes in viewport center
      const centerPos = [960, 540] as ArrayLike<number>

      nodeSizes.forEach((size) => {
        // Test at very low zoom where size culling should activate
        mockCanvas.ds.scale = 0.01 // Very low zoom
        transformState.syncWithCanvas(mockCanvas)

        const startTime = performance.now()
        const isVisible = transformState.isNodeInViewport(
          centerPos,
          size as ArrayLike<number>,
          viewport
        )
        const cullTime = performance.now() - startTime

        expect(cullTime).toBeLessThan(0.1) // Size culling under 0.1ms

        // At 0.01 zoom, nodes need to be 400+ pixels to show as 4+ screen pixels
        const screenSize = Math.max(size[0], size[1]) * 0.01
        if (screenSize < 4) {
          expect(isVisible).toBe(false)
        } else {
          expect(isVisible).toBe(true)
        }
      })
    })
  })

  describe('transform state synchronization', () => {
    it('should efficiently sync with canvas state changes', () => {
      const syncCount = 1000
      const transformUpdates = Array.from({ length: syncCount }, (_, i) => ({
        offset: [Math.sin(i * 0.1) * 1000, Math.cos(i * 0.1) * 500],
        scale: 0.5 + Math.sin(i * 0.05) * 0.4 // Scale between 0.1 and 0.9
      }))

      const startTime = performance.now()

      transformUpdates.forEach((update) => {
        mockCanvas.ds.offset = update.offset
        mockCanvas.ds.scale = update.scale
        transformState.syncWithCanvas(mockCanvas)
      })

      const syncTime = performance.now() - startTime

      expect(syncTime).toBeLessThan(15) // 1000 syncs in under 15ms

      // Verify final state is correct
      const lastUpdate = transformUpdates[transformUpdates.length - 1]
      expect(transformState.camera.x).toBe(lastUpdate.offset[0])
      expect(transformState.camera.y).toBe(lastUpdate.offset[1])
      expect(transformState.camera.z).toBe(lastUpdate.scale)
    })

    it('should generate CSS transform strings efficiently', () => {
      const transformCount = 10000

      // Set up varying transform states
      const transforms = Array.from({ length: transformCount }, (_, i) => {
        mockCanvas.ds.offset = [i * 10, i * 5]
        mockCanvas.ds.scale = 0.5 + (i % 100) / 100
        transformState.syncWithCanvas(mockCanvas)
        return transformState.transformStyle.value
      })

      const startTime = performance.now()

      // Access transform styles (triggers computed property)
      transforms.forEach((style) => {
        expect(style.transform).toContain('scale(')
        expect(style.transform).toContain('translate(')
        expect(style.transformOrigin).toBe('0 0')
      })

      const accessTime = performance.now() - startTime

      expect(accessTime).toBeLessThan(200) // 10k style accesses in under 200ms
    })
  })

  describe('bounds calculation performance', () => {
    it('should calculate node screen bounds efficiently', () => {
      // Set up realistic transform
      mockCanvas.ds.offset = [200, 100]
      mockCanvas.ds.scale = 1.5
      transformState.syncWithCanvas(mockCanvas)

      const nodeCount = 1000
      const nodes = Array.from({ length: nodeCount }, () => ({
        pos: [Math.random() * 5000, Math.random() * 3000] as ArrayLike<number>,
        size: [
          100 + Math.random() * 200,
          80 + Math.random() * 120
        ] as ArrayLike<number>
      }))

      const startTime = performance.now()

      const bounds = nodes.map((node) =>
        transformState.getNodeScreenBounds(node.pos, node.size)
      )

      const calcTime = performance.now() - startTime

      expect(calcTime).toBeLessThan(15) // 1000 bounds calculations in under 15ms
      expect(bounds).toHaveLength(nodeCount)

      // Verify bounds are reasonable
      bounds.forEach((bound) => {
        expect(bound.width).toBeGreaterThan(0)
        expect(bound.height).toBeGreaterThan(0)
        expect(Number.isFinite(bound.x)).toBe(true)
        expect(Number.isFinite(bound.y)).toBe(true)
      })
    })

    it('should calculate viewport bounds efficiently', () => {
      const viewportSizes = [
        { width: 800, height: 600 },
        { width: 1920, height: 1080 },
        { width: 3840, height: 2160 },
        { width: 1280, height: 720 }
      ]

      const margins = [0, 0.1, 0.2, 0.5]

      const combinations = viewportSizes.flatMap((viewport) =>
        margins.map((margin) => ({ viewport, margin }))
      )

      const startTime = performance.now()

      const allBounds = combinations.map(({ viewport, margin }) => {
        mockCanvas.ds.offset = [Math.random() * 1000, Math.random() * 500]
        mockCanvas.ds.scale = 0.5 + Math.random() * 2
        transformState.syncWithCanvas(mockCanvas)

        return transformState.getViewportBounds(viewport, margin)
      })

      const calcTime = performance.now() - startTime

      expect(calcTime).toBeLessThan(5) // All viewport calculations in under 5ms
      expect(allBounds).toHaveLength(combinations.length)

      // Verify bounds are reasonable
      allBounds.forEach((bounds) => {
        expect(bounds.width).toBeGreaterThan(0)
        expect(bounds.height).toBeGreaterThan(0)
        expect(Number.isFinite(bounds.x)).toBe(true)
        expect(Number.isFinite(bounds.y)).toBe(true)
      })
    })
  })

  describe('real-world performance scenarios', () => {
    it('should handle smooth panning performance', () => {
      // Simulate smooth 60fps panning for 2 seconds
      const frameCount = 120 // 2 seconds at 60fps
      const panDistance = 2000 // Pan 2000 pixels

      const frames: number[] = []

      for (let frame = 0; frame < frameCount; frame++) {
        const progress = frame / (frameCount - 1)
        const x = progress * panDistance
        const y = Math.sin(progress * Math.PI * 2) * 200 // Slight vertical wave

        mockCanvas.ds.offset = [x, y]

        const frameStart = performance.now()

        // Typical operations during panning
        transformState.syncWithCanvas(mockCanvas)
        const style = transformState.transformStyle.value // Access transform style
        expect(style.transform).toContain('translate') // Verify style is valid

        // Simulate some coordinate conversions (mouse tracking, etc.)
        for (let i = 0; i < 5; i++) {
          const screen = transformState.canvasToScreen({
            x: x + i * 100,
            y: y + i * 50
          })
          transformState.screenToCanvas(screen)
        }

        const frameTime = performance.now() - frameStart
        frames.push(frameTime)

        // Each frame should be well under 16.67ms for 60fps
        expect(frameTime).toBeLessThan(1) // Conservative: under 1ms per frame
      }

      const totalTime = frames.reduce((sum, time) => sum + time, 0)
      const avgFrameTime = totalTime / frameCount

      expect(avgFrameTime).toBeLessThan(0.5) // Average frame time under 0.5ms
      expect(totalTime).toBeLessThan(60) // Total panning overhead under 60ms
    })

    it('should handle zoom performance with viewport updates', () => {
      // Simulate smooth zoom from 0.1x to 10x
      const zoomSteps = 100
      const viewport = { width: 1920, height: 1080 }

      const zoomTimes: number[] = []

      for (let step = 0; step < zoomSteps; step++) {
        const zoomLevel = Math.pow(10, (step / (zoomSteps - 1)) * 2 - 1) // 0.1 to 10
        mockCanvas.ds.scale = zoomLevel

        const stepStart = performance.now()

        // Operations during zoom
        transformState.syncWithCanvas(mockCanvas)

        // Viewport bounds calculation (for culling)
        transformState.getViewportBounds(viewport, 0.2)

        // Test a few nodes for visibility
        for (let i = 0; i < 10; i++) {
          transformState.isNodeInViewport(
            [i * 200, i * 150],
            [200, 100],
            viewport
          )
        }

        const stepTime = performance.now() - stepStart
        zoomTimes.push(stepTime)
      }

      const maxZoomTime = Math.max(...zoomTimes)
      const avgZoomTime =
        zoomTimes.reduce((sum, time) => sum + time, 0) / zoomSteps

      expect(maxZoomTime).toBeLessThan(2) // No zoom step over 2ms
      expect(avgZoomTime).toBeLessThan(1) // Average zoom step under 1ms
    })
  })
})
