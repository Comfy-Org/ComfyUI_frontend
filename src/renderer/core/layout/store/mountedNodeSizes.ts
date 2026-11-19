import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { Size2D } from '@comfyorg/shared-frontend-utils/geometry'

const views = new WeakMap<object, Map<NodeId, MountedNodeSize>>()

interface MountedNodeSize {
  size?: Size2D
  collapsed?: boolean
  retire: () => void
}

export function readMountedNodeSize(
  graph: object,
  id: NodeId,
  { collapsed }: { collapsed: boolean }
) {
  const view = views.get(graph)?.get(id)
  return view?.collapsed === collapsed ? view.size : undefined
}

export function bindMountedNodeSize(
  graph: object,
  id: NodeId,
  retire: () => void
) {
  let nodes = views.get(graph)
  if (!nodes) views.set(graph, (nodes = new Map()))
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
      if (nodes.get(id) === view) nodes.delete(id)
    }
  }
}

export function retireMountedNodeSize(graph: object, id: NodeId) {
  const nodes = views.get(graph)
  const view = nodes?.get(id)
  if (view && nodes?.delete(id)) view.retire()
}

export function retireMountedGraphSizes(graph: object) {
  const nodes = views.get(graph)
  if (!nodes) return
  views.delete(graph)
  for (const view of nodes.values()) view.retire()
  nodes.clear()
}
