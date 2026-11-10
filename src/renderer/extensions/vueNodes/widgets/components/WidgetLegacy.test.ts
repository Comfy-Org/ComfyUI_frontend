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
import { WidgetSpansNodeWidthKey } from '@/types/widgetTypes'
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
  const nodeWidth = 320
  const containerWidth = 296
  const hosts = [
    { name: 'the Vue node', spansNodeWidth: true, expectedWidth: nodeWidth },
    { name: 'a panel', spansNodeWidth: false, expectedWidth: containerWidth }
  ]

  it.for(hosts)(
    'draws at $expectedWidth when hosted by $name',
    async ({ spansNodeWidth, expectedWidth }) => {
      const graph = new LGraph()
      const node = new LGraphNode('Legacy')
      node.size = [nodeWidth, 100]
      const widget = node.addWidget('number', 'frame_load_cap', 0, () => {})
      graph.add(node)
      const draw = vi.fn()
      widget.draw = draw
      useCanvasStore().canvas = fromPartial({ graph })
      await nextTick()

      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
        containerWidth
      )
      stubCanvasGetContext()

      render(WidgetLegacy, {
        props: {
          nodeId: node.id,
          widget: { name: 'frame_load_cap', type: 'number', value: undefined }
        },
        global: { provide: { [WidgetSpansNodeWidthKey]: spansNodeWidth } }
      })
      await nextTick()

      const canvasElement = screen.getByTestId<HTMLCanvasElement>(
        'legacy-widget-canvas'
      )
      expect(widget.width).toBe(expectedWidth)
      expect(draw.mock.lastCall?.[2]).toBe(expectedWidth)
      expect(canvasElement.width).toBe(expectedWidth * 2)
      expect(canvasElement.style.width).toBe(`${expectedWidth}px`)
    }
  )
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
})
