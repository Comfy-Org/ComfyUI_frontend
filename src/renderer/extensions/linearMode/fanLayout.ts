interface FanLayout {
  x: number
  y: number
  rotate: number
  scale: number
  opacity: number
  z: number
}

const CARD_GAP_PX = 30
const CARD_LIFT_PX = 8
const CARD_TILT_DEG = 5
const DEPTH_SCALE_STEP = 0.06
const DEPTH_OPACITY_STEP = 0.14
const MIN_SCALE = 0.7
const MIN_OPACITY = 0.3

/**
 * Lays a card out in the generating-screen fan. Cards spread from the centre by
 * age: the oldest sit at the outer edges (alternating left/right) and the newest
 * lands dead centre, frontmost and largest.
 *
 * @param depth recency rank, 0 = newest (frontmost)
 * @param total number of cards in the fan
 */
export function computeFanLayout(depth: number, total: number): FanLayout {
  const age = total - 1 - depth // 0 = oldest
  const slot = age % 2 === 0 ? age / 2 : total - 1 - (age - 1) / 2
  const fromCenter = slot - (total - 1) / 2
  return {
    x: fromCenter * CARD_GAP_PX,
    y: Math.abs(fromCenter) * CARD_LIFT_PX,
    rotate: fromCenter * CARD_TILT_DEG,
    scale: Math.max(MIN_SCALE, 1 - depth * DEPTH_SCALE_STEP),
    opacity: Math.max(MIN_OPACITY, 1 - depth * DEPTH_OPACITY_STEP),
    z: total - depth
  }
}
