import type { DirectionPart } from './catalog'

export interface CameraIcon {
  readonly paths: readonly string[]
  readonly badge?: string
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx} ${cy - ry}a${rx} ${ry} 0 1 0 0 ${2 * ry}a${rx} ${ry} 0 1 0 0 ${-2 * ry}`

/** A lens barrel seen from the side: round front glass, body, rear mount. */
function barrel(
  front: number,
  length: number,
  radius: number,
  cy = 12
): string[] {
  const back = front + length
  return [
    ellipse(front, cy, radius / 3, radius),
    `M${front} ${cy - radius}H${back}V${cy + radius}H${front}`,
    `M${back} ${cy - radius / 2}h2.5v${radius}h-2.5`
  ]
}

const cameraBody = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}h${w}v${h}h-${w}z`

const BODIES: Record<string, readonly string[]> = {
  auto: [...barrel(2, 8, 4), cameraBody(13, 5, 24, 14)],
  digital: [
    ...barrel(2, 8, 4),
    cameraBody(13, 6, 23, 13),
    'M18 6V3h11v3',
    'M36 9h2v6h-2'
  ],
  large: [
    ...barrel(1, 9, 5),
    cameraBody(13, 4, 25, 16),
    'M18 4V2h10v2',
    'M32 9h3M32 12h3'
  ],
  super35: [...barrel(3, 7, 3.5), cameraBody(13, 7, 20, 11), 'M18 7V5h8v2'],
  film35: [
    ...barrel(2, 8, 3.5, 16),
    cameraBody(13, 11, 24, 10),
    circle(19, 6, 4.2),
    circle(31, 6, 4.2)
  ],
  film16: [
    ...barrel(3, 7, 3, 16),
    cameraBody(13, 11, 19, 9),
    circle(22.5, 6, 4.2)
  ],
  handheld: [
    ...barrel(2, 7, 3.5, 10),
    cameraBody(12, 5, 20, 11),
    'M17 16v5h8v-5',
    'M32 8h6v5h-6'
  ]
}

/** A lens in three-quarter view: front glass, barrel, rear flange. */
const LENS_BODY = [
  ellipse(8, 12, 4.5, 9),
  ellipse(8, 12, 2.6, 6),
  'M8 3L23 4.5',
  'M8 21L23 19.5',
  'M23 4.5a2.2 7.5 0 0 1 0 15'
]

const LENS = (extra: readonly string[] = [], badge?: string): CameraIcon => ({
  paths: [...LENS_BODY, ...extra],
  badge
})

const LENSES: Record<string, CameraIcon> = {
  auto: LENS(),
  prime: LENS(['M16 3.8a2 8.2 0 0 1 0 16.4'], 'PR'),
  anamorphic: LENS([ellipse(8, 12, 1.2, 4)], 'AM'),
  vintage: LENS(['M13.5 3.6a2 8.4 0 0 1 0 16.8', 'M18 4a2 8 0 0 1 0 16'], 'VT'),
  macro: LENS([ellipse(8, 12, 0.9, 2)], 'MC'),
  tilt: LENS(['M14 3.7l4 16.4'], 'TS')
}

function focalIcon(id: string): CameraIcon {
  const length =
    id === 'auto' ? 16 : Math.round(4 + Math.sqrt(Number(id)) * 2.2)
  const front = 20 - (length + 3) / 2
  return {
    paths: [...barrel(front, length, 7), `M${front + length / 2} 5v14`]
  }
}

function irisPoint(radius: number, angle: number) {
  return [20 + radius * Math.cos(angle), 12 + radius * Math.sin(angle)]
    .map((value) => value.toFixed(1))
    .join(' ')
}

function apertureIcon(id: string): CameraIcon {
  const stop = id === 'auto' ? 2.8 : Number(id)
  const opening = Math.max(2.5, 8.5 - stop * 0.75)
  if (stop <= 1.4)
    return { paths: [circle(20, 12, 10), circle(20, 12, opening)] }
  const angles = Array.from({ length: 6 }, (_, index) => (index * Math.PI) / 3)
  const iris = `M${angles.map((angle) => irisPoint(opening, angle)).join('L')}Z`
  const blades = angles.map(
    (angle) => `M${irisPoint(opening, angle)}L${irisPoint(10, angle + 1)}`
  )
  return { paths: [circle(20, 12, 10), iris, ...blades] }
}

export function cameraIcon(
  part: DirectionPart,
  id: string
): CameraIcon | undefined {
  if (part === 'body') return { paths: BODIES[id] ?? BODIES.auto }
  if (part === 'lens') return LENSES[id] ?? LENSES.auto
  if (part === 'focal') return focalIcon(id)
  if (part === 'aperture') return apertureIcon(id)
  return undefined
}
