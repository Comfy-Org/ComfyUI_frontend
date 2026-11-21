import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'

/** Inserts legacy relative-index payloads, configuring nodes before graph attachment. */
export function deserialiseAndCreate(data: string, canvas: LGraphCanvas): void {
  if (!data) return

  const { graph, graph_mouse } = canvas
  if (!graph) return
  canvas.emitBeforeChange()
  try {
    graph.beforeChange()

    const deserialised = JSON.parse(data)
    const topLeft = [Infinity, Infinity]
    for (const { pos } of deserialised.nodes) {
      if (topLeft[0] > pos[0]) topLeft[0] = pos[0]
      if (topLeft[1] > pos[1]) topLeft[1] = pos[1]
    }

    if (!Number.isFinite(topLeft[0]) || !Number.isFinite(topLeft[1])) {
      topLeft[0] = graph_mouse[0]
      topLeft[1] = graph_mouse[1]
    }

    const nodes: LGraphNode[] = []
    for (const info of deserialised.nodes) {
      const node = LiteGraph.createNode(info.type)
      if (!node) continue

      node.configure(info)
      node.pos = [
        node.pos[0] + graph_mouse[0] - topLeft[0],
        node.pos[1] + graph_mouse[1] - topLeft[1]
      ]

      withNodeAddSource('paste', () => graph.add(node, true))
      nodes.push(node)
    }

    for (const info of deserialised.links) {
      const relativeId = info[0]
      const outNode = relativeId != null ? nodes[relativeId] : undefined

      const inNode = nodes[info[2]]
      if (outNode) outNode.connect(info[1], inNode, info[3])
      else console.warn('Warning, nodes missing on pasting')
    }

    canvas.selectNodes(nodes)
    graph.afterChange()
  } finally {
    canvas.emitAfterChange()
  }
}
