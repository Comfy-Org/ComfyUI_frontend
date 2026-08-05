import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'

export function canvasLayoutMutations() {
  const mutations = useLayoutMutations()
  mutations.setSource(LayoutSource.Canvas)
  return mutations
}

export function registerNodeLayout(graph: LGraph, node: LGraphNode): void {
  canvasLayoutMutations().createNode(graph.rootGraph.id, node.id, {
    position: { x: node.pos[0], y: node.pos[1] },
    size: { width: node.size[0], height: node.size[1] },
    zIndex: layoutStore.allocateZIndex(),
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
 * Remove graph and subgraph layouts alongside node state, before clearing
 * entity containers.
 */
export function unregisterAllGraphLayout(graph: LGraph): void {
  // LGraph construction clears before a subgraph has a rootGraph.
  if (!graph.rootGraph) return

  const rootGraphId = graph.rootGraph.id
  const mutations = canvasLayoutMutations()

  function unregisterEntities(target: LGraph) {
    for (const node of target._nodes) {
      mutations.deleteNode(rootGraphId, node.id)
    }
    for (const group of target._groups) {
      mutations.deleteGroup(rootGraphId, group.id)
    }
    for (const rerouteId of target.reroutes.keys()) {
      mutations.deleteReroute(rootGraphId, rerouteId)
    }
  }

  unregisterEntities(graph)
  if (graph.isRootGraph) {
    for (const subgraph of graph._subgraphs.values()) {
      unregisterEntities(subgraph)
    }
  }
}
