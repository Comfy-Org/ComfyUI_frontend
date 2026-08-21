import type { Bounds, NodeId } from '@/renderer/core/layout/types'

const VIEWPORT_MARGIN_RATIO = 0.5
const MAX_MARGIN_GRAPH_UNITS = 2000
const GATE_HYSTERESIS = 0.9

interface Size {
  width: number
  height: number
}

interface Camera {
  x: number
  y: number
  z: number
}

interface VisibilitySnapshot {
  nodeIds: readonly NodeId[]
  mountedNodeIds: ReadonlySet<NodeId>
  viewportNodeIds: Iterable<NodeId>
  pinnedNodeIds?: ReadonlySet<NodeId>
  alwaysMountedNodeIds?: ReadonlySet<NodeId>
  cullingEnabled: boolean
  cullingLatched: boolean
  minNodesForCulling: number
  viewportResolved: boolean
}

export interface VisibilityDecision {
  desiredNodeIds: Set<NodeId>
  cullingLatched: boolean
}

export function getNextCullingLatch(
  nodeCount: number,
  cullingEnabled: boolean,
  cullingLatched: boolean,
  minNodesForCulling: number
): boolean {
  if (!cullingEnabled) return false
  return cullingLatched
    ? nodeCount >= minNodesForCulling * GATE_HYSTERESIS
    : nodeCount >= minNodesForCulling
}

export function getCullingBounds(
  camera: Camera,
  viewport: Size,
  marginRatio = VIEWPORT_MARGIN_RATIO
): Bounds {
  const scale = camera.z || 1
  const marginX = Math.min(
    (viewport.width * marginRatio) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )
  const marginY = Math.min(
    (viewport.height * marginRatio) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )

  return {
    x: -marginX - camera.x,
    y: -marginY - camera.y,
    width: viewport.width / scale + marginX * 2,
    height: viewport.height / scale + marginY * 2
  }
}

export function decideViewportVisibility({
  nodeIds,
  mountedNodeIds,
  viewportNodeIds,
  pinnedNodeIds,
  alwaysMountedNodeIds,
  cullingEnabled,
  cullingLatched,
  minNodesForCulling,
  viewportResolved
}: VisibilitySnapshot): VisibilityDecision {
  const nextLatched = getNextCullingLatch(
    nodeIds.length,
    cullingEnabled,
    cullingLatched,
    minNodesForCulling
  )

  if (!nextLatched) {
    return { desiredNodeIds: new Set(nodeIds), cullingLatched: false }
  }

  const knownNodeIds = new Set(nodeIds)
  const desiredNodeIds = new Set<NodeId>()

  if (viewportResolved) {
    for (const nodeId of viewportNodeIds) {
      if (knownNodeIds.has(nodeId)) desiredNodeIds.add(nodeId)
    }
  } else {
    for (const nodeId of mountedNodeIds) {
      if (knownNodeIds.has(nodeId)) desiredNodeIds.add(nodeId)
    }
  }

  for (const nodeId of pinnedNodeIds ?? []) {
    if (knownNodeIds.has(nodeId) && mountedNodeIds.has(nodeId)) {
      desiredNodeIds.add(nodeId)
    }
  }
  for (const nodeId of alwaysMountedNodeIds ?? []) {
    if (knownNodeIds.has(nodeId)) desiredNodeIds.add(nodeId)
  }

  return { desiredNodeIds, cullingLatched: true }
}
