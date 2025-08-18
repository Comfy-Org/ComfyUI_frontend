import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useMinimapRenderer } from '@/renderer/extensions/minimap/composables/useMinimapRenderer'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type { UpdateFlags } from '@/renderer/extensions/minimap/types'

vi.mock('@/renderer/extensions/minimap/minimapCanvasRenderer', () => ({
  renderMinimapToCanvas: vi.fn()
}))

describe('useMinimapRenderer', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockGraph: LGraph

  beforeEach(() => {
    vi.clearAllMocks()

    mockContext = {
      clearRect: vi.fn()
    } as any

    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockContext)
    } as any

    mockGraph = {
      _nodes: [{ id: '1', pos: [0, 0], size: [100, 100] }]
    } as any
  })

  it('should initialize with full redraw needed', () => {
    const canvasRef = ref(mockCanvas)
    const graphRef = ref(mockGraph as any)
    const boundsRef = ref({ minX: 0, minY: 0, width: 100, height: 100 })
    const scaleRef = ref(1)
    const updateFlagsRef = ref<UpdateFlags>({
      bounds: false,
      nodes: false,
      connections: false,
      viewport: false
    })
    const settings = {
      nodeColors: ref(true),
      showLinks: ref(true),
      showGroups: ref(true),
      renderBypass: ref(false),
      renderError: ref(false)
    }

    const renderer = useMinimapRenderer(
      canvasRef,
      graphRef,
      boundsRef,
      scaleRef,
      updateFlagsRef,
      settings,
      250,
      200
    )

    expect(renderer.needsFullRedraw.value).toBe(true)
    expect(renderer.needsBoundsUpdate.value).toBe(true)
  })

  it('should handle empty graph with fast path', () => {
    const emptyGraph = { _nodes: [] } as any
    const canvasRef = ref(mockCanvas)
    const graphRef = ref(emptyGraph)
    const boundsRef = ref({ minX: 0, minY: 0, width: 100, height: 100 })
    const scaleRef = ref(1)
    const updateFlagsRef = ref<UpdateFlags>({
      bounds: false,
      nodes: false,
      connections: false,
      viewport: false
    })
    const settings = {
      nodeColors: ref(true),
      showLinks: ref(true),
      showGroups: ref(true),
      renderBypass: ref(false),
      renderError: ref(false)
    }

    const renderer = useMinimapRenderer(
      canvasRef,
      graphRef,
      boundsRef,
      scaleRef,
      updateFlagsRef,
      settings,
      250,
      200
    )

    renderer.renderMinimap()

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(vi.mocked(renderMinimapToCanvas)).not.toHaveBeenCalled()
  })

  it('should only render when redraw is needed', async () => {
    const { renderMinimapToCanvas } = await import(
      '@/renderer/extensions/minimap/minimapCanvasRenderer'
    )
    const canvasRef = ref(mockCanvas)
    const graphRef = ref(mockGraph as any)
    const boundsRef = ref({ minX: 0, minY: 0, width: 100, height: 100 })
    const scaleRef = ref(1)
    const updateFlagsRef = ref<UpdateFlags>({
      bounds: false,
      nodes: false,
      connections: false,
      viewport: false
    })
    const settings = {
      nodeColors: ref(true),
      showLinks: ref(true),
      showGroups: ref(true),
      renderBypass: ref(false),
      renderError: ref(false)
    }

    const renderer = useMinimapRenderer(
      canvasRef,
      graphRef,
      boundsRef,
      scaleRef,
      updateFlagsRef,
      settings,
      250,
      200
    )

    // First render (needsFullRedraw is true by default)
    renderer.renderMinimap()
    expect(vi.mocked(renderMinimapToCanvas)).toHaveBeenCalledTimes(1)

    // Second render without changes (should not render)
    renderer.renderMinimap()
    expect(vi.mocked(renderMinimapToCanvas)).toHaveBeenCalledTimes(1)

    // Set update flag and render again
    updateFlagsRef.value.nodes = true
    renderer.renderMinimap()
    expect(vi.mocked(renderMinimapToCanvas)).toHaveBeenCalledTimes(2)
  })

  it('should update minimap with bounds and viewport callbacks', () => {
    const updateBounds = vi.fn()
    const updateViewport = vi.fn()

    const canvasRef = ref(mockCanvas)
    const graphRef = ref(mockGraph as any)
    const boundsRef = ref({ minX: 0, minY: 0, width: 100, height: 100 })
    const scaleRef = ref(1)
    const updateFlagsRef = ref<UpdateFlags>({
      bounds: true,
      nodes: false,
      connections: false,
      viewport: false
    })
    const settings = {
      nodeColors: ref(true),
      showLinks: ref(true),
      showGroups: ref(true),
      renderBypass: ref(false),
      renderError: ref(false)
    }

    const renderer = useMinimapRenderer(
      canvasRef,
      graphRef,
      boundsRef,
      scaleRef,
      updateFlagsRef,
      settings,
      250,
      200
    )

    renderer.updateMinimap(updateBounds, updateViewport)

    expect(updateBounds).toHaveBeenCalled()
    expect(updateViewport).toHaveBeenCalled()
    expect(updateFlagsRef.value.bounds).toBe(false)
    expect(renderer.needsFullRedraw.value).toBe(false) // After rendering, needsFullRedraw is reset to false
    expect(updateFlagsRef.value.viewport).toBe(false) // After updating viewport, this is reset to false
  })

  it('should force full redraw when requested', () => {
    const canvasRef = ref(mockCanvas)
    const graphRef = ref(mockGraph as any)
    const boundsRef = ref({ minX: 0, minY: 0, width: 100, height: 100 })
    const scaleRef = ref(1)
    const updateFlagsRef = ref<UpdateFlags>({
      bounds: false,
      nodes: false,
      connections: false,
      viewport: false
    })
    const settings = {
      nodeColors: ref(true),
      showLinks: ref(true),
      showGroups: ref(true),
      renderBypass: ref(false),
      renderError: ref(false)
    }

    const renderer = useMinimapRenderer(
      canvasRef,
      graphRef,
      boundsRef,
      scaleRef,
      updateFlagsRef,
      settings,
      250,
      200
    )

    renderer.forceFullRedraw()

    expect(renderer.needsFullRedraw.value).toBe(true)
    expect(updateFlagsRef.value.bounds).toBe(true)
    expect(updateFlagsRef.value.nodes).toBe(true)
    expect(updateFlagsRef.value.connections).toBe(true)
    expect(updateFlagsRef.value.viewport).toBe(true)
  })

  it('should handle null canvas gracefully', () => {
    const canvasRef = ref<HTMLCanvasElement | undefined>(undefined)
    const graphRef = ref(mockGraph as any)
    const boundsRef = ref({ minX: 0, minY: 0, width: 100, height: 100 })
    const scaleRef = ref(1)
    const updateFlagsRef = ref<UpdateFlags>({
      bounds: false,
      nodes: false,
      connections: false,
      viewport: false
    })
    const settings = {
      nodeColors: ref(true),
      showLinks: ref(true),
      showGroups: ref(true),
      renderBypass: ref(false),
      renderError: ref(false)
    }

    const renderer = useMinimapRenderer(
      canvasRef,
      graphRef,
      boundsRef,
      scaleRef,
      updateFlagsRef,
      settings,
      250,
      200
    )

    // Should not throw
    expect(() => renderer.renderMinimap()).not.toThrow()
    expect(mockCanvas.getContext).not.toHaveBeenCalled()
  })
})
