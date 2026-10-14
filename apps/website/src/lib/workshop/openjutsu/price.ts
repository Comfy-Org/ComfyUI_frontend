import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { FPS, sourceFrames } from './clip'

/**
 * Credits per frame, when the quote prices Openjutsu as its catalog entry
 * does: one rate, read from `VideoFrameSample` with `seed` (always 0) as the
 * only tier. Any other shape is one the page cannot price, so it shows none
 * rather than a number the proxy would not charge.
 */
function frameRate(quote: ReshootQuote): number | undefined {
  const priced = quote.price_per_second
  return priced?.tier_input === 'seed' ? priced.credits['0'] : undefined
}

/**
 * The quote with this run's price worked out, rounded up as the proxy
 * charges it. A flat price comes back as it was; a per-second price the page
 * cannot read comes back as nothing.
 */
export function runQuote(
  quote: ReshootQuote,
  seconds: number | undefined
): ReshootQuote | undefined {
  if (!quote.price_per_second) return quote
  const rate = frameRate(quote)
  if (rate === undefined || seconds === undefined) return undefined
  return {
    ...quote,
    price_credits: Math.ceil(sourceFrames(seconds) * rate - 1e-9),
    price_per_second: undefined
  }
}

/** The rate per second of result, before a part is chosen. */
export function perSecondNote(
  quote: ReshootQuote,
  locale: Locale
): string | undefined {
  const rate = frameRate(quote)
  if (rate === undefined || quote.next_run !== 'paid') return undefined
  return translationsFor(locale).t('reshoot.quote.perSecond', {
    rate: (Math.round(rate * FPS * 100) / 100).toLocaleString(locale)
  })
}
