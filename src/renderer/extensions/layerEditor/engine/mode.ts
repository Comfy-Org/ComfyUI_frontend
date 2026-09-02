export type BlendFn =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'linear-dodge'
  | 'linear-burn'
  | 'vivid-light'
  | 'pin-light'
  | 'linear-light'
  | 'hard-mix'
  | 'subtract'
  | 'divide'
  | 'grain-extract'
  | 'grain-merge'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export type ColorSpace = 'linear' | 'perceptual' | 'lab'

export type CompositeMode =
  | 'union'
  | 'clip-to-backdrop'
  | 'clip-to-layer'
  | 'intersection'

type SpaceOrAuto = ColorSpace | 'auto'

export interface LayerMode {
  blend: BlendFn
  blendSpace: SpaceOrAuto
  compositeSpace: SpaceOrAuto
  composite: CompositeMode
  legacy: boolean
}

export interface EffectiveMode {
  blend: BlendFn
  blendSpace: ColorSpace
  compositeSpace: ColorSpace
  composite: CompositeMode
  legacy: boolean
}

export interface LayerModeDef {
  blend: BlendFn
  defaultBlendSpace: ColorSpace
  defaultCompositeSpace: ColorSpace
  defaultComposite: CompositeMode
}

function def(
  blend: BlendFn,
  blendSpace: ColorSpace,
  composite: CompositeMode
): LayerModeDef {
  return {
    blend,
    defaultBlendSpace: blendSpace,
    defaultCompositeSpace: 'linear',
    defaultComposite: composite
  }
}

const NORMAL_MODE = def('normal', 'linear', 'union')

export const LAYER_MODES: Partial<Record<BlendFn, LayerModeDef>> = {
  normal: NORMAL_MODE,
  multiply: def('multiply', 'linear', 'clip-to-backdrop'),
  screen: def('screen', 'perceptual', 'clip-to-backdrop'),
  overlay: def('overlay', 'perceptual', 'clip-to-backdrop'),
  darken: def('darken', 'linear', 'clip-to-backdrop'),
  lighten: def('lighten', 'linear', 'clip-to-backdrop'),
  'color-dodge': def('color-dodge', 'perceptual', 'clip-to-backdrop'),
  'color-burn': def('color-burn', 'perceptual', 'clip-to-backdrop'),
  'hard-light': def('hard-light', 'perceptual', 'clip-to-backdrop'),
  'soft-light': def('soft-light', 'perceptual', 'clip-to-backdrop'),
  difference: def('difference', 'perceptual', 'clip-to-backdrop'),
  exclusion: def('exclusion', 'perceptual', 'clip-to-backdrop'),
  'linear-dodge': def('linear-dodge', 'linear', 'clip-to-backdrop'),
  'linear-burn': def('linear-burn', 'perceptual', 'clip-to-backdrop'),
  'vivid-light': def('vivid-light', 'perceptual', 'clip-to-backdrop'),
  'pin-light': def('pin-light', 'perceptual', 'clip-to-backdrop'),
  'linear-light': def('linear-light', 'perceptual', 'clip-to-backdrop'),
  'hard-mix': def('hard-mix', 'perceptual', 'clip-to-backdrop'),
  subtract: def('subtract', 'linear', 'clip-to-backdrop'),
  divide: def('divide', 'linear', 'clip-to-backdrop'),
  'grain-extract': def('grain-extract', 'perceptual', 'clip-to-backdrop'),
  'grain-merge': def('grain-merge', 'perceptual', 'clip-to-backdrop'),
  hue: def('hue', 'perceptual', 'clip-to-backdrop'),
  saturation: def('saturation', 'perceptual', 'clip-to-backdrop'),
  color: def('color', 'perceptual', 'clip-to-backdrop'),
  luminosity: def('luminosity', 'linear', 'clip-to-backdrop')
}

export function defaultMode(blend: BlendFn = 'normal'): LayerMode {
  const d = LAYER_MODES[blend] ?? NORMAL_MODE
  return {
    blend,
    blendSpace: 'auto',
    compositeSpace: 'auto',
    composite: d.defaultComposite,
    legacy: false
  }
}

export function resolveMode(
  mode: LayerMode,
  opts?: { groupPassThrough?: boolean }
): EffectiveMode {
  const def = LAYER_MODES[mode.blend] ?? NORMAL_MODE
  if (mode.legacy) {
    return {
      blend: mode.blend,
      blendSpace: 'perceptual',
      compositeSpace: 'perceptual',
      composite: mode.composite,
      legacy: true
    }
  }
  const blend = opts?.groupPassThrough ? 'normal' : mode.blend
  return {
    blend,
    blendSpace:
      mode.blendSpace === 'auto' ? def.defaultBlendSpace : mode.blendSpace,
    compositeSpace:
      mode.compositeSpace === 'auto'
        ? def.defaultCompositeSpace
        : mode.compositeSpace,
    composite: mode.composite,
    legacy: false
  }
}
