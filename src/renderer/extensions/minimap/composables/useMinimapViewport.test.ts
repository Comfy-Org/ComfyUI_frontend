import { useRafFn } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import { useMinimapViewport } from '@/renderer/extensions/minimap/composables/useMinimapViewport'
import type { MinimapCanvas } from '@/renderer/extensions/minimap/types'
import { createTestCanvasElement } from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'
import {
  createMockLGraph,
  createMockLGraphNode
} from '@comfyorg/litegraph/__fixtures__/litegraphTestUtils'

vi.mock(import('@vueuse/core'), { spy: true })

describe('useMinimapViewport', () => {
  let mockCanvas: MinimapCanvas
  let mockGraph: LGraph

  beforeEach(() => {
    mockCanvas = {
      canvas: createTestCanvasElement({
        width: 1600,
        height: 1200,
        cssSize: [800, 600]
      }),
      dpr: 2,
      ds: {
        scale: 1,
        offset: [0, 0]
      },
      setDirty: vi.fn()
    }

    mockGraph = createMockLGraph({
      _nodes: [
        createMockLGraphNode({ pos: [100, 100], renderingSize: [150, 80] }),
        createMockLGraphNode({ pos: [300, 200], renderingSize: [120, 60] })
      ]
    })

    vi.mocked(useRafFn, { partial: true }).mockReturnValue({
      resume: vi.fn(),
      pause: vi.fn()
    })
  })

  it('should initialize with default bounds', () => {
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

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
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.updateBounds(new MinimapDataSource(mockGraph))

    expect(viewport.bounds.value).toEqual({
      minX: -990,
      minY: -820,
      maxX: 1510,
      maxY: 1180,
      width: 2500,
      height: 2000
    })
    expect(viewport.scale.value).toBeCloseTo(0.09)
  })

  it('should handle empty graph', () => {
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)
    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.updateBounds(
      new MinimapDataSource(createMockLGraph({ _nodes: [] }))
    )

    expect(viewport.bounds.value).toEqual({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      width: 100,
      height: 100
    })
    expect(viewport.scale.value).toBeCloseTo(1.8)
  })

  it('should update canvas dimensions', () => {
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.updateCanvasDimensions()

    expect(viewport.canvasDimensions.value).toEqual({
      width: 800,
      height: 600
    })
  })

  it('should calculate viewport transform', () => {
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    mockCanvas.ds.scale = 2
    mockCanvas.ds.offset = [-100, -50]

    viewport.updateBounds(new MinimapDataSource(mockGraph))
    viewport.updateCanvasDimensions()
    viewport.updateViewport()

    const transform = viewport.viewportTransform.value

    expect(transform.x).toBeCloseTo(110.6)
    expect(transform.y).toBeCloseTo(88.3)
    expect(transform.width).toBeCloseTo(36)
    expect(transform.height).toBeCloseTo(27)
  })

  it('should maintain strict reference equality for viewportTransform when canvas state is unchanged', () => {
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    mockCanvas.ds.scale = 2
    mockCanvas.ds.offset = [-100, -50]

    viewport.updateBounds(new MinimapDataSource(mockGraph))
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
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.updateCanvasDimensions()
    mockCanvas.ds.scale = 2

    viewport.centerViewOn(300, 200)

    expect(mockCanvas.ds.offset).toEqual([-100, -50])
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('should start and stop viewport sync', () => {
    const startSyncMock = vi.fn()
    const stopSyncMock = vi.fn()

    vi.mocked(useRafFn, { partial: true }).mockReturnValue({
      resume: startSyncMock,
      pause: stopSyncMock
    })

    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.startViewportSync()
    expect(startSyncMock).toHaveBeenCalled()

    viewport.stopViewportSync()
    expect(stopSyncMock).toHaveBeenCalled()
  })

  it('should handle null canvas gracefully', () => {
    const canvasRef = ref<MinimapCanvas | null>(null)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    expect(() => viewport.updateCanvasDimensions()).not.toThrow()
    expect(() => viewport.updateViewport()).not.toThrow()
    expect(() => viewport.centerViewOn(100, 100)).not.toThrow()
  })

  it('should calculate scale correctly', () => {
    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)
    const graph = createMockLGraph({
      _nodes: [
        createMockLGraphNode({ pos: [0, 0], renderingSize: [5000, 2500] })
      ]
    })

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.updateBounds(new MinimapDataSource(graph))

    expect(viewport.scale.value).toBeCloseTo(0.045)
  })

  it('should handle device pixel ratio', () => {
    const originalDPR = window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      configurable: true
    })

    const canvasRef = ref<MinimapCanvas | null>(mockCanvas)

    const viewport = useMinimapViewport(canvasRef, 250, 200)

    viewport.updateCanvasDimensions()

    expect(viewport.canvasDimensions.value.width).toBe(800)
    expect(viewport.canvasDimensions.value.height).toBe(600)

    Object.defineProperty(window, 'devicePixelRatio', {
      value: originalDPR,
      configurable: true
    })
  })
})
