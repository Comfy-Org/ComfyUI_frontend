import { onTestFinished } from 'vitest'

import type { ISlotType, LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

const WIDGET_NODE_TYPE = 'test/widgetNode'

export function createTestNode(
  graph: LGraph | Subgraph,
  inputs: ISlotType[] = [],
  outputs: ISlotType[] = [],
  title?: string
): LGraphNode {
  const type = JSON.stringify({ inputs, outputs })
  if (!LiteGraph.registered_node_types[type]) {
    class TestNode extends LGraphNode {
      constructor(title: string) {
        super(title)
        let i = 0
        for (const input of inputs) this.addInput('input_' + i++, input)
        let o = 0
        for (const output of outputs) this.addOutput('output_' + o++, output)
      }
    }
    LiteGraph.registered_node_types[type] = TestNode
    onTestFinished(() => {
      if (LiteGraph.registered_node_types[type] === TestNode) {
        delete LiteGraph.registered_node_types[type]
      }
    })
  }
  const node = LiteGraph.createNode(type, title)
  if (!node) throw new Error('Failed to create node')
  graph.add(node)
  return node
}

export function createTestWidgetNode(graph: LGraph | Subgraph): LGraphNode {
  if (!LiteGraph.registered_node_types[WIDGET_NODE_TYPE]) {
    class WidgetTestNode extends LGraphNode {
      constructor(title: string) {
        super(title)
        this.addInput('in', 'number')
        this.addOutput('out', 'number')
        this.addWidget('text', 'text_widget', '', () => {})
        this.serialize_widgets = true
      }
    }
    LiteGraph.registered_node_types[WIDGET_NODE_TYPE] = WidgetTestNode
  }
  const node = LiteGraph.createNode(WIDGET_NODE_TYPE)
  if (!node) throw new Error('Failed to create widget node')
  graph.add(node)
  return node
}
