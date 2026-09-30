import type { CreditRange } from '../../../config/workshop-node-pricing'
import type { Locale } from '../../../i18n/translations'
import type { AspectRatio, Resolution } from './catalog'
import { MAX_TAKES } from './catalog'

/** Credits per take, keyed by {@link priceKey}. */
export type CinematicPrices = Readonly<Record<string, CreditRange>>

export function priceKey(
  aspect: AspectRatio,
  resolution: Resolution,
  references: number
): string {
  return `${aspect} ${resolution} ${references}`
}

export interface ShotEstimate {
  readonly takes: number
  readonly perTake: CreditRange
  readonly total: CreditRange
}

export function shotEstimate(
  prices: CinematicPrices | undefined,
  shot: {
    readonly aspect: AspectRatio
    readonly resolution: Resolution
    readonly references: number
    readonly takes: number
  }
): ShotEstimate | undefined {
  const perTake =
    prices?.[priceKey(shot.aspect, shot.resolution, shot.references)]
  return (
    perTake && {
      takes: shot.takes,
      perTake,
      total: { min: perTake.min * shot.takes, max: perTake.max * shot.takes }
    }
  )
}

/** How many takes a balance covers at the low end of the estimate. */
export function takesWithin(credits: number, perTake: CreditRange): number {
  if (perTake.min <= 0) return MAX_TAKES
  return Math.min(MAX_TAKES, Math.floor(credits / perTake.min))
}

export function formatCreditRange(range: CreditRange, locale: Locale): string {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const min = format.format(range.min)
  const max = format.format(range.max)
  return min === max ? min : `${min}–${max}`
}
