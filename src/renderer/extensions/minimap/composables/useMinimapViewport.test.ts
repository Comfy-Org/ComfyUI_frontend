import { useRafFn } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  calculateMinimapScale,
  calculateNodeBounds,
  enforceMinimumBounds
} from '@/renderer/core/spatial/boundsCalculator'
import { useMinimapViewport } from '@/renderer/extensions/minimap/composables/useMinimapViewport'
import type { MinimapCanvas } from '@/renderer/extensions/minimap/types'

vi.mock(import('@vueuse/core'), { spy: true })

vi.mock(import('@/renderer/core/spatial/boundsCalculator'), () => ({
  calculateNodeBounds: vi.fn(),
  calculateMinimapScale: vi.fn(),
  enforceMinimumBounds: vi.fn()
}))

describe('useMinimapViewport', () => {
  let mockCanvas: MinimapCanvas
  let mockGraph: LGraph

  beforeEach(() => {
    mockCanvas = {
      canvas: {
        clientWidth: 800,
        clientHeight: 600,
        width: 1600,
        height: 1200
      } as HTMLCanvasElement,
      dpr: 2,
      ds: {
        scale: 1,
        offset: [0, 0]
      },
      setDirty: vi.fn()
    }

    mockGraph = {
      _nodes: [
        { pos: [100, 100], renderingSize: [150, 80] },
        { pos: [300, 200], renderingSize: [120, 60] }
      ]
    } as Partial<LGraph> as LGraph

    vi.mocked(useRafFn, { partial: true }).mockReturnValue({
      resume: vi.fn(),
      pause: vi.fn()
    })
  })

  it('should initialize with default bounds', () => {
    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    expect(viewport.bounds.value).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0
    })

    expect(viewport.scale.value).toBe(1)
  })

  it('should calculate graph bounds from nodes', () => {
    vi.mocked(calculateNodeBounds).mockReturnValue({
      minX: 100,
      minY: 100,
      maxX: 420,
      maxY: 260,
      width: 320,
      height: 160
    })

    vi.mocked(enforceMinimumBounds).mockImplementation((bounds) => bounds)

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.updateBounds()

    expect(calculateNodeBounds).toHaveBeenCalledWith([
      { pos: [100, 100], size: [150, 80] },
      { pos: [300, 200], size: [120, 60] }
    ])
    expect(enforceMinimumBounds).toHaveBeenCalled()
  })

  it('should handle empty graph', () => {
    vi.mocked(calculateNodeBounds).mockReturnValue(null)

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef({
      _nodes: []
    } as Partial<LGraph> as LGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.updateBounds()

    expect(viewport.bounds.value).toEqual({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      width: 100,
      height: 100
    })
  })

  it('should update canvas dimensions', () => {
    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.updateCanvasDimensions()

    expect(viewport.canvasDimensions.value).toEqual({
      width: 800,
      height: 600
    })
  })

  it('should calculate viewport transform', () => {
    vi.mocked(calculateNodeBounds).mockReturnValue({
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 400,
      width: 500,
      height: 400
    })

    vi.mocked(enforceMinimumBounds).mockImplementation((bounds) => bounds)
    vi.mocked(calculateMinimapScale).mockReturnValue(0.5)

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    mockCanvas.ds.scale = 2
    mockCanvas.ds.offset = [-100, -50]

    viewport.updateBounds()
    viewport.updateCanvasDimensions()
    viewport.updateViewport()

    const transform = viewport.viewportTransform.value

    const worldX = -(-100)
    const worldY = -(-50)

    const viewportWidth = 800 / 2
    const viewportHeight = 600 / 2

    const centerOffsetX = (250 - 500 * 0.5) / 2
    const centerOffsetY = (200 - 400 * 0.5) / 2

    expect(transform.x).toBeCloseTo((worldX - 0) * 0.5 + centerOffsetX)
    expect(transform.y).toBeCloseTo((worldY - 0) * 0.5 + centerOffsetY)
    expect(transform.width).toBeCloseTo(viewportWidth * 0.5)
    expect(transform.height).toBeCloseTo(viewportHeight * 0.5)
  })

  it('should maintain strict reference equality for viewportTransform when canvas state is unchanged', () => {
    vi.mocked(calculateNodeBounds).mockReturnValue({
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 400,
      width: 500,
      height: 400
    })

    vi.mocked(enforceMinimumBounds).mockImplementation((bounds) => bounds)
    vi.mocked(calculateMinimapScale).mockReturnValue(0.5)

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    mockCanvas.ds.scale = 2
    mockCanvas.ds.offset = [-100, -50]

    viewport.updateBounds()
    viewport.updateCanvasDimensions()
    viewport.updateViewport()

    const initialTransform = viewport.viewportTransform.value

    viewport.updateViewport()
    const transformAfterIdle = viewport.viewportTransform.value

    expect(transformAfterIdle).toBe(initialTransform)

    mockCanvas.ds.offset = [-150, -50]
    viewport.updateViewport()
    const transformAfterPan = viewport.viewportTransform.value

    expect(transformAfterPan).not.toBe(initialTransform)
    expect(transformAfterPan.x).not.toBe(initialTransform.x)
  })

  it('should center view on world coordinates', () => {
    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.updateCanvasDimensions()
    mockCanvas.ds.scale = 2

    viewport.centerViewOn(300, 200)

    const expectedOffsetX = -(300 - 800 / 2 / 2)
    const expectedOffsetY = -(200 - 600 / 2 / 2)

    expect(mockCanvas.ds.offset[0]).toBe(expectedOffsetX)
    expect(mockCanvas.ds.offset[1]).toBe(expectedOffsetY)
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('should start and stop viewport sync', () => {
    const startSyncMock = vi.fn()
    const stopSyncMock = vi.fn()

    vi.mocked(useRafFn, { partial: true }).mockReturnValue({
      resume: startSyncMock,
      pause: stopSyncMock
    })

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.startViewportSync()
    expect(startSyncMock).toHaveBeenCalled()

    viewport.stopViewportSync()
    expect(stopSyncMock).toHaveBeenCalled()
  })

  it('should handle an absent canvas gracefully', () => {
    const canvasRef = shallowRef<MinimapCanvas>()
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    expect(() => viewport.updateCanvasDimensions()).not.toThrow()
    expect(() => viewport.updateViewport()).not.toThrow()
    expect(() => viewport.centerViewOn(100, 100)).not.toThrow()
  })

  it('should calculate scale correctly', () => {
    const testBounds = {
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 400,
      width: 500,
      height: 400
    }

    vi.mocked(calculateNodeBounds).mockReturnValue(testBounds)
    vi.mocked(enforceMinimumBounds).mockImplementation((bounds) => bounds)
    vi.mocked(calculateMinimapScale).mockReturnValue(0.4)

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.updateBounds()

    expect(calculateMinimapScale).toHaveBeenCalledWith(testBounds, 250, 200)
    expect(viewport.scale.value).toBe(0.4)
  })

  it('should handle device pixel ratio', () => {
    const originalDPR = window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      configurable: true
    })

    const canvasRef = shallowRef(mockCanvas)
    const graphRef = shallowRef(mockGraph)

    const viewport = useMinimapViewport(canvasRef, graphRef, 250, 200)

    viewport.updateCanvasDimensions()

    expect(viewport.canvasDimensions.value.width).toBe(800)
    expect(viewport.canvasDimensions.value.height).toBe(600)

    Object.defineProperty(window, 'devicePixelRatio', {
      value: originalDPR,
      configurable: true
    })
  })
})
