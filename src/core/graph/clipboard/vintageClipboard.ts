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

function constructBatch(
  nodes: readonly { type: string }[],
  graph: LGraph
): DeserialisedGraphNodes {
  const preparations = nodes.map(({ type }) =>
    prepareNodeConstruction(LiteGraph, { type, graph })
  )
  const staged: Extract<NodeConstructionResult, { kind: 'created' }>[] = []
  const fail = (
    failure: NonNullable<DeserialisedGraphNodes['failure']>
  ): DeserialisedGraphNodes => {
    for (const built of staged) built.cancelUnattachedSubscriptions()
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
    staged.push(result)
  }
  const staleIndex = staged.findIndex((built) => !built.isCurrent())
  if (staleIndex !== -1)
    return fail({
      sourceIndex: staleIndex,
      result: {
        kind: 'refused',
        reason: 'stale-preparation',
        type: nodes[staleIndex].type
      }
    })

  const createdNodes = staged.map(({ node }) => node)
  return { createdNodes, nodesBySourceIndex: createdNodes }
}

export function deserialiseIntoGraphWithSourceIndices(
  data: string,
  graph: LGraph,
  position: Readonly<Vector2>,
  options: { requireAll?: boolean } = {}
): DeserialisedGraphNodes {
  const deserialised = JSON.parse(data)
  const batch = options.requireAll
    ? constructBatch(deserialised.nodes, graph)
    : undefined
  if (batch?.failure) return batch
  const nodesBySourceIndex = batch?.nodesBySourceIndex ?? []
  const topLeft = topLeftPosition(deserialised.nodes, position)
  for (const [index, info] of deserialised.nodes.entries()) {
    const node = options.requireAll
      ? nodesBySourceIndex[index]
      : LiteGraph.createNode(info.type, undefined, { targetGraph: graph })
    if (!options.requireAll) nodesBySourceIndex.push(node)
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
