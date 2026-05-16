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

    const rootGraph = new LGraph()
    const subgraphGraph = new LGraph()
    const interiorNode = createNode(subgraphGraph, 1, 'interior', [50, 50])
    const subgraphNode = createNode(rootGraph, 2, 'subgraph', [300, 300])

    const widget = createWidget('promoted-widget', interiorNode, 10)
    const overrideWidget = createWidget('override-src', subgraphNode, 20)

    domWidgetStore.registerWidget(widget)
    domWidgetStore.setPositionOverride(widget.id, {
      node: subgraphNode,
      widget: overrideWidget
    })
    // Interior widget is inactive (its node lives in the subgraph, not root)
    domWidgetStore.deactivateWidget(widget.id)

    const canvas = createCanvas(rootGraph)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: { stubs: { DomWidget: true } }
    })

    // Initial draw — promoted widget should be visible via positionOverride
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

describe('DomWidgets transition grace characterization', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('applies transition grace for exactly one frame when override exists but is not active', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graphA = new LGraph()
    const graphB = new LGraph()
    const interiorNode = createNode(graphA, 1, 'interior', [100, 200])
    const overrideNode = createNode(graphB, 2, 'override', [600, 700])

    const widget = createWidget('widget-transition', interiorNode, 14)
    const overrideWidget = createWidget('override-widget', overrideNode, 22)

    domWidgetStore.registerWidget(widget)
    domWidgetStore.setPositionOverride(widget.id, {
      node: overrideNode,
      widget: overrideWidget
    })
    domWidgetStore.deactivateWidget(widget.id)

    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')
    widgetState.visible = true
    widgetState.pos = [321, 654]

    const canvas = createCanvas(graphA)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: {
        stubs: {
          DomWidget: true
        }
      }
    })

    drawFrame(canvas)
    expect(widgetState.visible).toBe(true)
    expect(widgetState.pos).toEqual([321, 654])

    drawFrame(canvas)
    expect(widgetState.visible).toBe(false)
  })

  it('uses override positioning while override node is in current graph even when widget is inactive', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graphA = new LGraph()
    const graphB = new LGraph()
    const interiorNode = createNode(graphA, 1, 'interior', [10, 20])
    const overrideNode = createNode(graphB, 2, 'override', [300, 400])

    const widget = createWidget('widget-override-active', interiorNode, 8)
    const overrideWidget = createWidget(
      'override-position-source',
      overrideNode,
      18
    )

    domWidgetStore.registerWidget(widget)
    domWidgetStore.setPositionOverride(widget.id, {
      node: overrideNode,
      widget: overrideWidget
    })
    domWidgetStore.deactivateWidget(widget.id)

    const widgetState = domWidgetStore.widgetStates.get(widget.id)
    if (!widgetState) throw new Error('Widget state not registered')

    const canvas = createCanvas(graphB)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: {
        stubs: {
          DomWidget: true
        }
      }
    })

    drawFrame(canvas)

    expect(widgetState.visible).toBe(true)
    expect(widgetState.pos).toEqual([310, 428])
  })

  it('cleans orphaned transition-grace ids after widget removal', () => {
    const canvasStore = useCanvasStore()
    const domWidgetStore = useDomWidgetStore()

    const graphA = new LGraph()
    const graphB = new LGraph()
    const interiorNode = createNode(graphA, 1, 'interior', [0, 0])
    const overrideNode = createNode(graphB, 2, 'override', [200, 200])

    const canvas = createCanvas(graphA)
    canvasStore.canvas = canvas

    render(DomWidgets, {
      global: {
        stubs: {
          DomWidget: true
        }
      }
    })

    const oldWidget = createWidget('shared-widget-id', interiorNode, 10)
    const overrideWidget = createWidget(
      'shared-override-widget',
      overrideNode,
      14
    )

    domWidgetStore.registerWidget(oldWidget)
    domWidgetStore.setPositionOverride(oldWidget.id, {
      node: overrideNode,
      widget: overrideWidget
    })
    domWidgetStore.deactivateWidget(oldWidget.id)

    drawFrame(canvas)
    domWidgetStore.unregisterWidget(oldWidget.id)

    drawFrame(canvas)

    const replacementWidget = createWidget('shared-widget-id', interiorNode, 10)
    domWidgetStore.registerWidget(replacementWidget)
    domWidgetStore.setPositionOverride(replacementWidget.id, {
      node: overrideNode,
      widget: overrideWidget
    })
    domWidgetStore.deactivateWidget(replacementWidget.id)

    const replacementState = domWidgetStore.widgetStates.get(
      replacementWidget.id
    )
    if (!replacementState) throw new Error('Replacement widget missing state')
    replacementState.visible = true
    replacementState.pos = [999, 999]

    drawFrame(canvas)

    expect(replacementState.visible).toBe(true)
    expect(replacementState.pos).toEqual([999, 999])
  })
})
