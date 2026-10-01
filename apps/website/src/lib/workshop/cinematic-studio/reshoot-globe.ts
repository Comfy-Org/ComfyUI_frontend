import type { ReshootZone } from './reshoot'

const FLATTEN = 0.22
const RAD = Math.PI / 180

interface Point {
  x: number
  y: number
}

/**
 * How far from the clip the camera is drawn, as a multiple of the globe's
 * radius: the node's own orbit picker (_dist_scale). Distance 1 sits on the
 * shell, closer moves inside it (0.45 at the nearest), farther out to 1.5.
 */
export function distanceScale(distance: number): number {
  return distance <= 1 ? 0.45 + 0.55 * distance : 1 + 0.25 * (distance - 1)
}

/** Where a camera at this azimuth and elevation sits on the drawn globe. */
export function globePoint(
  azimuth: number,
  elevation: number,
  r: number
): Point {
  const a = azimuth * RAD
  const e = elevation * RAD
  return {
    x: r * Math.sin(a) * Math.cos(e),
    y: r * FLATTEN * Math.cos(a) * Math.cos(e) - r * Math.sin(e)
  }
}

function arc(from: number, to: number, r: number): string {
  return Array.from({ length: 25 }, (_, i) => {
    const { x, y } = globePoint(from + ((to - from) * i) / 24, 0, r)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

/** The front of the equator, coloured by how far the model can be trusted. */
export function zoneArcs(
  r: number
): readonly { zone: ReshootZone; points: string }[] {
  return [
    // at eye level the LoRA is trained out to a quarter turn either way
    { zone: 'green', points: arc(-45, 45, r) },
    { zone: 'yellow', points: arc(45, 90, r) },
    { zone: 'yellow', points: arc(-90, -45, r) }
  ]
}

export const GLOBE_FLATTEN = FLATTEN
