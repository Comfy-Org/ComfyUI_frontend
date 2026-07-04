import { clamp } from 'es-toolkit'

import type { NodeId, Point } from './heroGraphWires'

export const STAGE_W = 1600
export const STAGE_H = 780

export const NODE_W: Record<NodeId, number> = {
  image: 300,
  texture: 200,
  color: 210,
  lighting: 210,
  output: 760
}

// Whole graph is nudged left of the stage centre so the OUTPUT node bleeds less
// far off the right edge.
export const homePositions: Record<NodeId, Point> = {
  image: { x: 16, y: 28 },
  texture: { x: 52, y: 512 },
  color: { x: 404, y: 446 },
  lighting: { x: 662, y: 446 },
  output: { x: 956, y: 110 }
}

// Drags are confined to an invisible bounding box: the stage rect, widened
// where a node's home position already bleeds past it (the OUTPUT's
// right-edge bleed), so every node stops at the edge instead of getting cut
// off.
export function clampNodePosition(
  id: NodeId,
  point: Point,
  height: number
): Point {
  const home = homePositions[id]
  return {
    x: clamp(point.x, 0, Math.max(STAGE_W - NODE_W[id], home.x)),
    y: clamp(point.y, 0, Math.max(STAGE_H - height, home.y))
  }
}
