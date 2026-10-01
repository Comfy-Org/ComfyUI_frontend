export const CUTOUT_BACKGROUNDS = ['transparent', 'white', 'lilac'] as const
export type CutoutBackground = (typeof CUTOUT_BACKGROUNDS)[number]

export const CUTOUT_FORMATS = ['png', 'webp'] as const
export type CutoutFormat = (typeof CUTOUT_FORMATS)[number]

/** The fill behind the subject, as the backend receives it. */
export const BACKGROUND_COLORS = {
  transparent: null,
  white: '#FFFFFF',
  lilac: '#D9CCF5'
} as const satisfies Record<CutoutBackground, string | null>

export const FORMAT_TYPES = {
  png: 'image/png',
  webp: 'image/webp'
} as const satisfies Record<CutoutFormat, string>

/** The settings undo and redo cover. */
export interface CutoutSetup {
  readonly background: CutoutBackground
  readonly format: CutoutFormat
  /** 0 keeps a hard edge, 100 feathers it the most. */
  readonly edgeSoftness: number
  readonly seed: number
}

export const DEFAULT_SETUP: CutoutSetup = {
  background: 'transparent',
  format: 'png',
  edgeSoftness: 20,
  seed: 42
}

/** What a Background Removal backend receives for one run. */
export interface CutoutRequest {
  readonly imageUrl: string
  readonly background: CutoutBackground
  /** Hex fill behind the subject; null keeps the background transparent. */
  readonly backgroundColor: string | null
  readonly format: CutoutFormat
  readonly edgeSoftness: number
  readonly seed: number
}

/** What it answers with: the finished image in the requested format. */
export interface CutoutResult {
  readonly url: string
  readonly background: CutoutBackground
  readonly format: CutoutFormat
  readonly seed: number
}

export function cutoutRequest(
  imageUrl: string,
  setup: CutoutSetup
): CutoutRequest {
  return {
    imageUrl,
    background: setup.background,
    backgroundColor: BACKGROUND_COLORS[setup.background],
    format: setup.format,
    edgeSoftness: setup.edgeSoftness,
    seed: setup.seed
  }
}

/** The download's file name: the photo's name with a cutout suffix. */
export function cutoutFileName(name: string, format: CutoutFormat): string {
  const base = name.replace(/\.[^./]+$/, '') || 'image'
  return `${base}-cutout.${format}`
}
