import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'

/**
 * Whether the camera should be moved to an agent batch that just landed.
 *
 * ADR-AGENT-VIEWPORT-0062. ADR-CRDT-PLACEMENT-0035 deliberately exempts an
 * empty canvas from repositioning, so that an agent-inserted template keeps
 * the layout its author baked in, "matching the human template flow". The
 * human template flow also frames it — `app.ts` calls `fitView()` for
 * `openSource === 'template'` — and the agent flow did not, so a template
 * whose own coordinates sit far from the origin was applied correctly and
 * stayed off screen (PM-2072, the 2026-10-20 report: nine nodes applied at
 * y 4850-5930 on a fresh tab, canvas visibly empty).
 *
 * The answer is the camera, not the coordinates: moving the batch would make
 * persisted node positions a function of wherever the viewer's camera
 * happened to be, which the deterministic applier (keep-alive invariant #4)
 * and the layout/view split (#8) both forbid. The camera is local,
 * ephemeral, FE-owned view state, so moving it engages no replication
 * invariant at all.
 */
interface BatchFramingInput {
  /**
   * The batch's hull in graph coordinates, or null when it has no measurable
   * extent yet.
   */
  batch: ReadOnlyRect | null
  /**
   * How many nodes are on this graph that the batch did not add. Framing is
   * restricted to the empty-canvas case: once the user has their own content
   * on screen, ADR-CRDT-PLACEMENT-0035 has already parked the batch beside it,
   * and taking the camera off what the user was looking at is a worse defect
   * than the one being fixed.
   */
  nodesNotInBatch: number
  /** The camera's visible area in graph coordinates, or null when unknown. */
  viewport: ReadOnlyRect | null
}

function intersects(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  return (
    a[0] < b[0] + b[2] &&
    b[0] < a[0] + a[2] &&
    a[1] < b[1] + b[3] &&
    b[1] < a[1] + a[3]
  )
}

/**
 * True only when the batch is the entire content of the graph and none of it
 * is on screen — i.e. the user is looking at an empty canvas that is not
 * empty.
 *
 * Deliberately false when the viewport is unknown: an unmeasured camera is
 * not evidence that the batch is invisible, and a wrong move costs the user
 * their position.
 */
export function shouldFrameAgentBatch({
  batch,
  nodesNotInBatch,
  viewport
}: BatchFramingInput): boolean {
  if (!batch || !viewport) return false
  if (nodesNotInBatch > 0) return false
  if (!(batch[2] > 0) || !(batch[3] > 0)) return false
  return !intersects(viewport, batch)
}
