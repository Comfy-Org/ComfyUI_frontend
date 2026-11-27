import type {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  Vector2
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { prepareNodeConstruction } from '@/lib/litegraph/src/nodeConstruction'
import type { NodeConstructionResult } from '@/lib/litegraph/src/nodeConstruction'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'

export interface DeserialisedGraphNodes {
  createdNodes: LGraphNode[]
  nodesBySourceIndex: (LGraphNode | null)[]
  failure?: {
    sourceIndex: number
    result: Exclude<NodeConstructionResult, { kind: 'created' }>
  }
}

function topLeftPosition(
  nodes: readonly { pos?: Readonly<Vector2> }[],
  fallback: Readonly<Vector2>
): Vector2 {
  const topLeft: Vector2 = [Infinity, Infinity]
  for (const { pos = fallback } of nodes) {
    if (topLeft[0] > pos[0]) topLeft[0] = pos[0]
    if (topLeft[1] > pos[1]) topLeft[1] = pos[1]
  }
  return Number.isFinite(topLeft[0]) && Number.isFinite(topLeft[1])
    ? topLeft
    : [fallback[0], fallback[1]]
}

function constructRequiredBatch(
  nodes: readonly { type: string }[],
  graph: LGraph,
  configureAndAdd: (node: LGraphNode, sourceIndex: number) => void
): DeserialisedGraphNodes {
  const previousLastNodeId = graph.last_node_id
  const preparations = nodes.map(({ type }) =>
    prepareNodeConstruction(LiteGraph, { type, graph })
  )
  const receipts: Extract<NodeConstructionResult, { kind: 'created' }>[] = []
  const attached: LGraphNode[] = []
  const cleanup = () => {
    for (const receipt of receipts) {
      if (!attached.includes(receipt.node))
        receipt.cancelUnattachedSubscriptions()
    }
    for (const node of [...attached].reverse()) {
      try {
        graph.remove(node, { preserveSubgraphDefinitions: true })
      } catch (error) {
        console.error(error)
      }
    }
  }
  const fail = (
    failure: NonNullable<DeserialisedGraphNodes['failure']>
  ): DeserialisedGraphNodes => {
    cleanup()
    graph.last_node_id = previousLastNodeId
    const { result } = failure
    if (result.kind === 'failed') console.error(result.cause)
    else if (result.reason === 'missing-owned-definition') result.report()
    return {
      createdNodes: [],
      nodesBySourceIndex: preparations.map(() => null),
      failure
    }
  }
  const refusedIndex = preparations.findIndex(
    (prepared) => prepared.kind === 'refused'
  )
  const refusal = preparations.at(refusedIndex)
  if (refusal?.kind === 'refused')
    return fail({ sourceIndex: refusedIndex, result: refusal })

  for (const [sourceIndex, prepared] of preparations.entries()) {
    const result = prepared.kind === 'ready' ? prepared.construct() : prepared
    if (result.kind !== 'created') return fail({ sourceIndex, result })
    receipts.push(result)
    try {
      configureAndAdd(result.node, sourceIndex)
      attached.push(result.node)
    } catch (error) {
      cleanup()
      graph.last_node_id = previousLastNodeId
      throw error
    }
    const staleIndex = receipts.findIndex(
      (receipt) =>
        !receipt.isCurrent() ||
        receipt.node.graph !== graph ||
        !graph.nodes.includes(receipt.node)
    )
    if (staleIndex !== -1)
      return fail({
        sourceIndex: staleIndex,
        result: {
          kind: 'refused',
          reason: 'stale-preparation',
          type: nodes[staleIndex].type
        }
      })
  }

  return {
    createdNodes: attached,
    nodesBySourceIndex: attached
  }
}

function configureNode(
  node: LGraphNode,
  info: Parameters<LGraphNode['configure']>[0],
  graph: LGraph,
  position: Readonly<Vector2>,
  topLeft: Readonly<Vector2>
) {
  node.configure(info)
  node.pos = [
    node.pos[0] + position[0] - topLeft[0],
    node.pos[1] + position[1] - topLeft[1]
  ]
  withNodeAddSource('paste', () => graph.add(node, true))
}

export function deserialiseIntoGraphWithSourceIndices(
  data: string,
  graph: LGraph,
  position: Readonly<Vector2>,
  options: { requireAll?: boolean } = {}
): DeserialisedGraphNodes {
  const deserialised = JSON.parse(data)
  const topLeft = topLeftPosition(deserialised.nodes, position)
  if (options.requireAll) {
    const batch = constructRequiredBatch(
      deserialised.nodes,
      graph,
      (node, sourceIndex) =>
        configureNode(
          node,
          deserialised.nodes[sourceIndex],
          graph,
          position,
          topLeft
        )
    )
    if (batch.failure) return batch
    restoreLinks(deserialised.links, batch.nodesBySourceIndex)
    return batch
  }

  const nodesBySourceIndex: (LGraphNode | null)[] = []
  for (const info of deserialised.nodes) {
    const node = LiteGraph.createNode(info.type, undefined, {
      targetGraph: graph
    })
    nodesBySourceIndex.push(node)
    if (!node) continue
    configureNode(node, info, graph, position, topLeft)
  }

  restoreLinks(deserialised.links, nodesBySourceIndex)
  const createdNodes = nodesBySourceIndex.filter(
    (node): node is LGraphNode => node !== null
  )
  return { createdNodes, nodesBySourceIndex }
}

function restoreLinks(
  links: readonly (readonly [number | null, number, number, number])[],
  nodesBySourceIndex: readonly (LGraphNode | null)[]
) {
  for (const info of links) {
    const relativeId = info[0]
    const outNode =
      relativeId != null ? nodesBySourceIndex[relativeId] : undefined

    const inNode = nodesBySourceIndex[info[2]]
    if (outNode && inNode) outNode.connect(info[1], inNode, info[3])
    else console.warn('Warning, nodes missing on pasting')
  }
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
