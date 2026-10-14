import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { FPS, sourceFrames } from './clip'

function frameRate(quote: ReshootQuote): number | undefined {
  const priced = quote.price_per_second
  return priced?.tier_input === 'seed' ? priced.credits['0'] : undefined
}

/** The quote priced for a part of `seconds`, as the app proxy charges it; undefined when the page cannot price it. */
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

/** The credits per second a paid run costs, before a part is chosen. */
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
