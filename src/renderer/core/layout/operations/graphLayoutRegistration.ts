/**
 * Layout registration for litegraph entities.
 *
 * Geometry joins and leaves the layout store with the entity that owns it, so
 * every attach/detach path — including bulk teardown — goes through these
 * helpers rather than re-deriving the store writes by hand.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { RerouteId } from '@/renderer/core/layout/types'

type GraphLayoutOwner = Pick<
  LGraph,
  '_nodes' | '_groups' | '_subgraphs' | 'reroutes' | 'rootGraph'
>

function canvasMutations() {
  const mutations = useLayoutMutations()
  mutations.setSource(LayoutSource.Canvas)
  return mutations
}

/**
 * @param zIndex Draw order — the node's index in {@link LGraph._nodes}. Not
 * {@link LGraphNode.order}, which is execution order and unrelated to stacking.
 */
export function registerNodeLayout(
  node: Pick<LGraphNode, 'id' | 'pos' | 'size'>,
  zIndex: number
): void {
  canvasMutations().createNode(node.id, {
    position: { x: node.pos[0], y: node.pos[1] },
    size: { width: node.size[0], height: node.size[1] },
    zIndex,
    visible: true
  })
}

export function unregisterNodeLayout(node: Pick<LGraphNode, 'id'>): void {
  canvasMutations().deleteNode(node.id)
}

export function registerGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: Pick<LGraphGroup, 'id' | 'pos' | 'size'>
): void {
  canvasMutations().createGroup(graph.rootGraph.id, group.id, {
    position: { x: group.pos[0], y: group.pos[1] },
    size: { width: group.size[0], height: group.size[1] }
  })
}

export function unregisterGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: Pick<LGraphGroup, 'id'>
): void {
  canvasMutations().deleteGroup(graph.rootGraph.id, group.id)
}

export function unregisterRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  rerouteId: RerouteId
): void {
  canvasMutations().deleteReroute(graph.rootGraph.id, rerouteId)
}

/**
 * Drops every layout entry a graph owns, including those inside the subgraph
 * definitions it holds. Mirrors `unregisterAllNodeStates`; call it from the
 * same places, before the entity containers are emptied.
 */
export function unregisterAllGraphLayout(graph: GraphLayoutOwner): void {
  // `LGraph`'s own constructor clears the graph, before a subgraph has a
  // `rootGraph` to scope keys by. An empty graph owns nothing to drop anyway.
  if (graph._nodes.length || graph._groups.length || graph.reroutes.size) {
    const rootGraphId = graph.rootGraph.id
    const mutations = canvasMutations()

    for (const node of graph._nodes) mutations.deleteNode(node.id)
    for (const group of graph._groups) {
      mutations.deleteGroup(rootGraphId, group.id)
    }
    for (const rerouteId of graph.reroutes.keys()) {
      mutations.deleteReroute(rootGraphId, rerouteId)
    }
  }

  for (const subgraph of graph._subgraphs.values()) {
    unregisterAllGraphLayout(subgraph)
  }
}
