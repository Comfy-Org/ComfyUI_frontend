import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

const GRAPH_ID = 'graph-widget-rename'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ rootGraphId: GRAPH_ID })
}))

const noopUi = {
  getTooltipConfig: () => ({}),
  handleNodeRightClick: () => {}
}

function setup(initialName: string) {
  const graph = new LGraph()
  graph.id = GRAPH_ID
  const node = new LGraphNode('TestNode', 'TestNode')
  node.id = toNodeId(1)
  graph.add(node)
  const widget = node.addWidget('button', initialName, '', () => {})
  return { graph, node, widget }
}

function renderedWidgetNames(graph: LGraph, node: LGraphNode): string[] {
  return computeProcessedWidgets({
    nodeData: {
      id: node.id,
      graphId: GRAPH_ID,
      type: 'TestNode',
      title: 'Test',
      mode: 0,
      flags: {},
      properties: {},
      inputs: [],
      outputs: []
    },
    widgetIds: undefined,
    graphId: GRAPH_ID,
    showAdvanced: true,
    isGraphReady: true,
    rootGraph: graph,
    ui: noopUi
  }).map((w) => w.simplified.name)
}

describe('widget rename after registration (#15600)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('control: a widget that is never renamed renders', () => {
    const { graph, node } = setup('Original')
    expect(renderedWidgetNames(graph, node)).toEqual(['Original'])
  })

  it('control: the store holds the widget under its registration id', () => {
    const { node } = setup('Original')
    const store = useWidgetValueStore()
    expect(
      store.getWidget(widgetId(GRAPH_ID, node.id, 'Original'))
    ).toBeDefined()
  })

  it('keeps rendering a widget that is renamed after registration', () => {
    const { graph, node, widget } = setup('Original')
    expect(renderedWidgetNames(graph, node)).toEqual(['Original'])

    widget.name = 'Renamed'

    expect(renderedWidgetNames(graph, node)).toEqual(['Renamed'])
  })

  it('keeps the renamed widget at its position in the node order', () => {
    const graph = new LGraph()
    graph.id = GRAPH_ID
    const node = new LGraphNode('TestNode', 'TestNode')
    node.id = toNodeId(1)
    graph.add(node)
    node.addWidget('button', 'first', '', () => {})
    const middle = node.addWidget('button', 'middle', '', () => {})
    node.addWidget('button', 'last', '', () => {})
    expect(renderedWidgetNames(graph, node)).toEqual([
      'first',
      'middle',
      'last'
    ])

    middle.name = 'renamed'

    expect(renderedWidgetNames(graph, node)).toEqual([
      'first',
      'renamed',
      'last'
    ])
  })

  it('re-keys the store entry when a widget is renamed after registration', () => {
    const { node, widget } = setup('Original')
    const store = useWidgetValueStore()

    widget.name = 'Renamed'

    expect(
      store.getWidget(widgetId(GRAPH_ID, node.id, 'Renamed'))
    ).toBeDefined()
    expect(
      store.getWidget(widgetId(GRAPH_ID, node.id, 'Original'))
    ).toBeUndefined()
  })

  it('keeps its registered identity when the new name is invalid', () => {
    const { graph, node, widget } = setup('Original')
    const store = useWidgetValueStore()
    const originalId = widgetId(GRAPH_ID, node.id, 'Original')

    widget.name = ''

    expect(widget.name).toBe('Original')
    expect(widget.widgetId).toBe(originalId)
    expect(store.getWidget(originalId)).toBeDefined()
    expect(store.getNodeWidgetIds(GRAPH_ID, node.id)).toEqual([originalId])
    expect(renderedWidgetNames(graph, node)).toEqual(['Original'])
  })

  it('keeps both widgets when the new name is already registered', () => {
    const { graph, node, widget } = setup('first')
    const store = useWidgetValueStore()
    const firstId = widgetId(GRAPH_ID, node.id, 'first')
    const secondId = widgetId(GRAPH_ID, node.id, 'second')
    node.addWidget('button', 'second', '', () => {})

    widget.name = 'second'

    expect(widget.name).toBe('first')
    expect(store.getWidget(firstId)).toBeDefined()
    expect(store.getWidget(secondId)).toBeDefined()
    expect(store.getNodeWidgetIds(GRAPH_ID, node.id)).toEqual([
      firstId,
      secondId
    ])
    expect(renderedWidgetNames(graph, node)).toEqual(['first', 'second'])
  })

  it('carries the widget value across a rename', () => {
    const { graph, node, widget } = setup('Original')
    widget.value = 'carried'

    widget.name = 'Renamed'

    const rendered = computeProcessedWidgets({
      nodeData: {
        id: node.id,
        graphId: GRAPH_ID,
        type: 'TestNode',
        title: 'Test',
        mode: 0,
        flags: {},
        properties: {},
        inputs: [],
        outputs: []
      },
      widgetIds: undefined,
      graphId: GRAPH_ID,
      showAdvanced: true,
      isGraphReady: true,
      rootGraph: graph,
      ui: noopUi
    })
    expect(rendered).toHaveLength(1)
    expect(rendered[0].simplified.value).toBe('carried')
  })
})
