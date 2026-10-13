/**
 * The Virtual try-on run, field for field as `POST /api/run/virtual-try-on`
 * takes it: a multipart form with the `person` and `garment` images, the
 * `fit` and the `seed`. The page holds each image as a URL and sends its
 * bytes under the same key.
 */
export const TRY_ON_FITS = ['slim', 'regular', 'relaxed'] as const
export type TryOnFit = (typeof TRY_ON_FITS)[number]

export const DEFAULT_FIT: TryOnFit = 'regular'

export interface TryOnRequest {
  /** The photo of the person to dress. */
  readonly person: string
  /** A photo of the garment alone, flat lay or product shot. */
  readonly garment: string
  readonly fit: TryOnFit
  readonly seed: number
}

export interface TryOnResult {
  readonly url: string
  readonly seed: number
}
