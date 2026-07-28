/** Motion model for the hero's idle self-demo. Kept free of Vue and DOM so the
 * curve can be exercised directly; `useIdleAutoplay` owns the wiring. */

/** Seconds per full revolution for the values that advance continuously. */
const AZIMUTH_PERIOD = 24
const HUE_PERIOD = 30

/** Seconds per cycle for the values that ease toward a travelling target.
 * Deliberately co-prime so the combined motion does not visibly loop. */
const ELEVATION_PERIOD = 17
const ZOOM_PERIOD = 11
const SATURATION_PERIOD = 13

/** Bounds of each eased wave, chosen to sweep the full set of rendered angles
 * without leaving the range its clamp accepts. */
const ELEVATION_CENTRE = 15
const ELEVATION_AMPLITUDE = 45
const ZOOM_CENTRE = 4.5
const ZOOM_AMPLITUDE = 3.5
const SATURATION_CENTRE = 1
const SATURATION_AMPLITUDE = 0.6

/** Exponential convergence rate onto the target wave. Frame-rate independent:
 * the same elapsed time yields the same result at any step size. */
const EASE_RATE = 1.5

export interface AutoplayState {
  phase: number
  azimuth: number
  elevation: number
  zoom: number
  hue: number
  saturation: number
}

function wave(
  phase: number,
  period: number,
  centre: number,
  amplitude: number
): number {
  return centre + amplitude * Math.sin((phase / period) * Math.PI * 2)
}

function approach(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-EASE_RATE * dt))
}

function cycle(value: number, period: number, dt: number): number {
  return (value + (360 / period) * dt) % 360
}

/** Advances one step. Eased values converge on their wave from wherever the
 * visitor left them, so handing control back never snaps the pose. */
export function advanceAutoplay(
  state: AutoplayState,
  dt: number
): AutoplayState {
  const phase = state.phase + dt
  return {
    phase,
    azimuth: cycle(state.azimuth, AZIMUTH_PERIOD, dt),
    hue: cycle(state.hue, HUE_PERIOD, dt),
    elevation: approach(
      state.elevation,
      wave(phase, ELEVATION_PERIOD, ELEVATION_CENTRE, ELEVATION_AMPLITUDE),
      dt
    ),
    zoom: approach(
      state.zoom,
      wave(phase, ZOOM_PERIOD, ZOOM_CENTRE, ZOOM_AMPLITUDE),
      dt
    ),
    saturation: approach(
      state.saturation,
      wave(phase, SATURATION_PERIOD, SATURATION_CENTRE, SATURATION_AMPLITUDE),
      dt
    )
  }
}
