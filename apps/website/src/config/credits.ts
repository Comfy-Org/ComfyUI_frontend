// Mirrors src/base/credits/comfyCredits.ts in the Cloud app.
const CREDITS_PER_USD = 211

export const TOP_UP_PRESETS_USD = [10, 25, 50, 100] as const
export const TOP_UP_MIN_USD = 5
export const TOP_UP_MAX_USD = 10_000

export function usdToCredits(usd: number): number {
  return Math.round(usd * CREDITS_PER_USD)
}

export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_USD
}
