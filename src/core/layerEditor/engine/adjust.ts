import { buildCurvesLuts, exposureScale, kelvinToRgb } from './colorMath'

import { linearToSrgb, srgbToLinear } from './color'
import type { RGBA } from './blend'

export type AdjustmentOp =
  | 'brightness-contrast'
  | 'hue-saturation'
  | 'invert'
  | 'levels'
  | 'curves'
  | 'temperature'
  | 'exposure'
  | 'color-balance'
  | 'vibrance'
  | 'posterize'
  | 'threshold'

export const ADJUST_CODE: Record<AdjustmentOp, number> = {
  'brightness-contrast': 0,
  'hue-saturation': 1,
  invert: 2,
  levels: 3,
  temperature: 4,
  exposure: 5,
  'color-balance': 6,
  posterize: 7,
  threshold: 8,
  vibrance: 9,
  curves: 10
}

export const ADJUST_OPS = Object.keys(ADJUST_CODE) as AdjustmentOp[]

export interface AdjustCurves {
  master?: string
  red?: string
  green?: string
  blue?: string
}

export const ADJUST_PARAM_DEFS: Record<
  AdjustmentOp,
  Array<{
    key: string
    min: number
    max: number
    default: number
    step?: number
  }>
> = {
  'brightness-contrast': [
    { key: 'brightness', min: -1, max: 1, default: 0 },
    { key: 'contrast', min: -1, max: 1, default: 0 }
  ],
  'hue-saturation': [
    { key: 'hue', min: -180, max: 180, default: 0 },
    { key: 'saturation', min: -1, max: 1, default: 0 },
    { key: 'lightness', min: -1, max: 1, default: 0 }
  ],
  invert: [],
  levels: [
    { key: 'inBlack', min: 0, max: 0.99, default: 0 },
    { key: 'inWhite', min: 0.01, max: 1, default: 1 },
    { key: 'gamma', min: 0.1, max: 5, default: 1 },
    { key: 'outBlack', min: 0, max: 1, default: 0 },
    { key: 'outWhite', min: 0, max: 1, default: 1 }
  ],
  curves: [],
  temperature: [
    { key: 'temperature', min: 1000, max: 12000, default: 6500, step: 50 },
    { key: 'mix', min: 0, max: 1, default: 1 }
  ],
  exposure: [
    { key: 'exposure', min: -3, max: 3, default: 0 },
    { key: 'black', min: -0.1, max: 0.1, default: 0, step: 0.001 }
  ],
  'color-balance': [
    { key: 'shadowsR', min: -1, max: 1, default: 0 },
    { key: 'shadowsG', min: -1, max: 1, default: 0 },
    { key: 'shadowsB', min: -1, max: 1, default: 0 },
    { key: 'midtonesR', min: -1, max: 1, default: 0 },
    { key: 'midtonesG', min: -1, max: 1, default: 0 },
    { key: 'midtonesB', min: -1, max: 1, default: 0 },
    { key: 'highlightsR', min: -1, max: 1, default: 0 },
    { key: 'highlightsG', min: -1, max: 1, default: 0 },
    { key: 'highlightsB', min: -1, max: 1, default: 0 }
  ],
  vibrance: [{ key: 'amount', min: -2, max: 2, default: 0 }],
  posterize: [{ key: 'levels', min: 2, max: 32, default: 4, step: 1 }],
  threshold: [{ key: 'level', min: 0, max: 1, default: 0.5 }]
}

export function defaultParams(op: AdjustmentOp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of ADJUST_PARAM_DEFS[op]) out[def.key] = def.default
  return out
}

export function packParams(
  op: AdjustmentOp,
  params: Record<string, number>
): number[] {
  if (op === 'brightness-contrast')
    return [params.brightness ?? 0, params.contrast ?? 0, 0, 0]
  if (op === 'hue-saturation')
    return [
      (params.hue ?? 0) / 360,
      params.saturation ?? 0,
      params.lightness ?? 0,
      0
    ]
  if (op === 'levels') {
    return [
      params.inBlack ?? 0,
      params.inWhite ?? 1,
      params.gamma ?? 1,
      params.outBlack ?? 0,
      params.outWhite ?? 1
    ]
  }
  if (op === 'temperature') {
    const rgb = kelvinToRgb(params.temperature ?? 6500)
    return [rgb[0], rgb[1], rgb[2], params.mix ?? 1]
  }
  if (op === 'exposure') {
    const black = params.black ?? 0
    return [black, exposureScale(params.exposure ?? 0, black), 0, 0]
  }
  if (op === 'color-balance') {
    return [
      params.shadowsR ?? 0,
      params.shadowsG ?? 0,
      params.shadowsB ?? 0,
      params.midtonesR ?? 0,
      params.midtonesG ?? 0,
      params.midtonesB ?? 0,
      params.highlightsR ?? 0,
      params.highlightsG ?? 0,
      params.highlightsB ?? 0
    ]
  }
  if (op === 'posterize')
    return [Math.max(2, Math.round(params.levels ?? 4)), 0, 0, 0]
  if (op === 'threshold') return [params.level ?? 0.5, 0, 0, 0]
  if (op === 'vibrance') return [params.amount ?? 0, 0, 0, 0]
  return [0, 0, 0, 0]
}

export function curvesLutData(curves: AdjustCurves | undefined): Uint8Array {
  const luts = buildCurvesLuts({
    master: curves?.master ?? '',
    red: curves?.red ?? '',
    green: curves?.green ?? '',
    blue: curves?.blue ?? ''
  })
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    data[i * 4] = luts.red[i]
    data[i * 4 + 1] = luts.green[i]
    data[i * 4 + 2] = luts.blue[i]
    data[i * 4 + 3] = 255
  }
  return data
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

function brightnessContrast(
  v: number,
  brightness: number,
  contrast: number
): number {
  const b = brightness * 0.5
  const out = b < 0 ? v * (1 + b) : v + (1 - v) * b
  const slant = Math.tan(((contrast + 1) * Math.PI) / 4)
  return (out - 0.5) * slant + 0.5
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hueToRgb(p: number, q: number, t: number): number {
  let x = t
  if (x < 0) x += 1
  if (x > 1) x -= 1
  if (x < 1 / 6) return p + (q - p) * 6 * x
  if (x < 1 / 2) return q
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    hueToRgb(p, q, h + 1 / 3),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1 / 3)
  ]
}

function hueSaturation(
  rgb: [number, number, number],
  hueShift: number,
  saturation: number,
  lightness: number
): [number, number, number] {
  let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  h = (h + hueShift + 1) % 1
  s = clamp01(s * (1 + saturation))
  l = clamp01(lightness > 0 ? l + lightness * (1 - l) : l + lightness * l)
  return hslToRgb(h, s, l)
}

type RGB = [number, number, number]

function levelsChannel(v: number, p: number[]): number {
  const t = clamp01((v - p[0]) / Math.max(p[1] - p[0], 1e-4))
  return p[3] + Math.pow(t, 1 / Math.max(p[2], 1e-4)) * (p[4] - p[3])
}

function balanceComponent(
  v: number,
  l: number,
  s: number,
  m: number,
  h: number
): number {
  const a = 4
  const b = 0.333
  const sc = 0.7
  const sw = s * clamp01((b - l) * a + 0.5) * sc
  const mw =
    m * clamp01((l - b) * a + 0.5) * clamp01((1 - l - b) * a + 0.5) * sc
  const hw = h * clamp01((l + b - 1) * a + 0.5) * sc
  return clamp01(v + sw + mw + hw)
}

function hfun(n: number, h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l)
  const k = (n + h / 30) % 12
  return clamp01(l - a * Math.max(Math.min(Math.min(k - 3, 9 - k), 1), -1))
}

function preservel(c: RGB, l: number): RGB {
  const mx = Math.max(c[0], c[1], c[2])
  const mn = Math.min(c[0], c[1], c[2])
  let h: number
  if (c[0] === c[1] && c[1] === c[2]) h = 0
  else if (mx === c[0]) h = 60 * ((c[1] - c[2]) / (mx - mn))
  else if (mx === c[1]) h = 60 * (2 + (c[2] - c[0]) / (mx - mn))
  else h = 60 * (4 + (c[0] - c[1]) / (mx - mn))
  if (h < 0) h += 360
  const lOut = (mx + mn) / 2
  const denom = 1 - Math.abs(2 * lOut - 1)
  const s = denom <= 1e-6 ? 0 : (mx - mn) / denom
  return [hfun(0, h, s, l), hfun(8, h, s, l), hfun(4, h, s, l)]
}

function colorBalance(c: RGB, p: number[]): RGB {
  const l = (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 2
  const out: RGB = [
    balanceComponent(c[0], l, p[0], p[3], p[6]),
    balanceComponent(c[1], l, p[1], p[4], p[7]),
    balanceComponent(c[2], l, p[2], p[5], p[8])
  ]
  return preservel(out, l)
}

function vibrance(c: RGB, intensity: number): RGB {
  const sat = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])
  const luma = c[1] * 0.715158 + c[0] * 0.212656 + c[2] * 0.072186
  const k = 1 + intensity * (1 + Math.sign(intensity) * sat)
  return [
    clamp01(luma + (c[0] - luma) * k),
    clamp01(luma + (c[1] - luma) * k),
    clamp01(luma + (c[2] - luma) * k)
  ]
}

function applySrgbOp(op: AdjustmentOp, params: number[], c: RGB): RGB {
  switch (op) {
    case 'hue-saturation':
      return hueSaturation(c, params[0], params[1], params[2])
    case 'invert':
      return [1 - c[0], 1 - c[1], 1 - c[2]]
    case 'levels':
      return [
        levelsChannel(c[0], params),
        levelsChannel(c[1], params),
        levelsChannel(c[2], params)
      ]
    case 'temperature':
      return [
        c[0] + (c[0] * params[0] - c[0]) * params[3],
        c[1] + (c[1] * params[1] - c[1]) * params[3],
        c[2] + (c[2] * params[2] - c[2]) * params[3]
      ]
    case 'color-balance':
      return colorBalance(c, params)
    case 'posterize': {
      const n = Math.max(2, params[0]) - 1
      return [
        Math.round(c[0] * n) / n,
        Math.round(c[1] * n) / n,
        Math.round(c[2] * n) / n
      ]
    }
    case 'threshold': {
      const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      const v = y >= params[0] ? 1 : 0
      return [v, v, v]
    }
    case 'vibrance':
      return vibrance(c, params[0])
    default:
      return c
  }
}

export function applyAdjustment(
  op: AdjustmentOp,
  params: number[],
  px: RGBA
): RGBA {
  if (op === 'brightness-contrast') {
    return [
      brightnessContrast(px[0], params[0], params[1]),
      brightnessContrast(px[1], params[0], params[1]),
      brightnessContrast(px[2], params[0], params[1]),
      px[3]
    ]
  }
  if (op === 'exposure') {
    return [
      clamp01((px[0] - params[0]) * params[1]),
      clamp01((px[1] - params[0]) * params[1]),
      clamp01((px[2] - params[0]) * params[1]),
      px[3]
    ]
  }
  const srgb: RGB = [
    linearToSrgb(clamp01(px[0])),
    linearToSrgb(clamp01(px[1])),
    linearToSrgb(clamp01(px[2]))
  ]
  const out = applySrgbOp(op, params, srgb)
  return [
    srgbToLinear(clamp01(out[0])),
    srgbToLinear(clamp01(out[1])),
    srgbToLinear(clamp01(out[2])),
    px[3]
  ]
}
