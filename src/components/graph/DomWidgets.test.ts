import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'

import DomWidgets from '@/components/graph/DomWidgets.vue'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { toNodeId } from '@/types/nodeId'

type TestWidget = BaseDOMWidget

type WidgetUpdateCounters = {
  isVisibleCalls: number
  nodeVisibilityChecks: number
  positionChanges: number
  sizeChanges: number
  visibleChanges: number
  zIndexChanges: number
  zIndexLookups: number
}

function createNode(
  graph: LGraph,
  id: number,
  title: string,
  pos: [number, number]
) {
  const node = new LGraphNode(title)
  node.id = toNodeId(id)
  node.pos = [...pos]
  node.size = [240, 120]
  graph.add(node)
  return node
}

function createWidget(id: string, node: LGraphNode, y = 12): TestWidget {
  return fromPartial<TestWidget>({
    id,
    node,
    name: 'test_widget',
    type: 'custom',
    value: '',
    options: {},
    y,
    width: 120,
    computedHeight: 40,
    margin: 10,
    isVisible: () => true
  })
}

function createCanvas(graph: LGraph): LGraphCanvas {
  return fromPartial<LGraphCanvas>({
    graph,
    low_quality: false,
    read_only: false,
    isNodeVisible: vi.fn(() => true),
    ds: { offset: [0, 0], scale: 1 },
    selected_nodes: {},
    selectedItems: new Set()
  })
}

function drawFrame(canvas: LGraphCanvas) {
  canvas.onDrawForeground?.({} as CanvasRenderingContext2D, new Rectangle())
}

describe('DomWidgets positioning', () => {
  it('positions an active visible widget relative to its owning node', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const node = createNode(graph, 1, 'host', [100, 200])
    const widget = createWidget('widget-pos', node, 14)

    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    drawFrame(canvas)

    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    expect(widgetState.visible).toBe(true)
    expect(widgetState.pos).toEqual([110, 224])
  })

  it('hides a widget whose owning node is in a different graph', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const currentGraph = new LGraph()
    const otherGraph = new LGraph()
    const node = createNode(otherGraph, 1, 'host', [100, 200])
    const widget = createWidget('widget-other-graph', node, 14)

    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(currentGraph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    drawFrame(canvas)

    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    expect(widgetState.visible).toBe(false)
  })

  it('hides an inactive widget', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const node = createNode(graph, 1, 'host', [0, 0])
    const widget = createWidget('widget-inactive', node, 10)

    domWidgetStore.registerWidget(widget)
    domWidgetStore.deactivateWidget(widget.id)

    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    widgetState.visible = true

    const canvas = createCanvas(graph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    drawFrame(canvas)

    expect(widgetState.visible).toBe(false)
  })

  it('forces pos reassignment on viewport pan even when canvas-space pos is unchanged', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const node = createNode(graph, 1, 'node', [100, 200])
    const widget = createWidget('viewport-widget', node, 12)
    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    const posAfterFirstFrame = widgetState.pos
    expect(posAfterFirstFrame).toEqual([110, 222])

    // Canvas pan: ds.offset is non-reactive, so the downstream watcher only
    // fires if widgetState.pos is reassigned (a new array identity).
    canvas.ds.offset[0] = 50
    canvas.ds.offset[1] = 60
    drawFrame(canvas)

    expect(widgetState.pos).not.toBe(posAfterFirstFrame)
  })

  it('skips pos reassignment when viewport and canvas-space pos are both stable', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const node = createNode(graph, 1, 'node', [100, 200])
    const widget = createWidget('idle-widget', node, 12)
    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    const posAfterFirstFrame = widgetState.pos

    // No pan, no node movement — pos array identity must be preserved
    // (this is the perf optimization being protected).
    drawFrame(canvas)
    expect(widgetState.pos).toBe(posAfterFirstFrame)
  })

  it('mirrors widget.computedDisabled into widgetState each frame', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const node = createNode(graph, 1, 'node', [100, 200])
    const widget = createWidget('disabled-widget', node, 12)
    Object.assign(widget, { computedDisabled: false })
    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    expect(widgetState.computedDisabled).toBe(false)

    // Simulate litegraph connecting an input -> widget.computedDisabled flips.
    Object.assign(widget, { computedDisabled: true })
    drawFrame(canvas)
    expect(widgetState.computedDisabled).toBe(true)
  })

  it('forces pos reassignment when the selected node render area changes', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const movingNode = createNode(graph, 1, 'moving', [100, 100])
    const otherNode = createNode(graph, 2, 'other', [400, 100])
    const widget = createWidget('clipped-widget', otherNode, 12)
    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    canvas.selected_nodes = { 1: movingNode }
    canvas.selectedItems = new Set([movingNode])
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    movingNode.updateArea()
    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    const posAfterFirstFrame = widgetState.pos

    movingNode.flags.collapsed = true
    movingNode.updateArea()
    drawFrame(canvas)

    expect(widgetState.pos).not.toBe(posAfterFirstFrame)
  })

  it('forces pos reassignment for widgets when the selected node moves', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graph = new LGraph()
    const movingNode = createNode(graph, 1, 'moving', [100, 100])
    const otherNode = createNode(graph, 2, 'other', [400, 100])
    const widget = createWidget('clipped-widget', otherNode, 12)
    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    // movingNode is the selected node — its renderArea drives clipping for
    // widgets owned by other nodes.
    canvas.selected_nodes = { 1: movingNode }
    canvas.selectedItems = new Set([movingNode])
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    movingNode.updateArea()
    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    const posAfterFirstFrame = widgetState.pos

    // Drag the selected node — otherNode (and its widget) hasn't moved, but
    // the widget's clip-path depends on movingNode.renderArea, so the
    // downstream pos watcher must re-fire.
    movingNode.pos[0] = 150
    movingNode.updateArea()
    drawFrame(canvas)
    expect(widgetState.pos).not.toBe(posAfterFirstFrame)
  })
})

describe('DomWidgets deterministic update matrix', () => {
  const widgetCounts = [0, 10, 100] as const

  async function measureUpdate({
    count,
    update,
    widgetsVisible
  }: {
    count: number
    update: 'node-geometry' | 'node-layout' | 'steady' | 'zoom'
    widgetsVisible: boolean
  }): Promise<WidgetUpdateCounters> {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()
    const graph = new LGraph()
    const isVisible = vi.fn(() => widgetsVisible)

    for (let index = 0; index < count; index++) {
      const node = createNode(graph, index + 1, `node-${index}`, [index, index])
      const widget = createWidget(`widget-${index}`, node)
      widget.isVisible = isVisible
      domWidgetStore.registerWidget(widget)
    }

    const canvas = createCanvas(graph)
    const nodeVisibility = vi.mocked(canvas.isNodeVisible)
    const zIndexLookup = vi.spyOn(graph.nodes, 'indexOf')
    canvasStore.canvas = canvas

    const rendered = render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })
    drawFrame(canvas)

    const changes = {
      position: 0,
      size: 0,
      visible: 0,
      zIndex: 0
    }
    const stops = [...domWidgetStore.widgetStates.values()].flatMap((state) => [
      watch(
        () => state.pos,
        () => changes.position++,
        { flush: 'sync' }
      ),
      watch(
        () => state.size,
        () => changes.size++,
        { flush: 'sync' }
      ),
      watch(
        () => state.visible,
        () => changes.visible++,
        { flush: 'sync' }
      ),
      watch(
        () => state.zIndex,
        () => changes.zIndex++,
        { flush: 'sync' }
      )
    ])

    isVisible.mockClear()
    nodeVisibility.mockClear()
    zIndexLookup.mockClear()

    if (update === 'node-geometry') {
      for (const node of graph.nodes) node.pos[0] += 1
    } else if (update === 'node-layout') {
      for (const state of domWidgetStore.widgetStates.values()) {
        state.widget.computedHeight = (state.widget.computedHeight ?? 50) + 1
      }
    } else if (update === 'zoom') {
      canvas.ds.scale = 1.25
    }

    drawFrame(canvas)

    const counters: WidgetUpdateCounters = {
      isVisibleCalls: isVisible.mock.calls.length,
      nodeVisibilityChecks: nodeVisibility.mock.calls.length,
      positionChanges: changes.position,
      sizeChanges: changes.size,
      visibleChanges: changes.visible,
      zIndexChanges: changes.zIndex,
      zIndexLookups: zIndexLookup.mock.calls.length
    }

    for (const stop of stops) stop()
    rendered.unmount()
    domWidgetStore.clear()
    canvasStore.canvas = null
    return counters
  }

  it.for(widgetCounts)(
    'does no reactive state work for %i visible widgets on a steady draw',
    async (count) => {
      const result = await measureUpdate({
        count,
        update: 'steady',
        widgetsVisible: true
      })

      expect(result).toEqual({
        isVisibleCalls: count,
        nodeVisibilityChecks: count,
        positionChanges: 0,
        sizeChanges: 0,
        visibleChanges: 0,
        zIndexChanges: 0,
        zIndexLookups: count
      })
    }
  )

  it.for(widgetCounts)(
    'does no downstream work for %i hidden widgets on a steady draw',
    async (count) => {
      const result = await measureUpdate({
        count,
        update: 'steady',
        widgetsVisible: false
      })

      expect(result).toEqual({
        isVisibleCalls: count,
        nodeVisibilityChecks: 0,
        positionChanges: 0,
        sizeChanges: 0,
        visibleChanges: 0,
        zIndexChanges: 0,
        zIndexLookups: 0
      })
    }
  )

  it.for(widgetCounts)(
    'updates size once for each of %i visible widgets after node layout changes',
    async (count) => {
      const result = await measureUpdate({
        count,
        update: 'node-layout',
        widgetsVisible: true
      })

      expect(result.positionChanges).toBe(0)
      expect(result.sizeChanges).toBe(count)
    }
  )

  it.for(widgetCounts)(
    'updates position once for each of %i visible widgets after geometry changes',
    async (count) => {
      const result = await measureUpdate({
        count,
        update: 'node-geometry',
        widgetsVisible: true
      })

      expect(result.positionChanges).toBe(count)
      expect(result.sizeChanges).toBe(0)
      expect(result.zIndexLookups).toBe(count)
    }
  )

  it.for(widgetCounts)(
    'updates position once for each of %i visible widgets after zoom changes',
    async (count) => {
      const result = await measureUpdate({
        count,
        update: 'zoom',
        widgetsVisible: true
      })

      expect(result.positionChanges).toBe(count)
      expect(result.sizeChanges).toBe(0)
    }
  )
})
