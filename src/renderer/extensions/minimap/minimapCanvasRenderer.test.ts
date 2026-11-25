import { useThemeStore } from '@/platform/theme/themeStore'
import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'
import { BUILT_IN_THEME_PRESETS } from '@comfyorg/theme-core/builtInThemePresets'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import type { LGraph, LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { MinimapDataSource } from './data/MinimapDataSource'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'
import {
  MINIMAP_DECORATION_POP_MS,
  renderMinimapToCanvas
} from '@/renderer/extensions/minimap/minimapCanvasRenderer'
import type { MinimapRenderContext } from '@/renderer/extensions/minimap/types'
import { useLinkStore } from '@/stores/linkStore'
import { adjustColor } from '@comfyorg/shared-frontend-utils/colorUtil'
import {
  createMockLGraph,
  createMockLGraphNode,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'
import {
  toOwningGraphId,
  toRootGraphId
} from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { UUID } from '@/utils/uuid'

vi.mock(import('@comfyorg/shared-frontend-utils/colorUtil'), () => ({
  adjustColor: vi.fn((color: string) => color + '_adjusted')
}))

const GRAPH_ID: UUID = 'renderer-graph'
const GRAPH_SCOPE = {
  rootGraphId: toRootGraphId(GRAPH_ID),
  owningGraphId: toOwningGraphId(GRAPH_ID)
}

describe('minimapCanvasRenderer', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockGraph: LGraph

  beforeEach(() => {
    mockContext = fromPartial<CanvasRenderingContext2D>({
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
      lineWidth: 1,
      save: vi.fn(),
      restore: vi.fn()
    })

    mockCanvas = createTestCanvasElement({ ctx: mockContext })

    mockGraph = createMockLGraph({
      _nodes: [
        createMockLGraphNode({
          id: '1',
          pos: [100, 100],
          size: [150, 80],
          bgcolor: '#FF0000',
          mode: LGraphEventMode.ALWAYS,
          has_errors: false,
          outputs: []
        }),
        createMockLGraphNode({
          id: '2',
          pos: [300, 200],
          size: [120, 60],
          bgcolor: '#00FF00',
          mode: LGraphEventMode.BYPASS,
          has_errors: true,
          outputs: []
        })
      ],
      _groups: [],
      id: GRAPH_ID,
      rootGraph: fromPartial<LGraph>({ id: GRAPH_ID }),
      isRootGraph: true,
      getNodeById: vi.fn()
    })

    useThemeStore().activePresetId = 'dark'
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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    const fillStyleCalls: string[] = []
    let currentStyle = ''

    mockContext.fillStyle = ''
    Object.defineProperty(mockContext, 'fillStyle', {
      get: () => currentStyle,
      set: (value: string) => {
        currentStyle = value
        fillStyleCalls.push(value)
      }
    })

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(mockContext.strokeStyle).toBe('#FF0000')
    expect(mockContext.strokeRect).toHaveBeenCalled()
  })

  it('should render groups when enabled', () => {
    mockGraph._groups = [
      fromPartial<LGraphGroup>({
        pos: [50, 50],
        size: [400, 300],
        color: '#0000FF'
      })
    ]

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('should render connections when enabled', () => {
    mockGraph._nodes[0].outputs = [
      createMockNodeOutputSlot({
        name: 'output',
        type: 'number',
        boundingRect: new Float64Array([0, 0, 10, 10])
      })
    ]

    useLinkStore().registerLink(GRAPH_SCOPE, {
      id: toLinkId(1),
      graphId: GRAPH_SCOPE.owningGraphId,
      originNodeId: mockGraph._nodes[0].id,
      originSlot: 0,
      targetNodeId: toNodeId('2'),
      targetSlot: 0,
      type: 'number'
    })

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()

    expect(mockContext.arc).toHaveBeenCalled()
    expect(mockContext.fill).toHaveBeenCalled()
  })

  it('lightens node colors when the theme sets a node lightness', () => {
    useThemeStore().activePresetId = 'light'

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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(adjustColor).toHaveBeenCalled()
  })

  it('recomputes group colors when a palette keeps its id but changes node lightness', () => {
    mockGraph._groups = [
      fromPartial<LGraphGroup>({
        pos: [50, 50],
        size: [400, 300],
        color: '#0000FF'
      })
    ]
    const fillStyles: unknown[] = []
    Object.defineProperty(mockContext, 'fillStyle', {
      set: (value) => fillStyles.push(value),
      get: () => fillStyles.at(-1)
    })
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
    const themeStore = useThemeStore()
    themeStore.addCustomPreset({
      ...BUILT_IN_THEME_PRESETS.dark,
      id: 'reused-id'
    })
    function renderWithLightness(nodeLightness?: number) {
      themeStore.customPresets['reused-id'] = {
        ...BUILT_IN_THEME_PRESETS.dark,
        id: 'reused-id',
        colors: {
          ...BUILT_IN_THEME_PRESETS.dark.colors,
          litegraph_base: {
            ...BUILT_IN_THEME_PRESETS.dark.colors.litegraph_base,
            NODE_LIGHTNESS: nodeLightness
          }
        }
      }
      fillStyles.length = 0
      renderMinimapToCanvas(
        mockCanvas,
        new MinimapDataSource(mockGraph),
        context
      )
      return fillStyles[0]
    }

    expect([renderWithLightness(), renderWithLightness(0.5)]).toEqual([
      '#0000FF',
      'color-mix(in srgb, #0000FF 50%, transparent)'
    ])
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

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('updates decoration outlines after editing the active preset with the same ID', () => {
    const themeStore = useThemeStore()
    themeStore.addCustomPreset({
      ...BUILT_IN_THEME_PRESETS.dark,
      id: 'minimap-custom'
    })
    const context: MinimapRenderContext = {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: false,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: false
      },
      width: 250,
      height: 200,
      decorations: [{ target: { ...GRAPH_SCOPE, nodeId: toNodeId('1') } }]
    }

    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)
    expect(mockContext.strokeStyle).toBe(
      themeStore.activeTheme.canvas.nodeSelectedTitleColor
    )

    themeStore.customPresets['minimap-custom'] = {
      ...BUILT_IN_THEME_PRESETS.dark,
      id: 'minimap-custom',
      colors: {
        ...BUILT_IN_THEME_PRESETS.dark.colors,
        litegraph_base: {
          ...BUILT_IN_THEME_PRESETS.dark.colors.litegraph_base,
          NODE_SELECTED_TITLE_COLOR: '#123456'
        }
      }
    }
    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), context)

    expect(mockContext.strokeStyle).toBe('#123456')
    expect(mockContext.strokeRect).toHaveBeenLastCalledWith(50, 50, 75, 40)
  })

  test.for([
    { state: 'running', color: '#00FF00' },
    { state: 'finished', color: '#239B23' },
    { state: 'error', color: '#FF0000' }
  ] satisfies Array<{
    state: 'running' | 'finished' | 'error'
    color: string
  }>)(
    'renders $state execution outlines from the data source',
    ({ state, color }) => {
      const source = new MinimapDataSource(mockGraph, {
        [createNodeLocatorId(null, toNodeId('1'))]: { state }
      })
      mockGraph._nodes[1].has_errors = false

      renderMinimapToCanvas(mockCanvas, source, {
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
      })

      expect(mockContext.strokeStyle).toBe(color)
      expect(mockContext.strokeRect).toHaveBeenCalledExactlyOnceWith(
        50,
        50,
        75,
        40
      )
    }
  )

  it('renders a scoped semantic decoration after the base node fill', () => {
    renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), {
      bounds: { minX: 0, minY: 0, width: 500, height: 400 },
      scale: 0.5,
      settings: {
        nodeColors: false,
        showLinks: false,
        showGroups: false,
        renderBypass: false,
        renderError: true
      },
      width: 250,
      height: 200,
      decorations: [
        {
          target: { ...GRAPH_SCOPE, nodeId: toNodeId('1') },
          enter: 'pop',
          enteredAt: 1_000
        }
      ],
      now: 2_000
    })

    expect(mockContext.fillRect).toHaveBeenCalledTimes(3)
    expect(mockContext.fillRect).toHaveBeenLastCalledWith(50, 50, 75, 40)
    expect(mockContext.strokeRect).toHaveBeenCalledAfter(
      vi.mocked(mockContext.fillRect)
    )
  })

  test.for([0, MINIMAP_DECORATION_POP_MS / 2, MINIMAP_DECORATION_POP_MS])(
    'keeps tiny pop markers centered and legible at %dms',
    (elapsed) => {
      renderMinimapToCanvas(mockCanvas, new MinimapDataSource(mockGraph), {
        bounds: { minX: 0, minY: 0, width: 50_000, height: 40_000 },
        scale: 0.005,
        settings: {
          nodeColors: false,
          showLinks: false,
          showGroups: false,
          renderBypass: false,
          renderError: true
        },
        width: 250,
        height: 200,
        decorations: [
          {
            target: { ...GRAPH_SCOPE, nodeId: toNodeId('1') },
            enter: 'pop',
            enteredAt: 1_000
          }
        ],
        now: 1_000 + elapsed
      })

      const marker = vi
        .mocked(mockContext.strokeRect)
        .mock.calls.find(([, , width, height]) => width === 2 && height === 2)
      expect(marker).toBeDefined()
      const [x, y, width, height] = marker!
      expect(width).toBe(2)
      expect(height).toBe(2)
      expect(x + width / 2).toBeCloseTo(0.875)
      expect(y + height / 2).toBeCloseTo(0.7)
    }
  )
})
