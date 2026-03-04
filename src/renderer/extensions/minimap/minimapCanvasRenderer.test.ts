import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type { MinimapRenderContext } from '@/renderer/extensions/minimap/types'
import { adjustColor } from '@/utils/colorUtil'

import { WorkflowJsonDataSource } from './data/WorkflowJsonDataSource'

const mockUseColorPaletteStore = vi.hoisted(() => vi.fn())
vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: mockUseColorPaletteStore
}))

vi.mock('@/utils/colorUtil', () => ({
  adjustColor: vi.fn((color: string) => color + '_adjusted')
}))

describe('minimapCanvasRenderer', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D

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
    } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D

    mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockContext)
    } as Partial<HTMLCanvasElement> as HTMLCanvasElement

    mockUseColorPaletteStore.mockReturnValue({
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: false
      }
    })
  })

  function createDataSource(overrides?: {
    nodes?: Array<{
      id: number | string
      pos: [number, number]
      size: [number, number]
      bgcolor?: string
      mode?: number
    }>
    groups?: Array<{
      bounding: [number, number, number, number]
      color?: string
    }>
    links?: unknown[]
  }) {
    return new WorkflowJsonDataSource({
      nodes: overrides?.nodes ?? [
        {
          id: 1,
          pos: [100, 100],
          size: [150, 80],
          bgcolor: '#FF0000',
          mode: LGraphEventMode.ALWAYS
        },
        {
          id: 2,
          pos: [300, 200],
          size: [120, 60],
          bgcolor: '#00FF00',
          mode: LGraphEventMode.BYPASS
        }
      ],
      groups: overrides?.groups,
      links: overrides?.links
    })
  }

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

    renderMinimapToCanvas(mockCanvas, createDataSource(), context)

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should handle empty graph', () => {
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

    renderMinimapToCanvas(mockCanvas, createDataSource({ nodes: [] }), context)

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(mockContext.fillRect).not.toHaveBeenCalled()
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

    renderMinimapToCanvas(mockCanvas, createDataSource(), context)

    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should render error outlines when enabled', () => {
    const dataSource = createDataSource({
      nodes: [
        {
          id: 1,
          pos: [100, 100],
          size: [150, 80],
          bgcolor: '#FF0000',
          mode: LGraphEventMode.ALWAYS
        }
      ]
    })
    // Manually set hasErrors on the node data
    const nodes = dataSource.getNodes()
    nodes[0].hasErrors = true

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

    renderMinimapToCanvas(mockCanvas, dataSource, context)

    expect(mockContext.strokeStyle).toBe('#FF0000')
    expect(mockContext.strokeRect).toHaveBeenCalled()
  })

  it('should render groups when enabled', () => {
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

    const dataSource = createDataSource({
      groups: [{ bounding: [50, 50, 400, 300], color: '#0000FF' }]
    })

    renderMinimapToCanvas(mockCanvas, dataSource, context)

    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should render connections when enabled', () => {
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

    const dataSource = createDataSource({
      nodes: [
        { id: 1, pos: [100, 100], size: [150, 80] },
        { id: 2, pos: [300, 200], size: [120, 60] }
      ],
      links: [[1, 1, 0, 2, 0, 'number']]
    })

    renderMinimapToCanvas(mockCanvas, dataSource, context)

    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
    expect(mockContext.arc).toHaveBeenCalled()
    expect(mockContext.fill).toHaveBeenCalled()
  })

  it('should handle light theme colors', () => {
    mockUseColorPaletteStore.mockReturnValue({
      completedActivePalette: {
        id: 'test',
        name: 'Test Palette',
        colors: {},
        light_theme: true
      }
    })

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

    renderMinimapToCanvas(mockCanvas, createDataSource(), context)

    expect(adjustColor).toHaveBeenCalled()
  })
})
