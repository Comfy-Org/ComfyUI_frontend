import type {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  Vector2
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'

export interface DeserialisedGraphNodes {
  createdNodes: LGraphNode[]
  nodesBySourceIndex: (LGraphNode | null)[]
}

/** Creates serialised nodes and links while retaining the source index of refused nodes. */
export function deserialiseIntoGraphWithSourceIndices(
  data: string,
  graph: LGraph,
  position: Readonly<Vector2>
): DeserialisedGraphNodes {
  const deserialised = JSON.parse(data)

  const topLeft = [Infinity, Infinity]
  for (const { pos } of deserialised.nodes) {
    if (topLeft[0] > pos[0]) topLeft[0] = pos[0]
    if (topLeft[1] > pos[1]) topLeft[1] = pos[1]
  }

  if (!Number.isFinite(topLeft[0]) || !Number.isFinite(topLeft[1])) {
    topLeft[0] = position[0]
    topLeft[1] = position[1]
  }

  const nodesBySourceIndex: (LGraphNode | null)[] = []
  for (const info of deserialised.nodes) {
    const node = LiteGraph.createNode(info.type, undefined, {
      targetGraph: graph
    })
    nodesBySourceIndex.push(node)
    if (!node) continue

    node.configure(info)

    node.pos = [
      node.pos[0] + position[0] - topLeft[0],
      node.pos[1] + position[1] - topLeft[1]
    ]

    withNodeAddSource('paste', () => graph.add(node, true))
  }

  for (const info of deserialised.links) {
    const relativeId = info[0]
    const outNode =
      relativeId != null ? nodesBySourceIndex[relativeId] : undefined

    const inNode = nodesBySourceIndex[info[2]]
    if (outNode && inNode) outNode.connect(info[1], inNode, info[3])
    else console.warn('Warning, nodes missing on pasting')
  }
  const createdNodes = nodesBySourceIndex.filter(
    (node): node is LGraphNode => node !== null
  )
  return { createdNodes, nodesBySourceIndex }
}

/** Creates serialised nodes and links in `graph` at `position`; returns created nodes in source order. */
export function deserialiseIntoGraph(
  data: string,
  graph: LGraph,
  position: Readonly<Vector2>
): LGraphNode[] {
  return deserialiseIntoGraphWithSourceIndices(data, graph, position)
    .createdNodes
}

/** Inserts legacy relative-index payloads, configuring nodes before graph attachment. */
export function deserialiseAndCreate(data: string, canvas: LGraphCanvas): void {
  if (!data) return

  const { graph, graph_mouse } = canvas
  if (!graph) return
  canvas.emitBeforeChange()
  try {
    graph.beforeChange()
    canvas.selectNodes(deserialiseIntoGraph(data, graph, graph_mouse))
    graph.afterChange()
  } finally {
    canvas.emitAfterChange()
  }
}
