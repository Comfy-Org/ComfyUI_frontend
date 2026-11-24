import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

/** Rendered height of a Vue node header; a collapsed node is exactly this tall. */
export const VUE_NODE_HEADER_HEIGHT = 28

type SlotDirection = 'input' | 'output'

/** A node's expanded slot anchors relative to `node.pos`. */
export interface DerivedSlotAnchors {
  input: ReadonlyMap<number, Point2D>
  output: ReadonlyMap<number, Point2D>
}

const anchorsByGraph = new Map<string, Map<NodeId, DerivedSlotAnchors>>()

/** Publishes a node's derived slot anchors for link endpoints, or forgets them when `next` is undefined. */
export function setDerivedSlotAnchors(
  rootGraphId: string,
  nodeId: NodeId,
  next: DerivedSlotAnchors | undefined
) {
  const graphAnchors = anchorsByGraph.get(rootGraphId)
  if (next) {
    if (graphAnchors) graphAnchors.set(nodeId, next)
    else anchorsByGraph.set(rootGraphId, new Map([[nodeId, next]]))
    return
  }
  graphAnchors?.delete(nodeId)
  if (graphAnchors?.size === 0) anchorsByGraph.delete(rootGraphId)
}

/** An expanded slot's anchor relative to `node.pos`, from the node's derived body layout. */
export function getVueSlotAnchor(
  rootGraphId: string,
  nodeId: NodeId,
  index: number,
  direction: SlotDirection
): Point2D | undefined {
  return anchorsByGraph.get(rootGraphId)?.get(nodeId)?.[direction].get(index)
}
