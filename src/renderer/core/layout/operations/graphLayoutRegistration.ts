import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Reroute } from '@/lib/litegraph/src/Reroute'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { LayoutOperationResult, Point } from '@/renderer/core/layout/types'

const groupRegistrationIds = new WeakMap<LGraphGroup, string>()
const rerouteRegistrationIds = new WeakMap<Reroute, string>()

export function canvasLayoutMutations() {
  const mutations = useLayoutMutations()
  mutations.setSource(LayoutSource.Canvas)
  return mutations
}

export function registerNodeLayout(graph: LGraph, node: LGraphNode): void {
  canvasLayoutMutations().createNode(graph.rootGraph.id, node.id, {
    position: { x: node._pos[0], y: node._pos[1] },
    size: { width: node._size[0], height: node._size[1] },
    zIndex: layoutStore.allocateZIndex(),
    visible: true
  })
  node._layoutRegistered = true
  node._geometryVersion = layoutStore.geometryVersion
}

export function unregisterNodeLayout(graph: LGraph, node: LGraphNode): void {
  if (!node._layoutRegistered) return

  layoutStore.readNodeRect(graph.rootGraph.id, node.id, node._posSize)
  node._layoutRegistered = false
  canvasLayoutMutations().deleteNode(graph.rootGraph.id, node.id)
}

export function registerGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup,
  registrationId: string
): LayoutOperationResult {
  const result = canvasLayoutMutations().createGroup(
    graph.rootGraph.id,
    group.id,
    {
      position: { x: group.pos[0], y: group.pos[1] },
      size: { width: group.size[0], height: group.size[1] }
    },
    registrationId
  )
  if (result === 'applied') groupRegistrationIds.set(group, registrationId)
  return result
}

export function unregisterGroupLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  group: LGraphGroup,
  registrationId?: string
): void {
  const resolvedRegistrationId =
    registrationId ?? groupRegistrationIds.get(group)
  if (resolvedRegistrationId === undefined) return

  canvasLayoutMutations().deleteGroup(
    graph.rootGraph.id,
    group.id,
    resolvedRegistrationId
  )
  groupRegistrationIds.delete(group)
}

export function registerRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  position: Point,
  registrationId: string
): LayoutOperationResult {
  const result = canvasLayoutMutations().createReroute(
    graph.rootGraph.id,
    reroute.id,
    position,
    registrationId
  )
  if (result === 'applied') rerouteRegistrationIds.set(reroute, registrationId)
  return result
}

export function unregisterRerouteLayout(
  graph: Pick<LGraph, 'rootGraph'>,
  reroute: Reroute,
  registrationId?: string
): void {
  const resolvedRegistrationId =
    registrationId ?? rerouteRegistrationIds.get(reroute)
  if (resolvedRegistrationId === undefined) return

  canvasLayoutMutations().deleteReroute(
    graph.rootGraph.id,
    reroute.id,
    resolvedRegistrationId
  )
  rerouteRegistrationIds.delete(reroute)
}

/**
 * Remove graph and subgraph layouts alongside node state, before clearing
 * entity containers.
 */
export function unregisterAllGraphLayout(graph: LGraph): void {
  // LGraph construction clears before a subgraph has a rootGraph.
  if (!graph.rootGraph) return

  function unregisterEntities(target: LGraph) {
    for (const node of target._nodes) {
      unregisterNodeLayout(target, node)
    }
    for (const group of target._groups) {
      unregisterGroupLayout(target, group)
    }
    for (const reroute of target.reroutes.values()) {
      unregisterRerouteLayout(target, reroute)
    }
  }

  unregisterEntities(graph)
  if (graph.isRootGraph) {
    for (const subgraph of graph._subgraphs.values()) {
      unregisterEntities(subgraph)
    }
  }
}
