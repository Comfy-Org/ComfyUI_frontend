import { linearToSrgb, luminance, srgbToLinear } from './color'
import type { BlendFn, ColorSpace, CompositeMode, EffectiveMode } from './mode'

export type RGB = [number, number, number]
export type RGBA = [number, number, number, number]

const EPSILON = 1e-6

function safeDiv(a: number, b: number): number {
  return Math.abs(b) < EPSILON ? 0 : a / b
}

const CHANNEL_BLEND: Partial<
  Record<BlendFn, (i: number, l: number) => number>
> = {
  normal: (_i, l) => l,
  multiply: (i, l) => i * l,
  screen: (i, l) => 1 - (1 - i) * (1 - l),
  overlay: (i, l) => (i < 0.5 ? 2 * i * l : 1 - 2 * (1 - l) * (1 - i)),
  darken: (i, l) => Math.min(i, l),
  lighten: (i, l) => Math.max(i, l),
  'color-dodge': (i, l) => safeDiv(i, 1 - l),
  'color-burn': (i, l) => 1 - safeDiv(1 - i, l),
  'hard-light': (i, l) =>
    l > 0.5
      ? Math.min(1 - (1 - i) * (1 - (l - 0.5) * 2), 1)
      : Math.min(i * (l * 2), 1),
  'soft-light': (i, l) => {
    const mult = i * l
    const scr = 1 - (1 - i) * (1 - l)
    return (1 - i) * mult + i * scr
  },
  difference: (i, l) => Math.abs(i - l),
  exclusion: (i, l) => 0.5 - 2 * (i - 0.5) * (l - 0.5),
  'linear-dodge': (i, l) => i + l,
  'linear-burn': (i, l) => i + l - 1,
  'vivid-light': (i, l) =>
    l <= 0.5
      ? Math.max(1 - safeDiv(1 - i, 2 * l), 0)
      : Math.min(safeDiv(i, 2 * (1 - l)), 1),
  'pin-light': (i, l) =>
    l > 0.5 ? Math.max(i, 2 * (l - 0.5)) : Math.min(i, 2 * l),
  'linear-light': (i, l) => i + 2 * l - 1,
  'hard-mix': (i, l) => (i + l < 1 ? 0 : 1),
  subtract: (i, l) => Math.max(i - l, 0),
  divide: (i, l) => Math.max(0, Math.min(i / Math.max(l, EPSILON), 1)),
  'grain-extract': (i, l) => i - l + 0.5,
  'grain-merge': (i, l) => i + l - 0.5
}

function blendHue(i: RGB, l: RGB): RGB {
  const srcMin = Math.min(l[0], l[1], l[2])
  const srcMax = Math.max(l[0], l[1], l[2])
  const srcDelta = srcMax - srcMin
  if (srcDelta <= EPSILON) return [...i]
  const destMin = Math.min(i[0], i[1], i[2])
  const destMax = Math.max(i[0], i[1], i[2])
  const destDelta = destMax - destMin
  const destS = destMax ? destDelta / destMax : 0
  const ratio = (destS * destMax) / srcDelta
  const offset = destMax - srcMax * ratio
  return [l[0] * ratio + offset, l[1] * ratio + offset, l[2] * ratio + offset]
}

function blendSaturation(i: RGB, l: RGB): RGB {
  const destMin = Math.min(i[0], i[1], i[2])
  const destMax = Math.max(i[0], i[1], i[2])
  const destDelta = destMax - destMin
  if (destDelta <= EPSILON) return [destMax, destMax, destMax]
  const srcMin = Math.min(l[0], l[1], l[2])
  const srcMax = Math.max(l[0], l[1], l[2])
  const srcDelta = srcMax - srcMin
  const srcS = srcMax ? srcDelta / srcMax : 0
  const ratio = (srcS * destMax) / destDelta
  const offset = (1 - ratio) * destMax
  return [i[0] * ratio + offset, i[1] * ratio + offset, i[2] * ratio + offset]
}

function blendColor(i: RGB, l: RGB): RGB {
  const destMin = Math.min(i[0], i[1], i[2])
  const destMax = Math.max(i[0], i[1], i[2])
  let destL = (destMin + destMax) / 2
  const srcMin = Math.min(l[0], l[1], l[2])
  const srcMax = Math.max(l[0], l[1], l[2])
  let srcL = (srcMin + srcMax) / 2
  if (Math.abs(srcL) <= EPSILON || Math.abs(1 - srcL) <= EPSILON) {
    return [destL, destL, destL]
  }
  const destHigh = destL > 0.5
  const srcHigh = srcL > 0.5
  destL = Math.min(destL, 1 - destL)
  srcL = Math.min(srcL, 1 - srcL)
  const ratio = destL / srcL
  let offset = 0
  if (destHigh) offset += 1 - 2 * destL
  if (srcHigh) offset += 2 * destL - ratio
  return [l[0] * ratio + offset, l[1] * ratio + offset, l[2] * ratio + offset]
}

function blendLuminosity(i: RGB, l: RGB): RGB {
  const inY = luminance(i[0], i[1], i[2])
  const layerY = luminance(l[0], l[1], l[2])
  const ratio = safeDiv(layerY, inY)
  return [i[0] * ratio, i[1] * ratio, i[2] * ratio]
}

const HSL_BLEND: Partial<Record<BlendFn, (i: RGB, l: RGB) => RGB>> = {
  hue: blendHue,
  saturation: blendSaturation,
  color: blendColor,
  luminosity: blendLuminosity
}

export function blendPixel(blend: BlendFn, inRGB: RGB, layerRGB: RGB): RGB {
  const hsl = HSL_BLEND[blend]
  if (hsl) return hsl(inRGB, layerRGB)
  const fn = CHANNEL_BLEND[blend] ?? CHANNEL_BLEND.normal!
  return [
    fn(inRGB[0], layerRGB[0]),
    fn(inRGB[1], layerRGB[1]),
    fn(inRGB[2], layerRGB[2])
  ]
}

function compositeUnion(inC: RGBA, layer: RGBA, comp: RGB, cov: number): RGBA {
  const inA = inC[3]
  const layerA = layer[3] * cov
  const newA = layerA + (1 - layerA) * inA
  if (layerA === 0 || newA === 0) return [inC[0], inC[1], inC[2], newA]
  if (inA === 0) return [layer[0], layer[1], layer[2], newA]
  const ratio = layerA / newA
  const out: RGBA = [0, 0, 0, newA]
  for (let b = 0; b < 3; b++) {
    out[b] = ratio * (inA * (comp[b] - layer[b]) + layer[b] - inC[b]) + inC[b]
  }
  return out
}

function compositeClipToBackdrop(
  inC: RGBA,
  layer: RGBA,
  comp: RGB,
  cov: number
): RGBA {
  const layerA = layer[3] * cov
  if (inC[3] === 0 || layerA === 0) return [inC[0], inC[1], inC[2], inC[3]]
  return [
    comp[0] * layerA + inC[0] * (1 - layerA),
    comp[1] * layerA + inC[1] * (1 - layerA),
    comp[2] * layerA + inC[2] * (1 - layerA),
    inC[3]
  ]
}

function compositeClipToLayer(
  inC: RGBA,
  layer: RGBA,
  comp: RGB,
  cov: number
): RGBA {
  const inA = inC[3]
  const layerA = layer[3] * cov
  if (layerA === 0) return [inC[0], inC[1], inC[2], layerA]
  if (inA === 0) return [layer[0], layer[1], layer[2], layerA]
  return [
    comp[0] * inA + layer[0] * (1 - inA),
    comp[1] * inA + layer[1] * (1 - inA),
    comp[2] * inA + layer[2] * (1 - inA),
    layerA
  ]
}

function compositeIntersection(
  inC: RGBA,
  layer: RGBA,
  comp: RGB,
  cov: number
): RGBA {
  const newA = inC[3] * layer[3] * cov
  if (newA === 0) return [inC[0], inC[1], inC[2], 0]
  return [comp[0], comp[1], comp[2], newA]
}

function runComposite(
  mode: CompositeMode,
  inC: RGBA,
  layer: RGBA,
  comp: RGB,
  cov: number
): RGBA {
  switch (mode) {
    case 'clip-to-backdrop':
      return compositeClipToBackdrop(inC, layer, comp, cov)
    case 'clip-to-layer':
      return compositeClipToLayer(inC, layer, comp, cov)
    case 'intersection':
      return compositeIntersection(inC, layer, comp, cov)
    case 'union':
    default:
      return compositeUnion(inC, layer, comp, cov)
  }
}

function toSpace(rgb: RGB, space: ColorSpace): RGB {
  if (space === 'linear') return rgb

  return [linearToSrgb(rgb[0]), linearToSrgb(rgb[1]), linearToSrgb(rgb[2])]
}

function fromSpace(rgb: RGB, space: ColorSpace): RGB {
  if (space === 'linear') return rgb
  return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])]
}

export function blendComposite(
  mode: EffectiveMode,
  backdrop: RGBA,
  layer: RGBA,
  opacity: number,
  mask: number | null = null
): RGBA {
  const cov = opacity * (mask ?? 1)

  const inB = toSpace([backdrop[0], backdrop[1], backdrop[2]], mode.blendSpace)
  const layerB = toSpace([layer[0], layer[1], layer[2]], mode.blendSpace)
  let comp = blendPixel(mode.blend, inB, layerB)
  comp = fromSpace(comp, mode.blendSpace)

  if (mode.compositeSpace === 'linear') {
    return runComposite(mode.composite, backdrop, layer, comp, cov)
  }

  const inC = toSpace(
    [backdrop[0], backdrop[1], backdrop[2]],
    mode.compositeSpace
  )
  const layerC = toSpace([layer[0], layer[1], layer[2]], mode.compositeSpace)
  const compC = toSpace(comp, mode.compositeSpace)
  const out = runComposite(
    mode.composite,
    [inC[0], inC[1], inC[2], backdrop[3]],
    [layerC[0], layerC[1], layerC[2], layer[3]],
    compC,
    cov
  )
  const back = fromSpace([out[0], out[1], out[2]], mode.compositeSpace)
  return [back[0], back[1], back[2], out[3]]
}
