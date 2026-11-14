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
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
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
  it('uses the untransformed layout width when the canvas is zoomed', async () => {
    const graph = new LGraph()
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

describe('WidgetLegacy ownership', () => {
  it('sends pointer edits to the located owner, not the canvas node with the same id', async () => {
    const interior = createTestSubgraph()
    const root = interior.rootGraph
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(root)
    const nodes = [new LGraphNode('Owner'), new LGraphNode('Decoy')]
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
        nodeId: nodes[1].id,
        widget: {
          name: 'value',
          type: 'owner-test-legacy',
          value: undefined,
          hostNodeLocatorId: createNodeLocatorId(null, nodes[0].id)
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
