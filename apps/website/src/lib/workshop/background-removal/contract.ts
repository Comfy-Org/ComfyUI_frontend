export const CUTOUT_MODES = ['remove', 'replace', 'adjust'] as const
export type CutoutMode = (typeof CUTOUT_MODES)[number]

export const CUTOUT_FORMATS = ['png', 'webp'] as const
export type CutoutFormat = (typeof CUTOUT_FORMATS)[number]

export const FORMAT_TYPES = {
  png: 'image/png',
  webp: 'image/webp'
} as const satisfies Record<CutoutFormat, string>

/** What goes behind the subject in Remove: nothing, or a flat colour. */
export type CutoutBackground =
  | { readonly kind: 'transparent' }
  | { readonly kind: 'color'; readonly color: string }

/** Remove's swatches in grid order; the custom picker comes after them. */
export const BACKGROUND_SWATCHES = [
  { id: 'transparent', color: null },
  { id: 'white', color: '#ffffff' },
  { id: 'lilac', color: '#d9ccf5' },
  { id: 'sand', color: '#e9dfcf' },
  { id: 'sage', color: '#c9d5c0' },
  { id: 'sky', color: '#c7d9e8' },
  { id: 'blush', color: '#efd3cf' },
  { id: 'butter', color: '#f3e6b3' },
  { id: 'clay', color: '#c98b6b' },
  { id: 'navy', color: '#26324a' },
  { id: 'ink', color: '#1c1b1f' }
] as const satisfies readonly { id: string; color: string | null }[]
export type SwatchId = (typeof BACKGROUND_SWATCHES)[number]['id']

export function swatchBackground(color: string | null): CutoutBackground {
  return color ? { kind: 'color', color } : { kind: 'transparent' }
}

/** The swatch a background is, or undefined for a custom colour. */
export function backgroundSwatch(background: CutoutBackground) {
  return BACKGROUND_SWATCHES.find(({ color }) =>
    background.kind === 'transparent'
      ? color === null
      : color === background.color
  )
}

export const REPLACE_MODELS = [
  { id: 'auto', label: null },
  { id: 'vertexai--gemini-nano-banana-2--edit-images', label: 'Nano Banana 2' },
  {
    id: 'qwen--qwen-image-3.0-image-edit--edit-images',
    label: 'Qwen Image 3.0'
  },
  { id: 'bfl--flux-kontext-pro--edit-images', label: 'FLUX.1 Kontext Pro' },
  { id: 'byteplus--seedream-4-5--edit-images', label: 'Seedream 4.5' }
] as const satisfies readonly { id: string; label: string | null }[]
export type ReplaceModel = (typeof REPLACE_MODELS)[number]['id']

export interface ReplaceSetup {
  readonly prompt: string
  readonly model: ReplaceModel
  /** A picture of the background to aim for. */
  readonly referenceUrl?: string
  /** How many backgrounds to generate; the page asks for one. */
  readonly count: number
  readonly seed: number
}

export const ADJUST_TARGETS = ['background', 'foreground'] as const
export type AdjustTarget = (typeof ADJUST_TARGETS)[number]

export const ADJUST_FILTERS = [
  { id: 'blur', max: 100, unit: '' },
  { id: 'grayscale', max: 100, unit: '%' },
  { id: 'sepia', max: 100, unit: '%' },
  { id: 'brightness', max: 200, unit: '%' },
  { id: 'contrast', max: 200, unit: '%' },
  { id: 'saturation', max: 200, unit: '%' }
] as const
export type AdjustFilter = (typeof ADJUST_FILTERS)[number]['id']

export type AdjustSetup = {
  readonly target: AdjustTarget
} & Readonly<Record<AdjustFilter, number>>

/** The settings undo and redo cover. */
export interface CutoutSetup {
  readonly mode: CutoutMode
  readonly background: CutoutBackground
  readonly replace: ReplaceSetup
  readonly adjust: AdjustSetup
  readonly format: CutoutFormat
  /** 0 keeps a hard edge, 100 feathers it the most. */
  readonly edgeSoftness: number
}

export const DEFAULT_ADJUST: AdjustSetup = {
  target: 'background',
  blur: 0,
  grayscale: 0,
  sepia: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100
}

export const DEFAULT_SETUP: CutoutSetup = {
  mode: 'remove',
  background: { kind: 'transparent' },
  replace: { prompt: '', model: 'auto', count: 1, seed: 42 },
  adjust: DEFAULT_ADJUST,
  format: 'png',
  edgeSoftness: 20
}

/** At 100, Blur softens by this share of the photo's width. */
export const MAX_BLUR = 0.03

/**
 * Adjust's values as a CSS filter, the same string for the live preview
 * and the canvas. `blurLength` turns a share of the width into a length.
 */
export function adjustFilter(
  adjust: AdjustSetup,
  blurLength: (share: number) => string
): string {
  const parts = [
    adjust.blur > 0 && `blur(${blurLength((adjust.blur / 100) * MAX_BLUR)})`,
    adjust.grayscale > 0 && `grayscale(${adjust.grayscale}%)`,
    adjust.sepia > 0 && `sepia(${adjust.sepia}%)`,
    adjust.brightness !== 100 && `brightness(${adjust.brightness}%)`,
    adjust.contrast !== 100 && `contrast(${adjust.contrast}%)`,
    adjust.saturation !== 100 && `saturate(${adjust.saturation}%)`
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : 'none'
}

/**
 * Why a setup cannot run yet, or undefined when it can: Replace needs a
 * description or a reference picture.
 */
export function missingInput(setup: CutoutSetup): 'replace' | undefined {
  const { prompt, referenceUrl } = setup.replace
  return setup.mode === 'replace' && !prompt.trim() && !referenceUrl
    ? 'replace'
    : undefined
}

interface CutoutRequestBase {
  readonly imageUrl: string
  readonly format: CutoutFormat
  readonly edgeSoftness: number
}

/** What a Background Removal backend receives for one run. */
export type CutoutRequest = CutoutRequestBase &
  (
    | { readonly mode: 'remove'; readonly background: CutoutBackground }
    | { readonly mode: 'replace'; readonly replace: ReplaceSetup }
    | { readonly mode: 'adjust'; readonly adjust: AdjustSetup }
  )

/** What it answers with: the finished image in the requested format. */
export interface CutoutResult {
  readonly url: string
  readonly mode: CutoutMode
  readonly format: CutoutFormat
  /** True when the image keeps an alpha channel behind the subject. */
  readonly transparent: boolean
}

export function cutoutRequest(
  imageUrl: string,
  setup: CutoutSetup
): CutoutRequest {
  const base = {
    imageUrl,
    format: setup.format,
    edgeSoftness: setup.edgeSoftness
  }
  if (setup.mode === 'replace')
    return { ...base, mode: 'replace', replace: setup.replace }
  if (setup.mode === 'adjust')
    return { ...base, mode: 'adjust', adjust: setup.adjust }
  return { ...base, mode: 'remove', background: setup.background }
}

const FILE_SUFFIX = {
  remove: 'cutout',
  replace: 'new-background',
  adjust: 'adjusted'
} as const satisfies Record<CutoutMode, string>

/** The download's file name: the photo's name with the mode's suffix. */
export function cutoutFileName(
  name: string,
  mode: CutoutMode,
  format: CutoutFormat
): string {
  const base = name.replace(/\.[^./]+$/, '') || 'image'
  return `${base}-${FILE_SUFFIX[mode]}.${format}`
}
