import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReshootRun } from '@/lib/workshop/cinematic-studio/reshoot-engine/notes'
import { quoteNote } from '@/lib/workshop/cinematic-studio/reshoot-engine/notes'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { SwapSize } from './clip'
import { RESOLUTION } from './workflow'

/** What a run is priced from: the seconds it asks for and its quality. */
export interface SwapPriceRun {
  readonly seconds?: number
  readonly size?: SwapSize
}

type PerSecond = NonNullable<ReshootQuote['price_per_second']>

function secondRate(
  priced: PerSecond,
  size: SwapSize | undefined
): number | undefined {
  if (priced.tier_input !== 'resolution' || priced.tier_match === 'at_most')
    return undefined
  if (size) return priced.credits[String(RESOLUTION[size])]
  const rates = new Set(Object.values(priced.credits))
  return rates.size === 1 ? [...rates][0] : undefined
}

/** The quote priced for this run as the app proxy charges it; undefined when the page cannot price it. */
export function runQuote(
  quote: ReshootQuote,
  run: SwapPriceRun
): ReshootQuote | undefined {
  if (!quote.price_per_second) return quote
  const rate = run.size && secondRate(quote.price_per_second, run.size)
  if (rate === undefined || run.seconds === undefined) return undefined
  return {
    ...quote,
    price_credits: Math.ceil(run.seconds * rate - 1e-9),
    price_per_second: undefined
  }
}

/** The credits per second a paid run costs, before a part is chosen. */
export function perSecondNote(
  quote: ReshootQuote,
  size: SwapSize | undefined,
  locale: Locale
): string | undefined {
  const priced = quote.price_per_second
  const rate = priced && secondRate(priced, size)
  if (rate === undefined || quote.next_run !== 'paid') return undefined
  return translationsFor(locale).t('reshoot.quote.perSecond', {
    rate: rate.toLocaleString(locale)
  })
}

/** Whether the page can show what this run will cost before it starts. */
export const priceReadable = (
  quote: ReshootQuote | undefined,
  run: SwapPriceRun
) => !quote?.price_per_second || runQuote(quote, run) !== undefined

/** The line under Generate: the price of this run, the rate before a part is chosen, or that it is unknown. */
export function swapPriceNote(
  quote: ReshootQuote,
  run: ReshootRun & SwapPriceRun,
  locale: Locale
): string {
  if (!quote.price_per_second || quote.next_run === 'free')
    return quoteNote(quote, locale, run)
  const priced = runQuote(quote, run)
  if (priced) return quoteNote(priced, locale, run)
  const unknown = translationsFor(locale).t('reshoot.quote.priceUnknown')
  if (run.seconds !== undefined) return unknown
  return quote.next_run === 'paid'
    ? (perSecondNote(quote, run.size, locale) ?? unknown)
    : quoteNote(quote, locale, run)
}
