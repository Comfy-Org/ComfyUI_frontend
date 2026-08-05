/** Motion model for the hero's idle self-demo. Kept free of Vue and DOM so the
 * curve can be exercised directly; `useIdleAutoplay` owns the wiring.
 *
 * The demo moves like a person browsing poses: ease to a pose, settle, hold,
 * then move to the next. Every stop lands exactly on a shipped render —
 * azimuth on a 45-degree bucket, elevation alternating between the eye-level
 * and elevated rings, zoom pinned to the medium shot — so the OUTPUT image
 * swaps once per leg while the camera is settling, never mid-glide. */

const TRAVEL_SECONDS = 1.4
const HOLD_SECONDS = 1.1
const LEG_SECONDS = TRAVEL_SECONDS + HOLD_SECONDS

/** Exponential convergence rate onto the leg target. Frame-rate independent,
 * and fast enough that a leg's travel window settles it to under 2% of the
 * remaining distance, so the hold reads as a full stop. */
const EASE_RATE = 3.2

const AZIMUTH_STEP = 45
const HUE_STEP = 40
const ZOOM_TARGET = 4

export interface AutoplayState {
  /** Completed legs since the demo took over. */
  legIndex: number
  /** Seconds into the current leg (travel + hold). */
  legTime: number
  /** Pose the visitor left behind; leg targets step away from it. */
  azimuthBase: number
  hueBase: number
  azimuth: number
  elevation: number
  zoom: number
  hue: number
  saturation: number
}

/** Seeds the demo from wherever the visitor left the controls, so taking over
 * and stepping away reads continuous. */
export function startAutoplay(pose: {
  azimuth: number
  elevation: number
  zoom: number
  hue: number
  saturation: number
}): AutoplayState {
  return {
    legIndex: 0,
    legTime: 0,
    azimuthBase: pose.azimuth,
    hueBase: pose.hue,
    ...pose
  }
}

interface LegTarget {
  azimuth: number
  elevation: number
  zoom: number
  hue: number
  saturation: number
}

function legTarget(state: AutoplayState): LegTarget {
  const step = state.legIndex + 1
  return {
    azimuth: state.azimuthBase + AZIMUTH_STEP * step,
    elevation: step % 2 === 0 ? 0 : 30,
    zoom: ZOOM_TARGET,
    hue: state.hueBase + HUE_STEP * step,
    saturation: step % 2 === 0 ? 1.15 : 0.85
  }
}

/** Eases toward the target, snapping the last sliver of the exponential
 * tail. Without the snap the pose keeps emitting sub-visible updates at
 * widening intervals, which reads as noise to anything watching the value
 * for motion (the sliders' dim overlay); with it, motion stops crisply. */
function approach(
  current: number,
  target: number,
  dt: number,
  snap: number
): number {
  const next = current + (target - current) * (1 - Math.exp(-EASE_RATE * dt))
  return Math.abs(target - next) <= snap ? target : next
}

/** Advances one step. Azimuth and hue accumulate unwrapped so each leg keeps
 * orbiting the same direction; the caller clamps when writing to the pose. */
export function advanceAutoplay(
  state: AutoplayState,
  dt: number
): AutoplayState {
  let legIndex = state.legIndex
  let legTime = state.legTime + dt
  while (legTime >= LEG_SECONDS) {
    legTime -= LEG_SECONDS
    legIndex += 1
  }
  const next = { ...state, legIndex, legTime }
  const target = legTarget(next)
  return {
    ...next,
    azimuth: approach(state.azimuth, target.azimuth, dt, 2),
    elevation: approach(state.elevation, target.elevation, dt, 2),
    zoom: approach(state.zoom, target.zoom, dt, 0.2),
    hue: approach(state.hue, target.hue, dt, 2),
    saturation: approach(state.saturation, target.saturation, dt, 0.02)
  }
}
