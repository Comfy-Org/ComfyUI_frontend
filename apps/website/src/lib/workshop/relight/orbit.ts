import { towardLight } from './shading'

/**
 * Where a directional light sits around the subject, as an orbit: `around`
 * is degrees about the vertical axis (0 in front, 90 to the right, 180
 * behind) and `height` degrees above (90) or below (-90) the subject.
 */
export interface Orbit {
  readonly around: number
  readonly height: number
}

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI)
const radians = (value: number) => (value * Math.PI) / 180

/** A light's direction and elevation as an orbit position. */
export function toOrbit(direction: number, elevation: number): Orbit {
  const [x, y, z] = towardLight(direction, elevation)
  return {
    around: degrees(Math.atan2(x, z)),
    height: degrees(Math.asin(Math.max(-1, Math.min(1, -y))))
  }
}

/** An orbit position as the light's direction and elevation. */
export function fromOrbit(around: number, height: number) {
  const flat = Math.cos(radians(height))
  const x = Math.sin(radians(around)) * flat
  const y = -Math.sin(radians(height))
  const z = Math.cos(radians(around)) * flat
  return {
    direction: Math.hypot(x, y) < 1e-6 ? 0 : degrees(Math.atan2(-y, -x)),
    elevation: degrees(Math.asin(Math.max(-1, Math.min(1, z))))
  }
}

export const ORBIT_PRESETS = [
  { id: 'front', around: 0, height: 10 },
  { id: 'top', around: 0, height: 70 },
  { id: 'left', around: -80, height: 10 },
  { id: 'back', around: 180, height: 10 },
  { id: 'bottom', around: 0, height: -60 },
  { id: 'right', around: 80, height: 10 }
] as const satisfies readonly (Orbit & { id: string })[]
