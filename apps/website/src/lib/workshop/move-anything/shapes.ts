import type { Rect } from './arrange'
import type { MoveCopyKey } from './copy'

type Point = readonly [number, number]

/** A thing the mocked detector knows in the example, traced by hand. */
export interface KnownShape {
  readonly label: MoveCopyKey
  readonly points: readonly Point[]
}

export const EXAMPLE_SHAPES: readonly KnownShape[] = [
  {
    label: 'move.example.kitten',
    points: [
      [0.125, 0.21],
      [0.16, 0.25],
      [0.2, 0.26],
      [0.27, 0.25],
      [0.315, 0.205],
      [0.31, 0.27],
      [0.33, 0.33],
      [0.335, 0.42],
      [0.32, 0.5],
      [0.3, 0.56],
      [0.29, 0.65],
      [0.3, 0.75],
      [0.295, 0.83],
      [0.27, 0.86],
      [0.235, 0.9],
      [0.2, 0.9],
      [0.16, 0.87],
      [0.1, 0.86],
      [0.04, 0.85],
      [0, 0.82],
      [0, 0.42],
      [0.04, 0.36],
      [0.1, 0.32],
      [0.13, 0.3],
      [0.13, 0.25]
    ]
  },
  {
    label: 'move.example.succulent',
    points: [
      [0.33, 0.56],
      [0.35, 0.55],
      [0.38, 0.57],
      [0.41, 0.6],
      [0.415, 0.63],
      [0.415, 0.65],
      [0.405, 0.72],
      [0.395, 0.765],
      [0.37, 0.775],
      [0.33, 0.77],
      [0.305, 0.75],
      [0.295, 0.69],
      [0.285, 0.63],
      [0.3, 0.6],
      [0.31, 0.58]
    ]
  },
  {
    label: 'move.example.succulent',
    points: [
      [0.45, 0.52],
      [0.48, 0.505],
      [0.51, 0.52],
      [0.52, 0.56],
      [0.527, 0.59],
      [0.522, 0.65],
      [0.515, 0.71],
      [0.49, 0.73],
      [0.45, 0.725],
      [0.43, 0.7],
      [0.42, 0.64],
      [0.41, 0.59],
      [0.43, 0.57],
      [0.44, 0.54]
    ]
  }
]

const round = (value: number) => Math.round(value * 10000) / 10000

/** A smooth closed SVG path through the points, in image fractions. */
export function outlinePath(points: readonly Point[]): string {
  const at = (i: number) => points[(i + points.length) % points.length]
  const curves = points.map((point, i) => {
    const [x0, y0] = at(i - 1)
    const [x2, y2] = at(i + 1)
    const [x3, y3] = at(i + 2)
    const c1 = [point[0] + (x2 - x0) / 6, point[1] + (y2 - y0) / 6]
    const c2 = [x2 - (x3 - point[0]) / 6, y2 - (y3 - point[1]) / 6]
    return `C${[...c1, ...c2, x2, y2].map(round).join(' ')}`
  })
  return `M${points[0].map(round).join(' ')}${curves.join('')}Z`
}

/** The box around some points. */
export function boundsOf(points: readonly Point[]): Rect {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function contains(points: readonly Point[], [px, py]: Point): boolean {
  let inside = false
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + points.length - 1) % points.length]
    if (y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1)
      inside = !inside
  })
  return inside
}

/** The known shape under a click, or undefined. */
export function shapeAt(
  shapes: readonly KnownShape[],
  point: Point
): KnownShape | undefined {
  return shapes.find((shape) => contains(shape.points, point))
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  const shared = w * h
  return shared / (a.w * a.h + b.w * b.h - shared)
}

/** The known shape whose bounds best match a drawn box, if any is close. */
export function shapeForBox(
  shapes: readonly KnownShape[],
  box: Rect
): KnownShape | undefined {
  const scored = shapes
    .map((shape) => ({ shape, score: overlap(boundsOf(shape.points), box) }))
    .filter(({ score }) => score > 0.3)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.shape
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * A stand-in for detecting an unknown thing: a soft, slightly uneven blob
 * about a fifth of the image across, round on screen whatever the photo's
 * shape, grown around the click and kept inside the image.
 */
export function blobAround([cx, cy]: Point, aspect: number): Point[] {
  const rx = 0.1
  const ry = Math.min(0.3, rx * aspect)
  const x = Math.min(1 - rx, Math.max(rx, cx))
  const y = Math.min(1 - ry, Math.max(ry, cy))
  return Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    const wobble = 1 + 0.08 * Math.sin(i * 2.7)
    return [
      clamp(x + Math.cos(angle) * rx * wobble),
      clamp(y + Math.sin(angle) * ry * wobble)
    ] as const
  })
}

/** A box with softly rounded corners, as an SVG path in image fractions. */
export function roundedBoxPath(box: Rect, aspect: number): string {
  const ry = Math.min(box.h, box.w * aspect) * 0.12
  const rx = ry / aspect
  const [x1, y1, x2, y2] = [box.x, box.y, box.x + box.w, box.y + box.h].map(
    round
  )
  const [a, b] = [round(rx), round(ry)]
  return [
    `M${round(x1 + rx)} ${y1}`,
    `H${round(x2 - rx)}`,
    `A${a} ${b} 0 0 1 ${x2} ${round(y1 + ry)}`,
    `V${round(y2 - ry)}`,
    `A${a} ${b} 0 0 1 ${round(x2 - rx)} ${y2}`,
    `H${round(x1 + rx)}`,
    `A${a} ${b} 0 0 1 ${x1} ${round(y2 - ry)}`,
    `V${round(y1 + ry)}`,
    `A${a} ${b} 0 0 1 ${round(x1 + rx)} ${y1}`,
    'Z'
  ].join('')
}
