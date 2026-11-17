import type { Point } from './geometry'

/** She closes about two thirds of the remaining distance in this time. */
const CLOSING_TIME_MS = 100
/** Farther than this from her goal, she is on a trip rather than on the spot. */
const TRIP_DISTANCE = 24
/** Closer than this to her goal, she is there. */
const ARRIVED_DISTANCE = 0.5

/**
 * Where she is one frame later when she moves toward `goal`: a fixed share of
 * the remaining distance per millisecond, so a long trip starts fast and
 * settles softly, and a goal that moves is followed closely.
 */
export function stepToward(
  from: Point,
  goal: Point,
  elapsedMs: number
): { position: Point; travelling: boolean } {
  const remaining = Math.hypot(goal.x - from.x, goal.y - from.y)
  if (remaining <= ARRIVED_DISTANCE)
    return { position: goal, travelling: false }
  const left = Math.exp(-elapsedMs / CLOSING_TIME_MS)
  if (remaining * left <= ARRIVED_DISTANCE)
    return { position: goal, travelling: false }
  return {
    position: {
      x: goal.x + (from.x - goal.x) * left,
      y: goal.y + (from.y - goal.y) * left
    },
    travelling: remaining * left > TRIP_DISTANCE
  }
}
