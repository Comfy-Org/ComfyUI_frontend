import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  createMockCanvasRenderingContext2D,
  stubCanvasGetContext
} from '@/utils/__tests__/canvasTestUtils'

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
    name: 'layout minimum before legacy size',
    widget: {
      computeLayoutSize: () => ({ minWidth: 0, minHeight: 30 }),
      computeSize: () => [0, -4]
    },
    expectedCanvasHeight: 64
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
      const graph = new LGraph()
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
})

describe('WidgetLegacy canvas width', () => {
  function renderNumberWidget(layoutWidth: number) {
    const graph = new LGraph()
    const node = new LGraphNode('Legacy')
    const widget = node.addWidget('number', 'frame_load_cap', 0, () => {})
    graph.add(node)
    const draw = vi.fn<NonNullable<IBaseWidget['draw']>>()
    widget.draw = draw
    useCanvasStore().canvas = fromPartial({ graph })

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
      layoutWidth
    )
    const canvases: HTMLCanvasElement[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        canvases.push(this)
        return createMockCanvasRenderingContext2D()
      }
    )

    return {
      widget,
      draw,
      canvases,
      mount: () =>
        render(WidgetLegacy, {
          props: {
            nodeId: node.id,
            widget: { name: 'frame_load_cap', type: 'number', value: undefined }
          }
        })
    }
  }

  it('uses the untransformed layout width when the canvas is zoomed', async () => {
    const layoutWidth = 200
    const zoomedRectWidth = layoutWidth * 0.5
    const { widget, draw, canvases, mount } = renderNumberWidget(layoutWidth)
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect'
    ).mockReturnValue(DOMRect.fromRect({ width: zoomedRectWidth, height: 20 }))
    const widthsDuringDraw: (number | undefined)[] = []
    draw.mockImplementation(() => {
      widthsDuringDraw.push(widget.width)
    })
    await nextTick()

    mount()

    expect(widthsDuringDraw.at(-1)).toBe(layoutWidth)
    expect(draw.mock.calls.at(-1)?.[2]).toBe(layoutWidth)
    expect(canvases.at(-1)?.width).toBe(layoutWidth * 2)
  })

  it('leaves the graph canvas layout untouched outside Vue nodes mode', async () => {
    const { widget, mount } = renderNumberWidget(639)
    widget.y = 42
    widget.last_y = 42
    widget.width = undefined
    await nextTick()

    mount()

    expect(widget.width).toBeUndefined()
    expect(widget.y).toBe(42)
    expect(widget.last_y).toBe(42)
  })

  it('keeps its own layout on the widget in Vue nodes mode', async () => {
    LiteGraph.vueNodesMode = true
    onTestFinished(() => {
      LiteGraph.vueNodesMode = false
    })
    const { widget, mount } = renderNumberWidget(200)
    widget.y = 42
    await nextTick()

    mount()

    expect(widget.width).toBe(200)
    expect(widget.y).toBe(0)
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
      const graph = new LGraph()
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
    const graph = new LGraph()
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

  it('applies the panel layout during pointer events and restores the graph layout after', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('Legacy')
    node.pos = [100, 200]
    const layouts: Pick<IBaseWidget, 'y' | 'last_y' | 'width'>[] = []
    const widget = fromPartial<IBaseWidget>({
      name: 'toggle',
      type: 'custom',
      value: undefined,
      y: 0,
      options: {},
      draw: () => {}
    })
    widget.mouse = () => {
      layouts.push({ y: widget.y, last_y: widget.last_y, width: widget.width })
      return true
    }
    node.addCustomWidget(widget)
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
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(639)

    render(WidgetLegacy, {
      props: {
        nodeId: node.id,
        widget: { name: 'toggle', type: 'custom', value: undefined }
      }
    })
    const graphLayout = { y: 42, last_y: 42, width: undefined }
    Object.assign(widget, graphLayout)
    const target = screen.getByTestId('legacy-widget-canvas')
    const expectGraphLayout = () =>
      expect({
        y: widget.y,
        last_y: widget.last_y,
        width: widget.width
      }).toEqual(graphLayout)

    await userEvent.pointer({
      keys: '[MouseLeft>]',
      target,
      coords: { clientX: 28, clientY: 11, offsetX: 28, offsetY: 11 }
    })
    expectGraphLayout()
    await userEvent.pointer({
      target,
      coords: { clientX: 90, clientY: 11, offsetX: 90, offsetY: 11 }
    })
    expectGraphLayout()
    await userEvent.pointer({
      keys: '[/MouseLeft]',
      target,
      coords: { clientX: 90, clientY: 11, offsetX: 90, offsetY: 11 }
    })
    expectGraphLayout()

    expect(layouts.length).toBeGreaterThanOrEqual(2)
    for (const layout of layouts) {
      expect(layout).toEqual({ y: 0, last_y: 0, width: 639 })
    }
  })
})
