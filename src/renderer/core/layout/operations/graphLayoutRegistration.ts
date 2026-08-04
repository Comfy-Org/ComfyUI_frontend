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

export function unregisterNodeLayout(
  graph: LGraph,
  node: LGraphNode
): LayoutOperationResult {
  if (!node._layoutRegistered) return 'no-op'

  layoutStore.readNodeRect(graph.rootGraph.id, node.id, node._posSize)
  const result = canvasLayoutMutations().deleteNode(graph.rootGraph.id, node.id)
  if (result !== 'rejected') node._layoutRegistered = false
  return result
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
): LayoutOperationResult {
  const resolvedRegistrationId =
    registrationId ?? groupRegistrationIds.get(group)
  if (resolvedRegistrationId === undefined) return 'no-op'

  const result = canvasLayoutMutations().deleteGroup(
    graph.rootGraph.id,
    group.id,
    resolvedRegistrationId
  )
  if (result !== 'rejected') groupRegistrationIds.delete(group)
  return result
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
): LayoutOperationResult {
  const resolvedRegistrationId =
    registrationId ?? rerouteRegistrationIds.get(reroute)
  if (resolvedRegistrationId === undefined) return 'no-op'

  const result = canvasLayoutMutations().deleteReroute(
    graph.rootGraph.id,
    reroute.id,
    resolvedRegistrationId
  )
  if (result !== 'rejected') rerouteRegistrationIds.delete(reroute)
  return result
}

/**
 * Remove graph and subgraph layouts alongside node state, before clearing
 * entity containers.
 */
export function unregisterAllGraphLayout(graph: LGraph): LayoutOperationResult {
  let result: LayoutOperationResult = 'no-op'

  // LGraph construction clears before a subgraph has a rootGraph.
  if (!graph.rootGraph) return result

  function unregisterEntities(target: LGraph): LayoutOperationResult {
    let targetResult: LayoutOperationResult = 'no-op'

    for (const node of target._nodes) {
      const nodeResult = unregisterNodeLayout(target, node)
      if (nodeResult === 'rejected') return 'rejected'
      if (nodeResult === 'applied') targetResult = 'applied'
    }
    for (const group of target._groups) {
      const groupResult = unregisterGroupLayout(target, group)
      if (groupResult === 'rejected') return 'rejected'
      if (groupResult === 'applied') targetResult = 'applied'
    }
    for (const reroute of target.reroutes.values()) {
      const rerouteResult = unregisterRerouteLayout(target, reroute)
      if (rerouteResult === 'rejected') return 'rejected'
      if (rerouteResult === 'applied') targetResult = 'applied'
    }

    return targetResult
  }

  const graphResult = unregisterEntities(graph)
  if (graphResult === 'rejected') return 'rejected'
  if (graphResult === 'applied') result = 'applied'

  if (graph.isRootGraph) {
    for (const subgraph of graph._subgraphs.values()) {
      const subgraphResult = unregisterEntities(subgraph)
      if (subgraphResult === 'rejected') return 'rejected'
      if (subgraphResult === 'applied') result = 'applied'
    }
  }

  return result
}
