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
