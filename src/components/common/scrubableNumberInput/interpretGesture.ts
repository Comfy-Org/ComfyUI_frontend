/**
 * Pure algorithmic core of the Tweeq-style drag scrub. No Vue, no DOM.
 *
 * Given a smoothed direction average and the current sensitivity multiplier,
 * decides how much of an incoming pointer delta becomes a value change
 * (X-axis intent) vs. a sensitivity change (Y-axis intent), with a smooth
 * crossfade between the two so diagonal motion never feels jerky.
 */

export interface GestureState {
  /** EMA of |delta|, normalized to unit length. */
  dirAvg: [number, number]
  /** Current sensitivity multiplier. */
  speedMult: number
  /** Value-units per pixel at speedMult = 1. */
  baseSpeed: number
  /** Lower clamp on speedMult. Default 1e-4. */
  minSpeed?: number
  /** Upper clamp on speedMult. Default 1 (bounded) or 1000 (unbounded). */
  maxSpeed?: number
  /** Extra multiplier from external sources (modifier keys). Default 1. */
  modifierSpeed?: number
}

interface GestureUpdate {
  dirAvgNext: [number, number]
  /** How "horizontal" the gesture is, ∈ [0, 1]. */
  weight: number
  /** Amount to add to the value this tick. */
  valueDelta: number
  /** New sensitivity multiplier (already clamped). */
  speedMultNext: number
}

export function interpretGesture(
  state: GestureState,
  dx: number,
  dy: number
): GestureUpdate {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  const dirAvgNext = normalize([
    state.dirAvg[0] * 0.9 + absX * 0.1,
    state.dirAvg[1] * 0.9 + absY * 0.1
  ])

  const weight = smoothstep(0.4, 0.6, Math.abs(dirAvgNext[0]))

  const modifierSpeed = state.modifierSpeed ?? 1
  const valueDelta =
    dx * state.baseSpeed * state.speedMult * modifierSpeed * weight

  const speedMultRaw = state.speedMult * Math.pow(0.98, dy)
  const speedMultNext = clamp(
    speedMultRaw * (1 - weight) + state.speedMult * weight,
    state.minSpeed ?? 1e-4,
    state.maxSpeed ?? 1
  )

  return { dirAvgNext, weight, valueDelta, speedMultNext }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function normalize([x, y]: readonly [number, number]): [number, number] {
  const m = Math.hypot(x, y) || 1
  return [x / m, y / m]
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}
