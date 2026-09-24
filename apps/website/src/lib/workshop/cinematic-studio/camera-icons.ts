import type { DirectionPart } from './catalog'

export interface CameraIcon {
  readonly paths: readonly string[]
  readonly badge?: string
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`

const BODIES: Record<string, readonly string[]> = {
  auto: ['M5 8h20v11H5z', 'M25 11l8-3v11l-8-3z'],
  digital: ['M6 9h19v11H6z', 'M10 9V6h11v3', 'M25 11h3v7h-3', 'M28 10h6v9h-6z'],
  large: [
    'M3 7h23v14H3z',
    'M8 7V4h13v3',
    'M26 11h3v6h-3',
    'M29 8l7-3v18l-7-3z'
  ],
  super35: ['M8 10h16v10H8z', 'M24 13h3v4h-3', 'M27 12h7v6h-7z'],
  film35: [
    'M5 12h20v9H5z',
    circle(10, 7, 4),
    circle(20, 7, 4),
    'M25 14h3v5h-3',
    'M28 13h6v7h-6z'
  ],
  film16: [
    'M8 13h16v8H8z',
    circle(14, 8, 4),
    'M24 15h3v4h-3',
    'M27 14h6v6h-6z'
  ],
  handheld: [
    'M6 9h18v10H6z',
    'M9 19v3h8v-3',
    'M6 11H3v5h3',
    'M24 11l9-3v12l-9-3z'
  ]
}

const LENSES: Record<string, CameraIcon> = {
  auto: { paths: [circle(16, 12, 9)] },
  prime: { paths: [circle(16, 12, 9), circle(16, 12, 6)], badge: 'PR' },
  anamorphic: {
    paths: [ellipse(16, 12, 10, 7), ellipse(16, 12, 6, 4)],
    badge: 'AM'
  },
  vintage: {
    paths: [circle(16, 12, 9), circle(16, 12, 7), circle(16, 12, 4)],
    badge: 'VT'
  },
  macro: { paths: [circle(16, 12, 9), circle(16, 12, 3)], badge: 'MC' },
  tilt: {
    paths: [circle(16, 12, 9), 'M9 5l14 14', circle(16, 12, 5)],
    badge: 'TS'
  }
}

function focalIcon(id: string): CameraIcon {
  const barrel =
    id === 'auto' ? 12 : Math.round(6 + Math.sqrt(Number(id)) * 1.3)
  const start = 20 - (barrel + 4) / 2
  return {
    paths: [
      `M${start} 3h4v18h-4z`,
      `M${start + 4} 6h${barrel}v12h-${barrel}z`,
      `M${start + 4 + barrel / 2} 6v12`
    ]
  }
}

function apertureIcon(id: string): CameraIcon {
  const opening = id === 'auto' ? 5 : Math.max(2.5, 9 - Number(id) * 0.8)
  const blades = Array.from({ length: 6 }, (_, index) => {
    const angle = (index * Math.PI) / 3
    const inner = [
      20 + opening * Math.cos(angle),
      12 + opening * Math.sin(angle)
    ]
    const outer = [
      20 + 10 * Math.cos(angle + 1.1),
      12 + 10 * Math.sin(angle + 1.1)
    ]
    return `M${inner[0].toFixed(1)} ${inner[1].toFixed(1)}L${outer[0].toFixed(1)} ${outer[1].toFixed(1)}`
  })
  return { paths: [circle(20, 12, 10), ...blades] }
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
