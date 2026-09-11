// Mirrors src/base/credits/comfyCredits.ts in the Cloud app.
const CREDITS_PER_USD = 211

export function usdToCredits(usd: number): number {
  return Math.round(usd * CREDITS_PER_USD)
}

// The same packs and bounds ComfyUI's top-up dialog and platform.comfy.org use,
// so someone who has bought credits there meets the same numbers here.
export const TOP_UP_PACKS = [10, 25, 50, 100] as const
export const MIN_TOP_UP_USD = 5
export const MAX_TOP_UP_USD = 10_000

export function clampTopUp(usd: number): number {
  if (!Number.isFinite(usd)) return MIN_TOP_UP_USD
  return Math.min(MAX_TOP_UP_USD, Math.max(MIN_TOP_UP_USD, Math.round(usd)))
}
