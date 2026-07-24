/**
 * Generic node factories for litegraph tests.
 *
 * Both helpers lazily register a node type keyed by its shape, so repeated calls
 * reuse the same registration. The types are intentionally never unregistered:
 * registration is idempotent, the key set is bounded by the distinct node shapes
 * a test file uses, and vitest isolates the registry per file.
 */
import type { ISlotType, LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

const WIDGET_NODE_TYPE = 'test/widgetNode'

/**
 * Creates a registered node with the requested slots and adds it to `graph`.
 *
 * Unlike a bare `new LGraphNode()`, the node's type exists in
 * {@link LiteGraph.registered_node_types}, so it survives a serialize/configure
 * round-trip.
 */
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
  }
  const node = LiteGraph.createNode(type, title)
  if (!node) throw new Error('Failed to create node')
  graph.add(node)
  return node
}

/**
 * Creates a registered node carrying a serializable text widget and adds it to
 * `graph`.
 */
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
