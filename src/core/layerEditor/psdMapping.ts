import type {
  AdjustmentLayer,
  BezierPath,
  Color,
  CurvesAdjustmentChannel,
  Justification,
  Layer,
  RGB,
  VectorContent
} from 'ag-psd'

import type { FillSpec, GradientStop } from './engine/fill'
import { generateId } from './engine/id'
import type { BlendFn } from './engine/mode'
import type { AdjustmentData } from './engine/node'
import type { Anchor, PathData, Stroke } from './engine/vector'

export const PSD_BLEND_MODES: Record<
  BlendFn,
  NonNullable<Layer['blendMode']>
> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  'hard-light': 'hard light',
  'soft-light': 'soft light',
  difference: 'difference',
  exclusion: 'exclusion',
  'linear-dodge': 'linear dodge',
  'linear-burn': 'linear burn',
  'vivid-light': 'vivid light',
  'pin-light': 'pin light',
  'linear-light': 'linear light',
  'hard-mix': 'hard mix',
  subtract: 'subtract',
  divide: 'divide',
  'grain-extract': 'normal',
  'grain-merge': 'normal',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity'
}

const BLEND_FROM_PSD = new Map<string, BlendFn>()
for (const [ours, psd] of Object.entries(PSD_BLEND_MODES)) {
  if (!BLEND_FROM_PSD.has(psd)) BLEND_FROM_PSD.set(psd, ours as BlendFn)
}
for (const [psd, ours] of [
  ['dissolve', 'normal'],
  ['darker color', 'darken'],
  ['lighter color', 'lighten'],
  ['linear height', 'normal'],
  ['height', 'normal'],
  ['subtraction', 'subtract']
] as const) {
  BLEND_FROM_PSD.set(psd, ours)
}

export function blendFromPsd(mode: string | undefined): BlendFn {
  return (mode && BLEND_FROM_PSD.get(mode)) || 'normal'
}

export function hexToPsdColor(hex: string): RGB {
  const raw = hex.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0')
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0
  }
}

export function psdColorToHex(color: Color | undefined): string {
  const c = (color ?? {}) as Record<string, number>
  const to255 = (v: number | undefined): number => {
    const n = typeof v === 'number' && isFinite(v) ? v : 0
    return Math.round(
      Math.max(
        0,
        Math.min(255, n <= 1 && n > 0 && !Number.isInteger(n) ? n * 255 : n)
      )
    )
  }
  const hexPart = (v: number): string => v.toString(16).padStart(2, '0')
  return `#${hexPart(to255(c.r))}${hexPart(to255(c.g))}${hexPart(to255(c.b))}`
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))
const num = (v: unknown, d: number): number =>
  typeof v === 'number' && isFinite(v) ? v : d

export function curveStringToPsd(
  raw: string | undefined
): CurvesAdjustmentChannel | undefined {
  if (!raw?.trim()) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) return undefined
  const points = parsed
    .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
    .map((p) => ({
      input: clamp(Math.round(num(p[0], 0) * 255), 0, 255),
      output: clamp(Math.round(num(p[1], 0) * 255), 0, 255)
    }))
    .sort((a, b) => a.input - b.input)
  return points.length >= 2 ? points : undefined
}

export function psdCurveToString(
  channel: CurvesAdjustmentChannel | undefined
): string {
  if (!channel || channel.length < 2) return ''
  const points = channel.map((p) => [
    Math.round((clamp(p.input, 0, 255) / 255) * 10000) / 10000,
    Math.round((clamp(p.output, 0, 255) / 255) * 10000) / 10000
  ])
  return JSON.stringify(points)
}

const WARMING: RGB = { r: 236, g: 138, b: 0 }
const COOLING: RGB = { r: 0, g: 109, b: 232 }

export function adjustmentToPsd(
  node: Pick<AdjustmentData, 'op' | 'params' | 'curves'>
): AdjustmentLayer | undefined {
  const p = node.params ?? {}
  switch (node.op) {
    case 'invert':
      return { type: 'invert' }
    case 'brightness-contrast': {
      const b = num(p.brightness, 0)
      const c = num(p.contrast, 0)
      return {
        type: 'brightness/contrast',
        brightness: Math.round(clamp(b * 150, -150, 150)),
        contrast: Math.round(clamp(c > 0 ? c * 100 : c * 50, -50, 100)),
        useLegacy: false
      }
    }
    case 'hue-saturation':
      return {
        type: 'hue/saturation',
        master: {
          a: 0,
          b: 0,
          c: 0,
          d: 0,
          hue: Math.round(clamp(num(p.hue, 0), -180, 180)),
          saturation: Math.round(clamp(num(p.saturation, 0) * 100, -100, 100)),
          lightness: Math.round(clamp(num(p.lightness, 0) * 100, -100, 100))
        }
      }
    case 'levels':
      return {
        type: 'levels',
        rgb: {
          shadowInput: Math.round(clamp(num(p.inBlack, 0) * 255, 0, 255)),
          highlightInput: Math.round(clamp(num(p.inWhite, 1) * 255, 0, 255)),
          shadowOutput: Math.round(clamp(num(p.outBlack, 0) * 255, 0, 255)),
          highlightOutput: Math.round(clamp(num(p.outWhite, 1) * 255, 0, 255)),
          midtoneInput: clamp(num(p.gamma, 1), 0.01, 9.99)
        }
      }
    case 'curves': {
      const rgb = curveStringToPsd(node.curves?.master)
      const red = curveStringToPsd(node.curves?.red)
      const green = curveStringToPsd(node.curves?.green)
      const blue = curveStringToPsd(node.curves?.blue)
      return { type: 'curves', rgb, red, green, blue }
    }
    case 'exposure':
      return {
        type: 'exposure',
        exposure: clamp(num(p.exposure, 0), -20, 20),
        offset: clamp(-num(p.black, 0), -0.5, 0.5),
        gamma: 1
      }
    case 'color-balance': {
      const triple = (prefix: string) => ({
        cyanRed: Math.round(clamp(num(p[`${prefix}R`], 0) * 100, -100, 100)),
        magentaGreen: Math.round(
          clamp(num(p[`${prefix}G`], 0) * 100, -100, 100)
        ),
        yellowBlue: Math.round(clamp(num(p[`${prefix}B`], 0) * 100, -100, 100))
      })
      return {
        type: 'color balance',
        shadows: triple('shadows'),
        midtones: triple('midtones'),
        highlights: triple('highlights'),
        preserveLuminosity: true
      }
    }
    case 'vibrance':
      return {
        type: 'vibrance',
        vibrance: Math.round(clamp(num(p.amount, 0) * 50, -100, 100)),
        saturation: 0
      }
    case 'posterize':
      return {
        type: 'posterize',
        levels: Math.round(clamp(num(p.levels, 4), 2, 255))
      }
    case 'threshold':
      return {
        type: 'threshold',
        level: Math.round(clamp(num(p.level, 0.5) * 255, 1, 255))
      }
    case 'temperature': {
      const temp = num(p.temperature, 6500)
      const mix = clamp(num(p.mix, 1), 0, 1)
      const density = Math.round(
        clamp((Math.abs(temp - 6500) / 5500) * 100 * mix, 0, 100)
      )
      if (density === 0)
        return {
          type: 'photo filter',
          color: WARMING,
          density: 1,
          preserveLuminosity: true
        }
      return {
        type: 'photo filter',
        color: temp < 6500 ? WARMING : COOLING,
        density,
        preserveLuminosity: true
      }
    }
    default:
      return undefined
  }
}

export interface ImportedAdjustment {
  op: AdjustmentData['op']
  params: Record<string, number>
  curves?: AdjustmentData['curves']
}

export function adjustmentFromPsd(
  adj: AdjustmentLayer
): ImportedAdjustment | null {
  switch (adj.type) {
    case 'invert':
      return { op: 'invert', params: {} }
    case 'brightness/contrast': {
      const c = num(adj.contrast, 0)
      return {
        op: 'brightness-contrast',
        params: {
          brightness: clamp(num(adj.brightness, 0) / 150, -1, 1),
          contrast: clamp(c > 0 ? c / 100 : c / 50, -1, 1)
        }
      }
    }
    case 'hue/saturation': {
      const m = adj.master
      return {
        op: 'hue-saturation',
        params: {
          hue: clamp(num(m?.hue, 0), -180, 180),
          saturation: clamp(num(m?.saturation, 0) / 100, -1, 1),
          lightness: clamp(num(m?.lightness, 0) / 100, -1, 1)
        }
      }
    }
    case 'levels': {
      const ch = adj.rgb
      return {
        op: 'levels',
        params: {
          inBlack: clamp(num(ch?.shadowInput, 0) / 255, 0, 0.99),
          inWhite: clamp(num(ch?.highlightInput, 255) / 255, 0.01, 1),
          gamma: clamp(num(ch?.midtoneInput, 1), 0.1, 5),
          outBlack: clamp(num(ch?.shadowOutput, 0) / 255, 0, 1),
          outWhite: clamp(num(ch?.highlightOutput, 255) / 255, 0, 1)
        }
      }
    }
    case 'curves':
      return {
        op: 'curves',
        params: {},
        curves: {
          master: psdCurveToString(adj.rgb),
          red: psdCurveToString(adj.red),
          green: psdCurveToString(adj.green),
          blue: psdCurveToString(adj.blue)
        }
      }
    case 'exposure':
      return {
        op: 'exposure',
        params: {
          exposure: clamp(num(adj.exposure, 0), -3, 3),
          black: clamp(-num(adj.offset, 0), -0.1, 0.1)
        }
      }
    case 'color balance': {
      const from = (
        v:
          | { cyanRed: number; magentaGreen: number; yellowBlue: number }
          | undefined,
        prefix: string
      ) => ({
        [`${prefix}R`]: clamp(num(v?.cyanRed, 0) / 100, -1, 1),
        [`${prefix}G`]: clamp(num(v?.magentaGreen, 0) / 100, -1, 1),
        [`${prefix}B`]: clamp(num(v?.yellowBlue, 0) / 100, -1, 1)
      })
      return {
        op: 'color-balance',
        params: {
          ...from(adj.shadows, 'shadows'),
          ...from(adj.midtones, 'midtones'),
          ...from(adj.highlights, 'highlights')
        }
      }
    }
    case 'vibrance':
      return {
        op: 'vibrance',
        params: { amount: clamp(num(adj.vibrance, 0) / 50, -2, 2) }
      }
    case 'posterize':
      return {
        op: 'posterize',
        params: { levels: clamp(Math.round(num(adj.levels, 4)), 2, 32) }
      }
    case 'threshold':
      return {
        op: 'threshold',
        params: { level: clamp(num(adj.level, 128) / 255, 0, 1) }
      }
    case 'photo filter': {
      const c = (adj.color ?? {}) as Record<string, number>
      const warm = num(c.r, 0) >= num(c.b, 0)
      const density = clamp(num(adj.density, 0), 0, 100)
      const offset = (density / 100) * 5500
      return {
        op: 'temperature',
        params: {
          temperature: clamp(warm ? 6500 - offset : 6500 + offset, 1000, 12000),
          mix: 1
        }
      }
    }
    default:
      return null
  }
}

function toColorStops(stops: GradientStop[]) {
  return stops.map((s) => ({
    color: hexToPsdColor(s.color),
    location: clamp(s.offset, 0, 1),
    midpoint: 0.5
  }))
}

function toOpacityStops(stops: GradientStop[]) {
  return stops.map((s) => ({
    opacity: s.alpha === undefined ? 1 : clamp(s.alpha, 0, 1),
    location: clamp(s.offset, 0, 1),
    midpoint: 0.5
  }))
}

export function fillToVectorContent(spec: FillSpec): VectorContent {
  if (spec.type === 'solid') {
    return { type: 'color', color: hexToPsdColor(spec.color) }
  }
  const base = {
    name: 'Gradient',
    type: 'solid' as const,
    smoothness: 1,
    colorStops: toColorStops(spec.stops),
    opacityStops: toOpacityStops(spec.stops)
  }
  if (spec.type === 'linear') {
    const angle = ((-spec.angle % 360) + 360) % 360
    return {
      ...base,
      style: 'linear',
      angle: angle > 180 ? angle - 360 : angle,
      scale: 100
    }
  }
  return {
    ...base,
    style: 'radial',
    angle: 0,
    scale: clamp(spec.radius * 100, 1, 400),
    offset: { x: clamp(spec.cx - 0.5, -1, 1), y: clamp(spec.cy - 0.5, -1, 1) }
  }
}

export function vectorContentToFill(
  content: VectorContent | undefined
): FillSpec | null {
  if (!content) return null
  if (content.type === 'color') {
    return { type: 'solid', color: psdColorToHex(content.color) }
  }
  if (content.type !== 'solid') return null
  const colorStops = content.colorStops ?? []
  if (colorStops.length < 2) return null
  const opacityAt = (location: number): number | undefined => {
    const stop = (content.opacityStops ?? []).find(
      (o) => Math.abs(o.location - location) < 1e-3
    )
    if (!stop || stop.opacity >= 1) return undefined
    return clamp(stop.opacity, 0, 1)
  }
  const stops: GradientStop[] = colorStops.map((s) => ({
    offset: clamp(s.location, 0, 1),
    color: psdColorToHex(s.color),
    alpha: opacityAt(s.location)
  }))
  const extra = content as VectorContent & {
    style?: string
    angle?: number
    scale?: number
    offset?: { x: number; y: number }
  }
  if (extra.style === 'radial') {
    return {
      type: 'radial',
      cx: clamp(num(extra.offset?.x, 0) + 0.5, 0, 1),
      cy: clamp(num(extra.offset?.y, 0) + 0.5, 0, 1),
      radius: clamp(num(extra.scale, 100) / 100, 0.01, 4),
      stops
    }
  }
  const angle = ((-num(extra.angle, 0) % 360) + 360) % 360
  return { type: 'linear', angle, stops }
}

export interface PointMapper {
  (pt: { x: number; y: number }): { x: number; y: number }
}

export function pathToBezierPaths(
  path: PathData,
  fillRule: 'even-odd' | 'non-zero',
  map: PointMapper = (pt) => pt
): BezierPath[] {
  const out: BezierPath[] = []
  for (const stroke of path.strokes) {
    const n = stroke.anchors.length
    if (n < 3 || n % 3 !== 0) continue
    const knots = []
    for (let i = 0; i < n; i += 3) {
      const lead = map(stroke.anchors[i].pos)
      const anchor = map(stroke.anchors[i + 1].pos)
      const trail = map(stroke.anchors[i + 2].pos)
      knots.push({
        linked: true,
        points: [lead.x, lead.y, anchor.x, anchor.y, trail.x, trail.y]
      })
    }
    out.push({ open: !stroke.closed, operation: 'combine', knots, fillRule })
  }
  return out
}

export function bezierPathsToPath(paths: BezierPath[]): PathData {
  const strokes: Stroke[] = []
  for (const path of paths) {
    const anchors: Anchor[] = []
    for (const knot of path.knots) {
      const p = knot.points
      if (!Array.isArray(p) || p.length < 6) continue
      anchors.push(
        {
          pos: { x: num(p[0], 0), y: num(p[1], 0) },
          type: 'control',
          selected: false
        },
        {
          pos: { x: num(p[2], 0), y: num(p[3], 0) },
          type: 'anchor',
          selected: false
        },
        {
          pos: { x: num(p[4], 0), y: num(p[5], 0) },
          type: 'control',
          selected: false
        }
      )
    }
    if (anchors.length >= 3) {
      strokes.push({ id: generateId('stroke'), anchors, closed: !path.open })
    }
  }
  return { strokes }
}

const JUSTIFY_TO_PSD: Record<'left' | 'center' | 'right', Justification> = {
  left: 'left',
  center: 'center',
  right: 'right'
}

export function alignToPsd(align: 'left' | 'center' | 'right'): Justification {
  return JUSTIFY_TO_PSD[align] ?? 'left'
}

export function alignFromPsd(
  justification: Justification | undefined
): 'left' | 'center' | 'right' {
  if (justification === 'center' || justification === 'justify-center')
    return 'center'
  if (justification === 'right' || justification === 'justify-right')
    return 'right'
  return 'left'
}
