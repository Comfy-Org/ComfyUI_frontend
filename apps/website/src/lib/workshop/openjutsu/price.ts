import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReshootRun } from '@/lib/workshop/cinematic-studio/reshoot-engine/notes'
import { quoteNote } from '@/lib/workshop/cinematic-studio/reshoot-engine/notes'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { SwapCanvas } from './clip'
import { FPS, gridFrames } from './clip'

/** What a run is priced from: the part's seconds and the canvas H3 generates on. */
export interface SwapPriceRun {
  readonly seconds?: number
  readonly canvas?: SwapCanvas
}

type PerSecond = NonNullable<ReshootQuote['price_per_second']>

const megapixels = (canvas: SwapCanvas) => (canvas.width * canvas.height) / 1e6

function areaTiers(priced: PerSecond) {
  return Object.entries(priced.credits)
    .map(([most, rate]) => ({ most: Number(most), rate }))
    .filter(({ most }) => Number.isFinite(most))
    .sort((a, b) => a.most - b.most)
}

function frameRate(
  priced: PerSecond,
  canvas: SwapCanvas | undefined
): number | undefined {
  if (priced.tier_input !== 'megapixels' || priced.tier_match !== 'at_most')
    return undefined
  const tiers = areaTiers(priced)
  if (canvas) return tiers.find(({ most }) => megapixels(canvas) <= most)?.rate
  const rates = new Set(tiers.map(({ rate }) => rate))
  return rates.size === 1 ? tiers[0]?.rate : undefined
}

/** The quote priced for this run as the app proxy charges it; undefined when the page cannot price it. */
export function runQuote(
  quote: ReshootQuote,
  run: SwapPriceRun
): ReshootQuote | undefined {
  if (!quote.price_per_second) return quote
  const rate = run.canvas && frameRate(quote.price_per_second, run.canvas)
  if (rate === undefined || run.seconds === undefined) return undefined
  return {
    ...quote,
    price_credits: Math.ceil(gridFrames(run.seconds) * rate - 1e-9),
    price_per_second: undefined
  }
}

/** The credits per second a paid run costs, before a part is chosen. */
export function perSecondNote(
  quote: ReshootQuote,
  canvas: SwapCanvas | undefined,
  locale: Locale
): string | undefined {
  const priced = quote.price_per_second
  const rate = priced && frameRate(priced, canvas)
  if (rate === undefined || quote.next_run !== 'paid') return undefined
  return translationsFor(locale).t('reshoot.quote.perSecond', {
    rate: (Math.round(rate * FPS * 100) / 100).toLocaleString(locale)
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
    ? (perSecondNote(quote, run.canvas, locale) ?? unknown)
    : quoteNote(quote, locale, run)
}
