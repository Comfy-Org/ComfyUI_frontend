/**
 * Layout registration for litegraph entities.
 *
 * Geometry joins and leaves the layout store with the entity that owns it, so
 * every attach/detach path goes through these helpers.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

/** Layout mutations attributed to the canvas, for direct delete calls. */
export function canvasLayoutMutations() {
  const mutations = useLayoutMutations()
  mutations.setSource(LayoutSource.Canvas)
  return mutations
}

/**
 * @param zIndex Stacking order at attach — the node's index in
 * {@link LGraph._nodes} at the moment it was added. Never re-derived, so
 * removals and `bringToFront` leave it stale and values can repeat; treat it as
 * a starting position, not a live index. Not {@link LGraphNode.order}, which is
 * execution order and unrelated to stacking.
 */
export function registerNodeLayout(node: LGraphNode, zIndex: number): void {
  canvasLayoutMutations().createNode(node.id, {
    position: { x: node.pos[0], y: node.pos[1] },
    size: { width: node.size[0], height: node.size[1] },
    zIndex,
    visible: true
  })
}

export function registerGroupLayout(graph: LGraph, group: LGraphGroup): void {
  canvasLayoutMutations().createGroup(graph.rootGraph.id, group.id, {
    position: { x: group.pos[0], y: group.pos[1] },
    size: { width: group.size[0], height: group.size[1] }
  })
}

/**
 * Drops every layout entry a graph owns, including those inside the subgraph
 * definitions it holds. Mirrors `unregisterAllNodeStates`; call it from the
 * same places, before the entity containers are emptied.
 */
export function unregisterAllGraphLayout(graph: LGraph): void {
  // `LGraph`'s own constructor clears the graph, before a subgraph has a
  // `rootGraph` to scope keys by.
  if (!graph.rootGraph) return

  const rootGraphId = graph.rootGraph.id
  const mutations = canvasLayoutMutations()

  for (const node of graph._nodes) mutations.deleteNode(node.id)
  for (const group of graph._groups) {
    mutations.deleteGroup(rootGraphId, group.id)
  }
  for (const rerouteId of graph.reroutes.keys()) {
    mutations.deleteReroute(rootGraphId, rerouteId)
  }

  for (const subgraph of graph._subgraphs.values()) {
    unregisterAllGraphLayout(subgraph)
  }
}
