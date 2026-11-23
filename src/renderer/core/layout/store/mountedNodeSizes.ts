import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { Size2D } from '@comfyorg/shared-frontend-utils/geometry'

const views = new WeakMap<
  object,
  Map<string | null, Map<NodeId, MountedNodeSize>>
>()

interface MountedGraph {
  readonly rootGraph: object
  readonly isRootGraph: boolean
  readonly id: string
}

export function mountedGraphScope(graph: MountedGraph): string | null {
  return graph.isRootGraph ? null : graph.id
}

interface MountedNodeSize {
  size?: Size2D
  collapsed?: boolean
  retire: () => void
}

export function readMountedNodeSize(
  graph: MountedGraph,
  id: NodeId,
  { collapsed }: { collapsed: boolean }
) {
  const view = views
    .get(graph.rootGraph)
    ?.get(mountedGraphScope(graph))
    ?.get(id)
  return view?.collapsed === collapsed ? view.size : undefined
}

export function bindMountedNodeSize(
  graph: MountedGraph,
  id: NodeId,
  retire: () => void
) {
  const { rootGraph } = graph
  const scope = mountedGraphScope(graph)
  let graphs = views.get(rootGraph)
  if (!graphs) views.set(rootGraph, (graphs = new Map()))
  let nodes = graphs.get(scope)
  if (!nodes) graphs.set(scope, (nodes = new Map()))
  const view: MountedNodeSize = { retire }
  nodes.set(id, view)
  return {
    report(size: Size2D, collapsed: boolean) {
      if (nodes.get(id) !== view) return false
      if (
        view.collapsed === collapsed &&
        view.size?.width === size.width &&
        view.size.height === size.height
      )
        return false
      view.collapsed = collapsed
      view.size = size
      return true
    },
    dispose() {
      if (nodes.get(id) !== view) return
      nodes.delete(id)
      if (nodes.size === 0) graphs.delete(scope)
    }
  }
}

export function retireMountedNodeSize(graph: MountedGraph, id: NodeId) {
  const nodes = views.get(graph.rootGraph)?.get(mountedGraphScope(graph))
  const view = nodes?.get(id)
  if (view && nodes?.delete(id)) view.retire()
}

export function retireMountedGraphSizes(graph: MountedGraph) {
  const graphs = views.get(graph.rootGraph)
  if (!graphs) return
  const scope = mountedGraphScope(graph)
  const groups = graph.isRootGraph ? [...graphs.values()] : [graphs.get(scope)]
  if (graph.isRootGraph) views.delete(graph.rootGraph)
  else graphs.delete(scope)
  for (const nodes of groups) {
    if (!nodes) continue
    for (const view of nodes.values()) view.retire()
    nodes.clear()
  }
}
