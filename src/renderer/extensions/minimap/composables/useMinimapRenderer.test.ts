import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useMinimapRenderer } from '@/renderer/extensions/minimap/composables/useMinimapRenderer'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type { UpdateFlags } from '@/renderer/extensions/minimap/types'

vi.mock(import('@/renderer/extensions/minimap/minimapCanvasRenderer'), () => ({
  renderMinimapToCanvas: vi.fn()
}))

describe('useMinimapRenderer', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockGraph: LGraph

  beforeEach(() => {
    mockContext = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn()
    } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D

    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockContext)
    } as Partial<HTMLCanvasElement> as HTMLCanvasElement

    mockGraph = {
      _nodes: [{ id: '1', pos: [0, 0], size: [100, 100] }]
    } as Partial<LGraph> as LGraph
  })

  it('should initialize with full redraw needed', () => {
    const canvasRef = shallowRef<HTMLCanvasElement | null>(mockCanvas)
    const graphRef = shallowRef(mockGraph)
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
    const emptyGraph = { _nodes: [] } as Partial<LGraph> as LGraph
    const canvasRef = ref(mockCanvas)
    const graphRef = shallowRef(emptyGraph)
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
    expect(renderMinimapToCanvas).not.toHaveBeenCalled()
  })

  it('should only render when redraw is needed', () => {
    const canvasRef = ref(mockCanvas)
    const graphRef = shallowRef(mockGraph)
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
    expect(renderMinimapToCanvas).toHaveBeenCalledTimes(1)

    renderer.renderMinimap()
    expect(renderMinimapToCanvas).toHaveBeenCalledTimes(1)

    updateFlagsRef.value.nodes = true
    renderer.renderMinimap()
    expect(renderMinimapToCanvas).toHaveBeenCalledTimes(2)
  })

  it('should update minimap with bounds and viewport callbacks', () => {
    const updateBounds = vi.fn()
    const updateViewport = vi.fn()

    const canvasRef = ref(mockCanvas)
    const graphRef = shallowRef(mockGraph)
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
    expect(renderer.needsFullRedraw.value).toBe(false)
    expect(updateFlagsRef.value.viewport).toBe(false)
  })

  it('should force full redraw when requested', () => {
    const canvasRef = ref(mockCanvas)
    const graphRef = shallowRef(mockGraph)
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
    const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
    const graphRef = shallowRef(mockGraph)
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

    expect(() => renderer.renderMinimap()).not.toThrow()
    expect(mockCanvas.getContext).not.toHaveBeenCalled()
  })
})
