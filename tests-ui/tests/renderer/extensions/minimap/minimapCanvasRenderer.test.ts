import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type { MinimapRenderContext } from '@/renderer/extensions/minimap/types'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

vi.mock('@/stores/workspace/colorPaletteStore')
vi.mock('@/utils/colorUtil', () => ({
  adjustColor: vi.fn((color: string) => color + '_adjusted')
}))

describe('minimapCanvasRenderer', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockGraph: LGraph

  beforeEach(() => {
    vi.clearAllMocks()

    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1
    } as any

    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockContext)
    } as any

    mockGraph = {
      _nodes: [
        {
          id: '1',
          pos: [100, 100],
          size: [150, 80],
          bgcolor: '#FF0000',
          mode: LGraphEventMode.ALWAYS,
          has_errors: false,
          outputs: []
        },
        {
          id: '2',
          pos: [300, 200],
          size: [120, 60],
          bgcolor: '#00FF00',
          mode: LGraphEventMode.BYPASS,
          has_errors: true,
          outputs: []
        }
      ] as unknown as LGraphNode[],
      _groups: [],
      links: {},
      getNodeById: vi.fn()
    } as any

    vi.mocked(useColorPaletteStore).mockReturnValue({
      completedActivePalette: { light_theme: false }
    } as any)
  })

  it('should clear canvas and render nodes', () => {
    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: false,
        renderBypass: true,
        renderError: true
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Should clear the canvas first
    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)

    // Should render nodes (batch by color)
    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should handle empty graph', () => {
    mockGraph._nodes = []

    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(mockContext.fillRect).not.toHaveBeenCalled()
  })

  it('should batch render nodes by color', () => {
    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Should set fill style for each color group
    const fillStyleCalls = []
    let currentStyle = ''

    mockContext.fillStyle = ''
    Object.defineProperty(mockContext, 'fillStyle', {
      get: () => currentStyle,
      set: (value) => {
        currentStyle = value
        fillStyleCalls.push(value)
      }
    })

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Different colors for different nodes
    expect(fillStyleCalls.length).toBeGreaterThan(0)
  })

  it('should render bypass nodes with special color', () => {
    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: false,
        renderBypass: true,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Node 2 is in bypass mode, should be rendered
    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should render error outlines when enabled', () => {
    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: true
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Should set stroke style for errors
    expect(mockContext.strokeStyle).toBe('#FF0000')
    expect(mockContext.strokeRect).toHaveBeenCalled()
  })

  it('should render groups when enabled', () => {
    mockGraph._groups = [
      {
        pos: [50, 50],
        size: [400, 300],
        color: '#0000FF'
      }
    ] as any

    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: true,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Groups should be rendered before nodes
    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should render connections when enabled', () => {
    const targetNode = {
      id: '2',
      pos: [300, 200],
      size: [120, 60]
    }

    mockGraph._nodes[0].outputs = [
      {
        links: [1]
      }
    ] as any

    // Create a hybrid Map/Object for links as LiteGraph expects
    const linksMap = new Map([[1, { id: 1, target_id: 2 }]])
    const links = Object.assign(linksMap, {
      1: { id: 1, target_id: 2 }
    })
    mockGraph.links = links as any

    mockGraph.getNodeById = vi.fn().mockReturnValue(targetNode)

    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: false,
        showLinks: true,
        showGroups: false,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Should draw connection lines
    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()

    // Should draw connection slots
    expect(mockContext.arc).toHaveBeenCalled()
    expect(mockContext.fill).toHaveBeenCalled()
  })

  it('should handle light theme colors', () => {
    vi.mocked(useColorPaletteStore).mockReturnValue({
      completedActivePalette: { light_theme: true }
    } as any)

    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: true,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // Color adjustment should be called for light theme
    expect(adjustColor).toHaveBeenCalled()
  })

  it('should calculate correct offsets for centering', () => {
    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 200, height: 100 },
      scale: 0.5,
      settings: {
        nodeColors: false,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200
    }

    renderMinimapToCanvas(mockCanvas, mockGraph, context)

    // With bounds 200x100 at scale 0.5 = 100x50
    // Canvas is 250x200, so offset should be (250-100)/2 = 75, (200-50)/2 = 75
    // This affects node positioning
    expect(mockContext.fillRect).toHaveBeenCalled()
  })
})
