import type { Layer, RGB, VectorContent } from 'ag-psd'

import type { FillSpec, GradientStop } from './engine/fill'
import type { BlendFn } from './engine/mode'

export const PSD_BLEND_MODES: Partial<
  Record<BlendFn, NonNullable<Layer['blendMode']>>
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

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

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
