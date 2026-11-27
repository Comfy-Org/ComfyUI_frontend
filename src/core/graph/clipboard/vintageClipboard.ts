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

function topLeftPosition(
  nodes: readonly { pos: Readonly<Vector2> }[],
  fallback: Readonly<Vector2>
): Vector2 {
  const topLeft: Vector2 = [Infinity, Infinity]
  for (const { pos } of nodes) {
    if (topLeft[0] > pos[0]) topLeft[0] = pos[0]
    if (topLeft[1] > pos[1]) topLeft[1] = pos[1]
  }
  return Number.isFinite(topLeft[0]) && Number.isFinite(topLeft[1])
    ? topLeft
    : [fallback[0], fallback[1]]
}

function createUnconfiguredNodes(
  nodes: readonly { type: string }[],
  graph: LGraph
): (LGraphNode | null)[] {
  return nodes.map(({ type }) =>
    LiteGraph.createNode(type, undefined, { targetGraph: graph })
  )
}

/** Creates serialised nodes and links while retaining the source index of refused nodes. */
export function deserialiseIntoGraphWithSourceIndices(
  data: string,
  graph: LGraph,
  position: Readonly<Vector2>,
  options: { requireAll?: boolean } = {}
): DeserialisedGraphNodes {
  const deserialised = JSON.parse(data)
  const topLeft = topLeftPosition(deserialised.nodes, position)
  const precreated = options.requireAll
    ? createUnconfiguredNodes(deserialised.nodes, graph)
    : undefined
  if (precreated?.some((node) => node === null)) {
    return { createdNodes: [], nodesBySourceIndex: precreated }
  }
  const nodesBySourceIndex: (LGraphNode | null)[] = precreated ?? []

  for (const [index, info] of deserialised.nodes.entries()) {
    const node = precreated
      ? nodesBySourceIndex[index]
      : LiteGraph.createNode(info.type, undefined, { targetGraph: graph })
    if (!precreated) nodesBySourceIndex.push(node)
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
