import { creditsToUsd } from '@comfyorg/shared-frontend-utils/creditsUtil'

/**
 * `~9.5 credits/Image` reads as one number, but it is two things: what a run
 * costs and what it is charged per. The page sets them apart, so it needs them
 * apart.
 */
export function splitPriceLabel(price: string): {
  amount: string
  per?: string
} {
  const at = price.lastIndexOf('/')
  if (at <= 0) return { amount: price }
  return { amount: price.slice(0, at), per: price.slice(at) }
}

/**
 * The structured-data offer behind the estimate the page shows: the same
 * number, in dollars at the published credit rate, with the credits label as
 * its description. An estimate that is not one number (`2 credits x images`)
 * yields no offer; a wrong price is worse than none.
 */
export function offerForEstimate(
  estimate: string | undefined
): { price: number; description: string } | undefined {
  if (!estimate) return undefined
  const match = /^~?\s*(\d+(?:\.\d+)?)\s*credits(?:\/|$)/.exec(estimate)
  if (!match) return undefined
  return { price: creditsToUsd(Number(match[1])), description: estimate }
}
