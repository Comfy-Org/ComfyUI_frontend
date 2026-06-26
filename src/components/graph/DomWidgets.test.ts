import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DomWidgets from '@/components/graph/DomWidgets.vue'
import { useAppMode } from '@/composables/useAppMode'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

type TestWidget = BaseDOMWidget<object | string>

function createNode(
  graph: LGraph,
  id: number,
  title: string,
  pos: [number, number]
) {
  const node = new LGraphNode(title)
  node.id = id
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
    isNodeVisible: vi.fn(() => true)
  })
}

function drawFrame(canvas: LGraphCanvas) {
  canvas.onDrawForeground?.({} as CanvasRenderingContext2D, new Rectangle())
}

describe('DomWidgets app mode round-trip', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('restores promoted widget visibility after graph → app → graph', async () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()
    const { setMode } = useAppMode()

    // Set up an active workflow so linearMode is driven by activeMode
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

    // Initial draw — widget visible
    drawFrame(canvas)
    const widgetState = domWidgetStore.widgetStates.get(widget.id)!
    expect(widgetState.visible).toBe(true)

    // Enter app mode — canvas is hidden, no more draw calls
    setMode('app')
    await nextTick()

    // Simulate stale visibility from lack of draw calls during app mode
    // (in production, v-show hides the canvas so updateWidgets doesn't run)
    widgetState.visible = false
    vi.mocked(canvas.isNodeVisible).mockClear()

    // Return to graph mode
    setMode('graph')
    await nextTick()

    // The whenever watcher should have called updateWidgets automatically
    expect(canvas.isNodeVisible).toHaveBeenCalled()
    expect(widgetState.visible).toBe(true)
  })
})

describe('DomWidgets positioning', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

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
})
