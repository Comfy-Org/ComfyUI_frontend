import type { DirectionPart } from './catalog'

export type IconTone =
  | 'shadow'
  | 'front'
  | 'top'
  | 'side'
  | 'ring'
  | 'brass'
  | 'lensRing'
  | 'glass'
  | 'screen'
  | 'highlight'
  | 'highlightSoft'
  | 'highlightFaint'
  | 'knurl'
  | 'vent'
  | 'tick'
  | 'coating'
  | 'coatingGlow'
  | 'spark'
  | 'glint'
  | 'record'
  | 'flare'
  | 'flareGlow'
  | 'fov'
  | 'fovEdge'
  | 'fovAuto'

export interface IconShape {
  readonly d: string
  readonly tone: IconTone
  readonly transform?: string
  /** Painted without the soft rounded edge the clay faces get. */
  readonly flat?: boolean
}

export type CameraIcon = readonly IconShape[]

type Point = readonly [number, number]

/** Depth offset of the oblique projection, per unit of depth. */
const DEPTH_X = 0.55
const DEPTH_Y = -0.4

const num = (value: number) => Number(value.toFixed(2))

const polygon = (points: readonly Point[]) =>
  `M${points.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${num(cx - rx)} ${num(cy)}a${num(rx)} ${num(ry)} 0 1 0 ${num(2 * rx)} 0a${num(rx)} ${num(ry)} 0 1 0 ${num(-2 * rx)} 0`

const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r)

const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${num(x + r)} ${num(y)}H${num(x + w - r)}a${r} ${r} 0 0 1 ${r} ${r}V${num(y + h - r)}a${r} ${r} 0 0 1 ${-r} ${r}H${num(x + r)}a${r} ${r} 0 0 1 ${-r} ${-r}V${num(y + r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`

const shape = (d: string, tone: IconTone): IconShape => ({ d, tone })

const flat = (d: string, tone: IconTone): IconShape => ({ d, tone, flat: true })

const shadow = (cx: number, cy: number, rx: number) =>
  shape(ellipse(cx, cy, rx, 2.2), 'shadow')

/** A box in oblique view: top, right side and front, with a lit top edge. */
function box(x: number, y: number, w: number, h: number, depth: number) {
  const dx = DEPTH_X * depth
  const dy = DEPTH_Y * depth
  const vents =
    w > 14 && h > 10
      ? [0, 1, 2].map((row) =>
          shape(
            `M${num(x + w + dx * 0.3)} ${num(y + h * 0.35 + row * 2.2 + dy * 0.3)}l${num(dx * 0.45)} ${num(dy * 0.45)}`,
            'vent'
          )
        )
      : []
  return [
    shape(
      polygon([
        [x, y],
        [x + dx, y + dy],
        [x + w + dx, y + dy],
        [x + w, y]
      ]),
      'top'
    ),
    shape(
      polygon([
        [x + w, y],
        [x + w + dx, y + dy],
        [x + w + dx, y + h + dy],
        [x + w, y + h]
      ]),
      'side'
    ),
    shape(
      polygon([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
      ]),
      'front'
    ),
    shape(`M${num(x + 0.4)} ${num(y + 0.5)}H${num(x + w - 0.4)}`, 'highlight'),
    shape(
      `M${num(x + w + 0.5)} ${num(y + 0.3)}L${num(x + w + dx - 0.2)} ${num(y + dy + 0.4)}`,
      'highlightFaint'
    ),
    ...vents
  ]
}

/** A cylinder lying along x with its front face at `front`, facing left. */
function cylinder(
  front: number,
  back: number,
  cy: number,
  r: number,
  tone: 'front' | 'ring' | 'brass' = 'front'
) {
  const curve = r * 0.38
  const width = back - front
  const knurled = tone === 'ring' && width <= 10
  const grip = Math.max(3, Math.floor(width / 1.3))
  const detail = knurled
    ? Array.from({ length: grip }, (_, index) => {
        const x = front + ((index + 0.5) * width) / grip
        return shape(
          `M${num(x)} ${num(cy - r + 1.2)}V${num(cy + r - 1.2)}`,
          'knurl'
        )
      })
    : [
        shape(
          `M${num(front + width * 0.7)} ${num(cy - r)}v${num(r * 0.35)}`,
          'tick'
        )
      ]
  return [
    shape(
      `M${num(front)} ${num(cy - r)}H${num(back)}a${num(curve)} ${num(r)} 0 0 1 0 ${num(2 * r)}H${num(front)}Z`,
      tone
    ),
    shape(
      `M${num(front)} ${num(cy - r * 0.62)}H${num(back + curve * 0.6)}`,
      'highlightSoft'
    ),
    ...detail
  ]
}

/** Front glass: rim, coated glass, a yellow reflection and a highlight. */
function glass(x: number, cy: number, r: number, rx = r * 0.38) {
  return [
    shape(ellipse(x, cy, rx, r), 'lensRing'),
    shape(ellipse(x, cy, rx * 0.72, r * 0.72), 'glass'),
    shape(ellipse(x, cy, rx * 0.5, r * 0.5), 'coating'),
    shape(
      `M${num(x + rx * 0.1)} ${num(cy + r * 0.5)}a${num(rx * 0.4)} ${num(r * 0.35)} 0 0 0 ${num(rx * 0.3)} ${num(-r * 0.3)}`,
      'coatingGlow'
    ),
    shape(
      `M${num(x - rx * 0.35)} ${num(cy - r * 0.45)}a${num(rx * 0.5)} ${num(r * 0.5)} 0 0 1 ${num(rx * 0.5)} ${num(-r * 0.12)}`,
      'spark'
    ),
    shape(circle(x - rx * 0.2, cy - r * 0.28, 0.8), 'glint')
  ]
}

function lensOnBody(front: number, back: number, cy: number, r: number) {
  return [...cylinder(front, back, cy, r), ...glass(front, cy, r)]
}

/** A film magazine reel standing on top of the body. */
function reel(cx: number, cy: number, r: number) {
  return [
    flat(circle(cx + DEPTH_X * 3, cy + DEPTH_Y * 3, r), 'side'),
    flat(circle(cx, cy, r), 'front'),
    flat(circle(cx, cy, r * 0.3), 'top')
  ]
}

const recordLight = (cx: number, cy: number, r = 0.9) =>
  shape(circle(cx, cy, r), 'record')

const BODIES: Record<string, CameraIcon> = {
  auto: [
    shadow(36, 33, 18),
    ...box(24, 13, 22, 16, 10),
    ...lensOnBody(12, 24, 21, 6)
  ],
  digital: [
    shadow(36, 34, 20),
    ...box(28, 6, 8, 3, 6),
    ...box(22, 11, 24, 18, 12),
    ...box(49, 13, 3, 8, 4),
    ...lensOnBody(9, 22, 20, 6.5),
    shape(roundedRect(49.4, 13.4, 2, 6, 0.6), 'screen'),
    recordLight(43, 14.8, 1)
  ],
  large: [
    shadow(36, 35, 22),
    ...box(27, 3, 12, 3, 8),
    ...box(20, 8, 28, 22, 13),
    ...cylinder(5, 20, 19, 8),
    ...cylinder(9, 15, 19, 8.4, 'ring'),
    ...glass(5, 19, 8),
    recordLight(44, 12.5, 1)
  ],
  super35: [
    shadow(37, 32, 15),
    ...box(29, 10, 7, 2.5, 5),
    ...box(26, 14, 18, 14, 9),
    ...lensOnBody(15, 26, 21, 5),
    recordLight(41, 17)
  ],
  film35: [
    shadow(36, 35, 20),
    ...reel(27, 11, 6.5),
    ...reel(41, 11, 6.5),
    ...box(22, 17, 24, 13, 10),
    ...lensOnBody(10, 22, 24, 5.5),
    recordLight(43, 20)
  ],
  film16: [
    shadow(36, 34, 16),
    ...reel(34, 12, 6.5),
    ...box(25, 18, 19, 12, 8),
    ...lensOnBody(14, 25, 24, 5),
    recordLight(41, 21)
  ],
  handheld: [
    shadow(34, 36, 16),
    ...box(30, 25, 7, 9, 4),
    ...box(24, 10, 20, 15, 9),
    ...box(46, 13, 6, 5, 3),
    ...lensOnBody(13, 24, 17.5, 5.5),
    recordLight(41, 13.5),
    shape(roundedRect(47, 14, 3.4, 2.8, 1), 'glass')
  ]
}

const lensShadow = shadow(34, 35, 20)

const LENSES: Record<string, CameraIcon> = {
  auto: [
    lensShadow,
    ...cylinder(18, 48, 19, 11),
    ...cylinder(22, 30, 19, 11.4, 'ring'),
    ...glass(18, 19, 11, 6)
  ],
  prime: [
    lensShadow,
    ...cylinder(18, 48, 19, 11),
    ...cylinder(26, 34, 19, 11.4, 'ring'),
    ...glass(18, 19, 11, 6)
  ],
  anamorphic: [
    lensShadow,
    ...cylinder(18, 48, 19, 11),
    ...cylinder(24, 30, 19, 11.4, 'ring'),
    ...glass(18, 19, 11, 6),
    shape(ellipse(18, 19, 2, 6), 'flareGlow'),
    shape('M2 19H40', 'flare')
  ],
  vintage: [
    lensShadow,
    ...cylinder(18, 46, 19, 10.5, 'brass'),
    ...cylinder(22, 27, 19, 11, 'ring'),
    ...cylinder(32, 37, 19, 11, 'ring'),
    ...glass(18, 19, 10.5, 5.6)
  ],
  macro: [
    lensShadow,
    ...cylinder(14, 52, 19, 9),
    ...cylinder(20, 26, 19, 9.4, 'ring'),
    ...cylinder(32, 38, 19, 9.4, 'ring'),
    ...glass(14, 19, 9, 4.2)
  ],
  tilt: [
    lensShadow,
    ...cylinder(30, 50, 19, 10),
    ...[...cylinder(16, 30, 19, 10.4, 'ring'), ...glass(16, 19, 10.4, 5.4)].map(
      (part) => ({ ...part, transform: 'rotate(-14 30 19)' })
    )
  ]
}

/** Horizontal field of view in degrees for each focal length on full frame. */
const FIELD_OF_VIEW: Readonly<Record<string, number>> = {
  '14': 104,
  '24': 84,
  '35': 63,
  '50': 47,
  '85': 28,
  '135': 18
}

function focalIcon(id: string): CameraIcon {
  const length =
    id === 'auto' ? 12 : Math.round(8 + Math.sqrt(Number(id)) * 2.4)
  const front = Math.min(30, 60 - length)
  const field = FIELD_OF_VIEW[id]
  const spread = field
    ? Math.min(Math.tan((field * Math.PI) / 360) * (front - 2), 19)
    : 12
  const edges = `M${front} 20L2 ${num(20 - spread)}M${front} 20L2 ${num(20 + spread)}`
  const view = field
    ? [
        shape(`M${front} 20L2 ${num(20 - spread)}V${num(20 + spread)}Z`, 'fov'),
        shape(edges, 'fovEdge')
      ]
    : [shape(edges, 'fovAuto')]
  return [
    ...view,
    shadow(front + length / 2 + 2, 33, length / 2 + 4),
    ...cylinder(front, front + length, 20, 8),
    ...cylinder(front + 2, front + 5, 20, 8.4, 'ring'),
    ...glass(front, 20, 8, 3.4)
  ]
}

const irisPoint = (radius: number, angle: number): Point => [
  32 + radius * Math.cos(angle),
  20 + radius * Math.sin(angle)
]

function apertureIcon(id: string): CameraIcon {
  const stop = id === 'auto' ? 3.2 : Number(id)
  const opening = Math.max(2.5, 8.5 - stop * 0.75)
  const housing = [
    flat(circle(32, 20, 11), 'ring'),
    flat(circle(32, 20, 9), 'side')
  ]
  if (stop <= 1.4) return [...housing, shape(circle(32, 20, opening), 'glass')]
  const angles = Array.from({ length: 6 }, (_, index) => (index * Math.PI) / 3)
  const blades = angles.map((angle) =>
    flat(
      polygon([
        irisPoint(opening, angle),
        irisPoint(9, angle + 1),
        irisPoint(9, angle + 1.9),
        irisPoint(opening, angle + Math.PI / 3)
      ]),
      'top'
    )
  )
  const iris = shape(
    polygon(angles.map((angle) => irisPoint(opening, angle))),
    'glass'
  )
  return [...housing, ...blades, iris]
}

export function cameraIcon(
  part: DirectionPart,
  id: string
): CameraIcon | undefined {
  if (part === 'body') return BODIES[id] ?? BODIES.auto
  if (part === 'lens') return LENSES[id] ?? LENSES.auto
  if (part === 'focal') return focalIcon(id)
  if (part === 'aperture') return apertureIcon(id)
  return undefined
}
