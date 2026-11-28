import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  createMockCanvasRenderingContext2D,
  stubCanvasGetContext
} from '@/utils/__tests__/canvasTestUtils'

import { restoreGeometryBeforeVueNodes } from '@/renderer/extensions/vueNodes/widgets/utils/legacyWidgetCanvasGeometry'

import WidgetLegacy from './WidgetLegacy.vue'

vi.mock(import('@/scripts/app'))

interface HeightCase {
  name: string
  widget: Partial<
    Pick<IBaseWidget, 'computedHeight' | 'computeLayoutSize' | 'computeSize'>
  >
  expectedCanvasHeight: number
}

const heightCases: HeightCase[] = [
  {
    name: 'zero computed height with a negative legacy size',
    widget: { computedHeight: 0, computeSize: () => [0, -4] },
    expectedCanvasHeight: 0
  },
  {
    name: 'zero computed height before a positive legacy size',
    widget: { computedHeight: 0, computeSize: () => [0, 30] },
    expectedCanvasHeight: 0
  },
  {
    name: 'negative legacy size before layout measurement',
    widget: { computeSize: () => [0, -4] },
    expectedCanvasHeight: 0
  },
  {
    name: 'negative layout minimum',
    widget: { computeLayoutSize: () => ({ minWidth: 0, minHeight: -4 }) },
    expectedCanvasHeight: 0
  },
  {
    name: 'computed height before legacy size',
    widget: { computedHeight: 30, computeSize: () => [0, -4] },
    expectedCanvasHeight: 64
  },
  {
    name: 'legacy size before layout minimum',
    widget: {
      computeLayoutSize: () => ({ minWidth: 0, minHeight: 30 }),
      computeSize: () => [0, -4]
    },
    expectedCanvasHeight: 0
  },
  {
    name: 'positive legacy size',
    widget: { computeSize: () => [0, 30] },
    expectedCanvasHeight: 64
  },
  {
    name: 'default height without size measurements',
    widget: {},
    expectedCanvasHeight: 44
  }
]

describe('WidgetLegacy canvas sizing', () => {
  it.for(heightCases)(
    'renders the canvas for $name',
    async ({ widget: overrides, expectedCanvasHeight }) => {
      const graph = app.rootGraph
      const node = new LGraphNode('Legacy')
      const widget = node.addWidget('text', 'stack_data', '[]', () => {})
      graph.add(node)
      widget.computedHeight = undefined
      Object.assign(widget, overrides)
      widget.draw = () => {}
      useCanvasStore().canvas = fromPartial({ graph })
      await nextTick()

      const canvases: HTMLCanvasElement[] = []
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        function (this: HTMLCanvasElement) {
          canvases.push(this)
          return null
        }
      )
      render(WidgetLegacy, {
        props: {
          nodeId: node.id,
          widget: { name: 'stack_data', type: 'text', value: undefined }
        }
      })

      expect(canvases.at(-1)?.height).toBe(expectedCanvasHeight)
    }
  )

  it('draws a growable widget at its row height instead of the canvas layout height', async () => {
    const graph = app.rootGraph
    const node = new LGraphNode('Legacy')
    const widget = node.addWidget('text', 'comparer', '', () => {})
    graph.add(node)
    widget.computeLayoutSize = () => ({ minWidth: 0, minHeight: 20 })
    widget.computedHeight = 500
    const drawnHeights: number[] = []
    widget.draw = (_ctx, _node, _width, _y, height) => {
      drawnHeights.push(height)
    }
    useCanvasStore().canvas = fromPartial({ graph })
    await nextTick()

    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
    stubCanvasGetContext()
    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'comparer', type: 'text', value: undefined }
      }
    })

    const canvas = screen.getByTestId<HTMLCanvasElement>('legacy-widget-canvas')
    expect(canvas.height).toBe(604)
    expect(drawnHeights.at(-1)).toBe(300)
    expect(widget.computedHeight).toBe(300)
  })

  it('draws a fixed widget stretched by its row where classic layout would place it at the bottom of the node', async () => {
    const graph = app.rootGraph
    const node = new LGraphNode('Legacy')
    node.size = [400, 420]
    const widget = node.addWidget('text', 'comparer', '', () => {})
    graph.add(node)
    widget.computedHeight = undefined
    widget.computeSize = () => [400, 20]
    const draws: { y: number; height: number }[] = []
    widget.draw = (_ctx, _node, _width, y, height) => {
      draws.push({ y, height })
    }
    useCanvasStore().canvas = fromPartial({ graph })
    await nextTick()

    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(364)
    stubCanvasGetContext()
    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'comparer', type: 'text', value: undefined }
      }
    })

    const canvas = screen.getByTestId<HTMLCanvasElement>('legacy-widget-canvas')
    expect(canvas.height).toBe(732)
    expect(draws.at(-1)).toEqual({ y: 56, height: 20 })
  })
})

describe('WidgetLegacy canvas width', () => {
  it('uses the untransformed layout width when the canvas is zoomed', async () => {
    LiteGraph.vueNodesMode = true
    onTestFinished(() => {
      LiteGraph.vueNodesMode = false
    })
    const graph = app.rootGraph
    const node = new LGraphNode('Legacy')
    const widget = node.addWidget('number', 'frame_load_cap', 0, () => {})
    graph.add(node)
    widget.draw = () => {}
    useCanvasStore().canvas = fromPartial({ graph })
    await nextTick()

    const layoutWidth = 200
    const zoomedRectWidth = layoutWidth * 0.5
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
      layoutWidth
    )
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect'
    ).mockReturnValue(DOMRect.fromRect({ width: zoomedRectWidth, height: 20 }))
    const canvases: HTMLCanvasElement[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        canvases.push(this)
        return null
      }
    )

    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'frame_load_cap', type: 'number', value: undefined }
      }
    })

    expect(widget.width).toBe(layoutWidth)
    expect(canvases.at(-1)?.width).toBe(layoutWidth * 2)
  })
})

describe('WidgetLegacy in the properties panel beside the LiteGraph canvas', () => {
  const canvasGeometry = { width: 150, y: 40, last_y: 37, canvasHeight: 90 }
  const panelRowGeometry = { width: 318, y: 0, last_y: 0, canvasHeight: 20 }

  function readGeometry(widget: IBaseWidget, node: LGraphNode) {
    return {
      width: widget.width,
      y: widget.y,
      last_y: widget.last_y,
      canvasHeight: node.canvasHeight
    }
  }

  async function renderInPanel(widgetOverrides: Partial<IBaseWidget> = {}) {
    const graph = app.rootGraph
    const node = new LGraphNode('Legacy')
    node.size = [210, 120]
    node.pos = [100, 200]
    const widget = node.addCustomWidget(
      fromPartial<IBaseWidget>({
        name: 'loras',
        type: 'custom',
        value: undefined,
        y: 0,
        options: {},
        draw: () => {},
        ...widgetOverrides
      })
    )
    graph.add(node)
    widget.width = canvasGeometry.width
    widget.y = canvasGeometry.y
    widget.last_y = canvasGeometry.last_y
    node.canvasHeight = canvasGeometry.canvasHeight
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    useCanvasStore().canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
    await nextTick()

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
      panelRowGeometry.width
    )
    stubCanvasGetContext()
    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'loras', type: 'custom', value: undefined }
      }
    })
    return { node, widget }
  }

  it('draws with the panel row geometry and restores the canvas geometry afterward', async () => {
    const geometryInDraw: ReturnType<typeof readGeometry>[] = []
    const { node, widget } = await renderInPanel({
      draw(this: IBaseWidget, _ctx, host) {
        geometryInDraw.push(readGeometry(this, host))
      }
    })

    expect(geometryInDraw.at(-1)).toEqual(panelRowGeometry)
    expect(readGeometry(widget, node)).toEqual(canvasGeometry)
  })

  it('gives a panel pointer gesture the row geometry and restores the canvas geometry after each event', async () => {
    const geometryInMouse: ReturnType<typeof readGeometry>[] = []
    const { node, widget } = await renderInPanel({
      mouse(this: IBaseWidget, _event, _pos, host) {
        geometryInMouse.push(readGeometry(this, host))
        return true
      }
    })
    const target = screen.getByTestId('legacy-widget-canvas')
    const user = userEvent.setup()

    await user.pointer({
      keys: '[MouseLeft>]',
      target,
      coords: { offsetX: 28, offsetY: 11 }
    })
    expect(readGeometry(widget, node)).toEqual(canvasGeometry)
    await user.pointer({ target, coords: { offsetX: 60, offsetY: 11 } })
    expect(readGeometry(widget, node)).toEqual(canvasGeometry)
    await user.pointer({
      keys: '[/MouseLeft]',
      target,
      coords: { offsetX: 60, offsetY: 11 }
    })
    expect(readGeometry(widget, node)).toEqual(canvasGeometry)

    expect(geometryInMouse.length).toBeGreaterThanOrEqual(2)
    for (const geometry of geometryInMouse)
      expect(geometry).toEqual(panelRowGeometry)
  })

  it('restores the canvas geometry when a custom draw throws', async () => {
    const { node, widget } = await renderInPanel()
    const drawFailure = new Error('custom draw failed')
    widget.draw = () => {
      throw drawFailure
    }

    expect(() => widget.triggerDraw?.()).toThrow(drawFailure)
    expect(readGeometry(widget, node)).toEqual(canvasGeometry)
  })

  it('restores the canvas geometry from before Vue nodes when the renderer switches back to LiteGraph', async () => {
    LiteGraph.vueNodesMode = true
    onTestFinished(() => {
      LiteGraph.vueNodesMode = false
    })
    const { node, widget } = await renderInPanel()
    widget.triggerDraw?.()
    expect(readGeometry(widget, node)).toEqual(panelRowGeometry)

    LiteGraph.vueNodesMode = false
    restoreGeometryBeforeVueNodes(node)

    expect(readGeometry(widget, node)).toEqual(canvasGeometry)
  })
})

describe('WidgetLegacy repaint', () => {
  const dirtySignals = [
    {
      name: 'node.setDirtyCanvas',
      markDirty: (node: LGraphNode) => node.setDirtyCanvas(true)
    },
    {
      name: 'graph.setDirtyCanvas',
      markDirty: (node: LGraphNode) => node.graph?.setDirtyCanvas(true)
    }
  ]

  it.for(dirtySignals)(
    'redraws the widget on the next dirty canvas frame after $name',
    async ({ markDirty }) => {
      LiteGraph.vueNodesMode = true
      onTestFinished(() => {
        LiteGraph.vueNodesMode = false
      })
      const graph = app.rootGraph
      const node = new LGraphNode('Legacy')
      const widget = node.addWidget('text', 'stack_data', '[]', () => {})
      graph.add(node)
      const draw = vi.fn()
      widget.draw = draw
      stubCanvasGetContext()
      const canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
        skip_render: true,
        skip_events: true
      })
      useCanvasStore().canvas = canvas
      await nextTick()

      render(WidgetLegacy, {
        props: {
          nodeId: node.id,
          widget: { name: 'stack_data', type: 'text', value: undefined }
        }
      })
      canvas.draw()
      const drawsOnMount = draw.mock.calls.length

      markDirty(node)
      markDirty(node)
      expect(draw).toHaveBeenCalledTimes(drawsOnMount)
      canvas.draw()
      expect(draw).toHaveBeenCalledTimes(drawsOnMount + 1)
      expect(widget.last_y).toBe(widget.y)
      canvas.draw()
      expect(draw).toHaveBeenCalledTimes(drawsOnMount + 1)
    }
  )
})

describe('WidgetLegacy pointer events', () => {
  const buttonCases = [
    {
      name: 'passes the same widget-local position to mouse on primary pointerdown and pointerup',
      button: 'MouseLeft',
      expectedPositions: [
        [28, 11],
        [28, 11]
      ]
    },
    {
      name: 'keeps secondary button presses away from mouse',
      button: 'MouseRight',
      expectedPositions: []
    }
  ]

  it.for(buttonCases)('$name', async ({ button, expectedPositions }) => {
    const graph = app.rootGraph
    const node = new LGraphNode('Legacy')
    node.pos = [100, 200]
    const mouse = vi.fn<NonNullable<IBaseWidget['mouse']>>(() => true)
    node.addCustomWidget(
      fromPartial<IBaseWidget>({
        name: 'toggle',
        type: 'custom',
        value: undefined,
        y: 0,
        options: {},
        mouse,
        draw: () => {}
      })
    )
    graph.add(node)
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    useCanvasStore().canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
    await nextTick()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'toggle', type: 'custom', value: undefined }
      }
    })
    const target = screen.getByTestId('legacy-widget-canvas')
    const coords = { offsetX: 28, offsetY: 11 }
    await userEvent.pointer([
      { keys: `[${button}>]`, target, coords },
      { keys: `[/${button}]`, target, coords }
    ])

    expect(mouse.mock.calls.map(([, pos]) => pos)).toEqual(expectedPositions)
  })
})

describe('WidgetLegacy ownership', () => {
  it('sends pointer edits to the root graph owner while the canvas shows a subgraph', async () => {
    const root = app.rootGraph
    const interior = createTestSubgraph({ rootGraph: root })
    const nodes = [new LGraphNode('Owner'), new LGraphNode('Interior')]
    root.add(nodes[0])
    interior.add(nodes[1])
    const widgets = nodes.map((node, index) => {
      const widget = node.addCustomWidget<IBaseWidget>({
        name: 'value',
        type: 'owner-test-legacy',
        value: 1,
        y: 0,
        options: {},
        draw() {},
        mouse() {
          widget.value = [17, 29][index]
          return true
        }
      })
      return widget
    })
    stubCanvasGetContext()
    const canvas = new LGraphCanvas(
      document.createElement('canvas'),
      interior,
      {
        skip_render: true,
        skip_events: true
      }
    )
    useCanvasStore().canvas = canvas
    useCanvasStore().currentGraph = interior
    render(WidgetLegacy, {
      props: {
        nodeId: nodes[0].id,
        widget: {
          name: 'value',
          type: 'owner-test-legacy',
          value: undefined
        }
      }
    })

    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: screen.getByTestId('legacy-widget-canvas'),
      coords: { offsetX: 28, offsetY: 11 }
    })

    expect(widgets.map((widget) => widget.value)).toEqual([17, 1])
  })
})

describe('WidgetLegacy growable pointer events', () => {
  it('passes presses below the minimum height of a growable widget to mouse', async () => {
    const graph = app.rootGraph
    const node = new LGraphNode('Legacy')
    node.pos = [100, 200]
    const mouse = vi.fn<NonNullable<IBaseWidget['mouse']>>(() => true)
    node.addCustomWidget(
      fromPartial<IBaseWidget>({
        name: 'comparer',
        type: 'custom',
        value: undefined,
        y: 0,
        options: {},
        computeLayoutSize: () => ({ minWidth: 0, minHeight: 20 }),
        mouse,
        draw: () => {}
      })
    )
    graph.add(node)
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    useCanvasStore().canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
    await nextTick()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)

    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'comparer', type: 'custom', value: undefined }
      }
    })
    const target = screen.getByTestId('legacy-widget-canvas')
    const coords = { offsetX: 28, offsetY: 150 }
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target, coords },
      { keys: '[/MouseLeft]', target, coords }
    ])

    expect(mouse.mock.calls.map(([, pos]) => pos)).toEqual([
      [28, 150],
      [28, 150]
    ])
  })
})
