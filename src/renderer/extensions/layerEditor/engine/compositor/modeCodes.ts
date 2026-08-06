import type { BlendFn, ColorSpace, CompositeMode, EffectiveMode } from '../mode'

export const BLEND_CODE: Record<BlendFn, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  'color-dodge': 6,
  'color-burn': 7,
  'hard-light': 8,
  'soft-light': 9,
  difference: 10,
  exclusion: 11,
  'linear-dodge': 12,
  'linear-burn': 13,
  'vivid-light': 14,
  'pin-light': 15,
  hue: 16,
  saturation: 17,
  color: 18,
  luminosity: 19,
  'linear-light': 20,
  'hard-mix': 21,
  subtract: 22,
  divide: 23,
  'grain-extract': 24,
  'grain-merge': 25
}

export const COMPOSITE_CODE: Record<CompositeMode, number> = {
  union: 0,
  'clip-to-backdrop': 1,
  'clip-to-layer': 2,
  intersection: 3
}

export const SPACE_CODE: Record<ColorSpace, number> = {
  linear: 0,
  perceptual: 1,
  lab: 2
}

export interface ModeUniforms {
  blend: number
  composite: number
  blendSpace: number
  compositeSpace: number
  legacy: boolean
}

export function modeUniforms(mode: EffectiveMode): ModeUniforms {
  return {
    blend: BLEND_CODE[mode.blend],
    composite: COMPOSITE_CODE[mode.composite],
    blendSpace: SPACE_CODE[mode.blendSpace],
    compositeSpace: SPACE_CODE[mode.compositeSpace],
    legacy: mode.legacy
  }
}
