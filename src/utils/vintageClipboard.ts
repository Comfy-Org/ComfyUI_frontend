import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'

/**
 * Deserialises nodes and links using a modified version of the old Litegraph (copy &) paste function
 * @param data The serialised nodes and links to create
 * @param canvas The canvas to create the serialised items in
 */
export function deserialiseAndCreate(data: string, canvas: LGraphCanvas): void {
  if (!data) return

  const { graph, graph_mouse } = canvas
  canvas.emitBeforeChange()
  try {
    // @ts-expect-error fixme ts strict error
    graph.beforeChange()

    const deserialised = JSON.parse(data)

    // Find the top left point of the boundary of all pasted nodes
    const topLeft = [Infinity, Infinity]
    for (const { pos } of deserialised.nodes) {
      if (topLeft[0] > pos[0]) topLeft[0] = pos[0]
      if (topLeft[1] > pos[1]) topLeft[1] = pos[1]
    }

    // Silent default instead of throw
    if (!Number.isFinite(topLeft[0]) || !Number.isFinite(topLeft[1])) {
      topLeft[0] = graph_mouse[0]
      topLeft[1] = graph_mouse[1]
    }

    // Create nodes
    const nodes: LGraphNode[] = []
    for (const info of deserialised.nodes) {
      const node = LiteGraph.createNode(info.type)
      if (!node) continue

      node.configure(info)

      // Paste to the bottom right of pointer
      node.pos[0] += graph_mouse[0] - topLeft[0]
      node.pos[1] += graph_mouse[1] - topLeft[1]

      // @ts-expect-error fixme ts strict error
      withNodeAddSource('paste', () => graph.add(node, true))
      nodes.push(node)
    }

    // Create links
    for (const info of deserialised.links) {
      const relativeId = info[0]
      const outNode = relativeId != null ? nodes[relativeId] : undefined

      const inNode = nodes[info[2]]
      if (outNode && inNode) outNode.connect(info[1], inNode, info[3])
      else console.warn('Warning, nodes missing on pasting')
    }

    canvas.selectNodes(nodes)

    // @ts-expect-error fixme ts strict error
    graph.afterChange()
  } finally {
    canvas.emitAfterChange()
  }
}
