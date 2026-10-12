import type { Light } from './lights'
import { fromOrbit } from './orbit'
import { towardLight } from './shading'

/**
 * The light map draws two views of the scene in a 100 by 100 box with the
 * subject in the middle: the top view looks down with the camera at the
 * bottom edge, the side view looks across with the camera at the left.
 * A directional light sits on the rim by where it shines from; a point
 * light sits in front of the subject, where it is in the photo.
 */
export type LightMapView = 'top' | 'side'

export const MAP_CENTER = 50
export const MAP_RIM = 38
const POINT_REACH = 30
const POINT_DEPTH = 15

const degrees = (radians: number) => (radians * 180) / Math.PI
const radians = (value: number) => (value * Math.PI) / 180
const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))
const wrap = (angle: number) => ((angle + 540) % 360) - 180

/** Where a directional light shines from: around the subject and above it. */
export function toOrbit(direction: number, elevation: number) {
  const [x, y, z] = towardLight(direction, elevation)
  const level = Math.hypot(x, z) > 1e-6
  return {
    around: level ? Math.round(degrees(Math.atan2(x, z))) || 0 : 0,
    height: Math.round(degrees(Math.asin(clamp(-y, -1, 1)))) || 0
  }
}

/** Where a light's dot sits in one view, in the map's 100 by 100 box. */
export function mapPoint(light: Light, view: LightMapView) {
  if (light.kind === 'point')
    return view === 'top'
      ? {
          x: MAP_CENTER + (light.x - 0.5) * 2 * POINT_REACH,
          y: MAP_CENTER + POINT_DEPTH
        }
      : {
          x: MAP_CENTER - POINT_DEPTH,
          y: MAP_CENTER + (light.y - 0.5) * 2 * POINT_REACH
        }
  const { around, height } = toOrbit(light.direction, light.elevation)
  if (view === 'top') {
    const reach = MAP_RIM * (0.45 + 0.55 * Math.cos(radians(height)))
    return {
      x: MAP_CENTER + Math.sin(radians(around)) * reach,
      y: MAP_CENTER + Math.cos(radians(around)) * reach
    }
  }
  const side = Math.abs(around) <= 90 ? -1 : 1
  return {
    x: MAP_CENTER + side * Math.cos(radians(height)) * MAP_RIM,
    y: MAP_CENTER - Math.sin(radians(height)) * MAP_RIM
  }
}

/**
 * The change a dot dragged to `(x, y)` makes: the top view turns a
 * directional light round the subject and slides a point light across;
 * the side view raises or lowers either.
 */
export function fromMapPoint(
  light: Light,
  view: LightMapView,
  x: number,
  y: number
): Partial<Light> {
  if (light.kind === 'point')
    return view === 'top'
      ? { x: clamp(0.5 + (x - MAP_CENTER) / (2 * POINT_REACH)) }
      : { y: clamp(0.5 + (y - MAP_CENTER) / (2 * POINT_REACH)) }
  const { around, height } = toOrbit(light.direction, light.elevation)
  if (view === 'top')
    return fromOrbit(
      degrees(Math.atan2(x - MAP_CENTER, y - MAP_CENTER)),
      height
    )
  const front = MAP_CENTER - x
  const lifted = degrees(Math.atan2(MAP_CENTER - y, Math.abs(front)))
  const flipped = front >= 0 !== Math.abs(around) <= 90
  return fromOrbit(flipped ? wrap(180 - around) : around, lifted)
}

/** What a dot's slider reads: degrees for a directional light, else %. */
export function mapValue(light: Light, view: LightMapView) {
  if (light.kind === 'point')
    return Math.round((view === 'top' ? light.x : 1 - light.y) * 100)
  const { around, height } = toOrbit(light.direction, light.elevation)
  return view === 'top' ? around : height
}

const STEP_KEYS: Partial<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1
}

/** Arrow keys step a dot's slider: degrees, or hundredths of the photo. */
export function nudgeMap(
  light: Light,
  view: LightMapView,
  key: string,
  step = 5
): Partial<Light> | undefined {
  const sign = STEP_KEYS[key]
  if (!sign) return undefined
  if (light.kind === 'point') {
    const by = (sign * step) / 100
    return view === 'top'
      ? { x: clamp(light.x + by) }
      : { y: clamp(light.y - by) }
  }
  const { around, height } = toOrbit(light.direction, light.elevation)
  return view === 'top'
    ? fromOrbit(wrap(around + sign * step), height)
    : fromOrbit(around, clamp(height + sign * step, -90, 90))
}
