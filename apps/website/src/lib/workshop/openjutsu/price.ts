import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { sourceFrames } from './clip'

/**
 * The quote with this run's price worked out. The app proxy charges Openjutsu
 * per frame of the chosen part, at one rate whatever the quality, and rounds
 * up; the page shows the same number before Generate is pressed. A flat price,
 * or a part not chosen yet, leaves the quote as it came.
 */
export function runQuote(
  quote: ReshootQuote,
  seconds: number | undefined
): ReshootQuote {
  const rates = Object.values(quote.price_per_second?.credits ?? {})
  if (rates.length === 0 || seconds === undefined) return quote
  return {
    ...quote,
    price_credits: Math.ceil(sourceFrames(seconds) * rates[0] - 1e-9),
    price_per_second: undefined
  }
}
