import { describe, expect, test } from 'vitest'

import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { renameWidget } from '@/utils/widgetUtil'

class LabelledWidgetNode extends LGraphNode {
  static override title = 'LabelledWidget'
  constructor() {
    super('LabelledWidget')
    this.serialize_widgets = true
    this.addWidget('text', 'text', 'a cat', null)
    const input = this.addInput('text', 'STRING')
    input.widget = { name: 'text' }
  }
}

LiteGraph.registerNodeType('test/LabelledWidget', LabelledWidgetNode)

/**
 * `configure` adopts the payload's graph id (`_configureBase`), while `clear`
 * only drops store entries keyed by the id the graph held *before* configure.
 * Anything the graph-id-keyed stores still hold for the incoming id therefore
 * outlives the reload and is re-adopted instead of being read from the payload.
 */
describe('LGraph.configure clears graph-scoped stores for the incoming id', () => {
  function addLabelledNode(graph: LGraph, label: string) {
    const node = LiteGraph.createNode('test/LabelledWidget')!
    graph.add(node)
    renameWidget(node.widgets![0], node, label)
    return node
  }

  function createSourceGraph() {
    const graph = new LGraph()
    const node = addLabelledNode(graph, 'Live Label')
    return { graph, node }
  }

  function serializeToJson(graph: LGraph): ISerialisedGraph {
    return JSON.parse(JSON.stringify(graph.serialize())) as ISerialisedGraph
  }

  test('a reloaded widget label is read from the payload, never inherited from the live store', () => {
    const graph = new LGraph()
    const dropped = addLabelledNode(graph, 'Dropped Label')
    const kept = addLabelledNode(graph, 'Kept Label')

    const payload = serializeToJson(graph)
    const droppedData = payload.nodes.find(
      (n) => String(n.id) === String(dropped.id)
    )!
    delete droppedData.inputs![0].label

    const restored = new LGraph()
    restored.configure(payload)

    expect(restored.id).toBe(graph.id)
    expect(restored.getNodeById(dropped.id)!.widgets![0].label).toBeUndefined()
    expect(restored.getNodeById(kept.id)!.widgets![0].label).toBe('Kept Label')
  })

  test('preview exposures held for the incoming id do not survive the reload', () => {
    const { graph } = createSourceGraph()
    const store = usePreviewExposureStore()
    store.setExposures(graph.id, '99', [
      { sourceNodeId: '1', sourcePreviewName: 'preview', name: 'preview' }
    ])

    const payload = serializeToJson(graph)

    const restored = new LGraph()
    restored.configure(payload)

    expect(restored.id).toBe(graph.id)
    expect(store.getExposures(restored.id, '99')).toEqual([])
  })
})
