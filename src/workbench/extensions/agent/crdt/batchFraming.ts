import type {
  PointTuple,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'

import { anyItemOverlapsRect } from '@/utils/mathUtil'

interface BatchFramingInput {
  batch: readonly { pos: Readonly<PointTuple>; size: Readonly<PointTuple> }[]
  nodesNotInBatch: number
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

/** Returns whether a whole-graph batch is outside the measured viewport. */
export function shouldFrameAgentBatch({
  batch,
  nodesNotInBatch,
  viewport
}: BatchFramingInput): boolean {
  if (batch.length === 0 || nodesNotInBatch > 0) return false
  if (!viewport || !isMeasured(viewport)) return false
  return !anyItemOverlapsRect(batch, viewport)
}
