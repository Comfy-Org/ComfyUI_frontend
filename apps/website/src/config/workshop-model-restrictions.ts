import type { FieldValue } from './workshop-playground'

/**
 * Provider rules worth telling a reader before they spend credits.
 *
 * Scoped per page, never per provider: a rule read in one model's
 * documentation is not evidence about its siblings, and the pages that share a
 * provider here do not share a rulebook. Each entry records the document it
 * came from and the date that document was read, so a rule the provider drops
 * can be retired instead of outliving it.
 */

/** The fields holding the two frames, in the order the model reads them. */
export interface FrameRatioRule {
  readonly first: string
  readonly last: string
}

interface RestrictionRecord {
  readonly frameRatio?: FrameRatioRule
  readonly source: string
  readonly reviewed: `${number}-${number}-${number}`
}

const RESTRICTIONS: Readonly<Record<string, RestrictionRecord>> = {
  // The video takes the first frame's aspect ratio, and a last frame shaped
  // differently is stretched to fit it.
  'byteplus--seedance-2-5-first-last-frame--animate-images': {
    frameRatio: {
      first: 'first_frame_url',
      last: 'last_frame_url'
    },
    source: 'https://docs.byteplus.com/en/docs/ModelArk/2607689',
    reviewed: '2026-08-31'
  }
}

export function frameRatioRule(slug: string): FrameRatioRule | undefined {
  return RESTRICTIONS[slug]?.frameRatio
}

/**
 * A frame arrives as an upload or as a URL, depending on whether the reader
 * picked a file or loaded an example.
 */
export interface FrameSource {
  readonly file?: File
  readonly url?: string
}

export function frameSource(
  value: FieldValue | undefined
): FrameSource | undefined {
  if (typeof value === 'string') return value ? { url: value } : undefined
  if (Array.isArray(value)) return frameSource(value[0])
  if (typeof value !== 'object') return undefined
  return value.file || value.previewUrl
    ? { file: value.file, url: value.previewUrl }
    : undefined
}

export interface FrameSize {
  readonly width: number
  readonly height: number
}

/**
 * A frame measured at 1919x1080 rather than 1920x1080 is the same frame as far
 * as the provider is concerned, so the comparison is relative and forgiving.
 */
const RATIO_TOLERANCE = 0.01

export function framesDisagreeOnRatio(
  first: FrameSize | undefined,
  last: FrameSize | undefined
): boolean {
  if (!first || !last) return false
  const firstRatio = aspectRatio(first)
  const lastRatio = aspectRatio(last)
  if (firstRatio === undefined || lastRatio === undefined) return false
  return (
    Math.abs(firstRatio - lastRatio) / Math.max(firstRatio, lastRatio) >
    RATIO_TOLERANCE
  )
}

function aspectRatio({ width, height }: FrameSize): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined
  if (width <= 0 || height <= 0) return undefined
  return width / height
}
