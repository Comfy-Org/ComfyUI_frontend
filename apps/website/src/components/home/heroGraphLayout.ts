import { clamp } from 'es-toolkit'

import type { NodeId, Point } from './heroGraphWires'

export const STAGE_W = 1600
export const STAGE_H = 780

export const NODE_W: Record<NodeId, number> = {
  image: 300,
  texture: 190,
  color: 210,
  lighting: 210,
  output: 500
}

// Inputs stack on the left, the control chain runs under the centred headline,
// and the OUTPUT sits fully inside the right edge so nothing bleeds offscreen.
export const homePositions: Record<NodeId, Point> = {
  image: { x: 24, y: 40 },
  texture: { x: 60, y: 545 },
  color: { x: 396, y: 486 },
  lighting: { x: 650, y: 486 },
  output: { x: 1080, y: 126 }
}

// Drags are confined to an invisible bounding box — the stage rect — so every
// node stops at the edge instead of getting cut off.
export function clampNodePosition(
  id: NodeId,
  point: Point,
  height: number
): Point {
  return {
    x: clamp(point.x, 0, STAGE_W - NODE_W[id]),
    y: clamp(point.y, 0, STAGE_H - height)
  }
}
