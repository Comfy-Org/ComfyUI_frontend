import type {
  PointTuple,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'

import { anyItemOverlapsRect } from '@/utils/mathUtil'

interface BatchFramingInput {
  /** The nodes this batch added, in graph coordinates. */
  batch: readonly { pos: Readonly<PointTuple>; size: Readonly<PointTuple> }[]
  /** How many nodes are on this graph that the batch did not add. */
  nodesNotInBatch: number
  /**
   * The part of the canvas no panel covers, in graph coordinates, or null
   * when it has not been measured.
   */
  viewport: ReadOnlyRect | null
}

function isMeasured(rect: ReadOnlyRect): boolean {
  return (
    Number.isFinite(rect[0]) &&
    Number.isFinite(rect[1]) &&
    Number.isFinite(rect[2]) &&
    Number.isFinite(rect[3]) &&
    rect[2] > 0 &&
    rect[3] > 0
  )
}

/**
 * Whether the camera should be moved to an agent batch that just landed: true
 * only when the batch is the entire content of the graph, the viewport has
 * been measured, and no node of the batch is drawn inside it.
 *
 * ADR-AGENT-VIEWPORT-0062.
 */
export function shouldFrameAgentBatch({
  batch,
  nodesNotInBatch,
  viewport
}: BatchFramingInput): boolean {
  if (batch.length === 0 || nodesNotInBatch > 0) return false
  if (!viewport || !isMeasured(viewport)) return false
  return !anyItemOverlapsRect(batch, viewport)
}
