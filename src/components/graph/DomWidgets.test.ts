import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import DomWidgets from '@/components/graph/DomWidgets.vue'
import { useAppMode } from '@/composables/useAppMode'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { toNodeId } from '@/types/nodeId'

type TestWidget = BaseDOMWidget<object | string>

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

describe('DomWidgets app mode round-trip', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('restores widget visibility after graph → app → graph without a draw frame', async () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()
    const { setMode } = useAppMode()

    const workflowStore = useWorkflowStore()
    const workflow = new ComfyWorkflow({
      path: 'workflows/test.json',
      modified: Date.now(),
      size: 1
    })
    workflow.activeMode = 'graph'
    workflowStore.activeWorkflow = workflow as unknown as LoadedComfyWorkflow

    const graph = new LGraph()
    const node = createNode(graph, 1, 'host', [100, 200])
    const widget = createWidget('round-trip-widget', node, 14)
    domWidgetStore.registerWidget(widget)

    const canvas = createCanvas(graph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    // Initial draw — widget is visible
    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)!
    expect(widgetState.visible).toBe(true)

    // Enter app mode — canvas is hidden via v-show so updateWidgets() stops running
    setMode('app')
    await nextTick()

    // Simulate the stale state that builds up while the canvas is hidden
    widgetState.visible = false

    // Return to graph mode — the fix calls updateWidgets() immediately via whenever()
    setMode('graph')
    await nextTick()

    // Without the fix, visible stays false because no draw frame has run yet
    expect(widgetState.visible).toBe(true)
  })
})
