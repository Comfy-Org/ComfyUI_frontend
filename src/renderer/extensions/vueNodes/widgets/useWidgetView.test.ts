import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { widgetId } from '@comfyorg/graph-model/widgetId'

vi.mock(import('@/scripts/app'))

function nodeWithNumberWidget(graph: LGraph, title: string) {
  const node = new LGraphNode(title)
  node.addInput('steps', 'INT', { widget: { name: 'steps' } })
  node.addWidget('number', 'steps', 20, () => {}, { min: 1, max: 100 })
  graph.add(node)
  return node
}

describe('useWidgetView', () => {
  it('renders a widget whose input is linked as disabled, naming its upstream node', () => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const source = new LGraphNode('Source')
    source.addOutput('value', 'INT')
    graph.add(source)
    const target = nodeWithNumberWidget(graph, 'Target')
    source.connect(0, target, 0)

    const view = useWidgetView(widgetId(graph.id, target.id, 'steps'))

    expect(view.value).toMatchObject({
      name: 'steps',
      value: 20,
      options: { min: 1, max: 100, disabled: true },
      linkedUpstream: { nodeId: source.id, outputName: 'value' }
    })
  })

  it('locates a widget inside a subgraph by that subgraph', () => {
    const subgraph = createTestSubgraph()
    subgraph.rootGraph.subgraphs.set(subgraph.id, subgraph)
    vi.mocked(app).rootGraph = subgraph.rootGraph
    const interior = nodeWithNumberWidget(subgraph, 'Interior')

    const view = useWidgetView(
      widgetId(subgraph.rootGraph.id, interior.id, 'steps')
    )

    expect(view.value.nodeLocatorId).toBe(
      createNodeLocatorId(subgraph.id, interior.id)
    )
  })

  it('keeps showing the last view while its widget is being removed', () => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const node = nodeWithNumberWidget(graph, 'Target')
    const id = ref(widgetId(graph.id, node.id, 'steps'))
    const view = useWidgetView(id)
    expect(view.value.value).toBe(20)

    useWidgetValueStore().deleteWidget(id.value)

    expect(view.value).toMatchObject({ name: 'steps', value: 20 })
  })
})
