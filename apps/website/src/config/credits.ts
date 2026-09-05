// Mirrors src/base/credits/comfyCredits.ts in the Cloud app.
const CREDITS_PER_USD = 211

export function usdToCredits(usd: number): number {
  return Math.round(usd * CREDITS_PER_USD)
}
