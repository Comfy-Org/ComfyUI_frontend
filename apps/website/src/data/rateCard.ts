import type { RateCard, StorageRate } from '../types/rate-card'
import { zRateCard } from '../types/rate-card/zod.gen'

import rateCardSnapshot from './rate-card.snapshot.json' with { type: 'json' }

// Validated at import time so a malformed snapshot fails the build rather
// than rendering silently wrong prices.
export const rateCard: RateCard = zRateCard.parse(rateCardSnapshot)

export function getStorageRate(storageType: string): StorageRate {
  const rate = rateCard.storage.find((s) => s.storageType === storageType)
  if (!rate) {
    throw new Error(`Unknown storage type in rate card: ${storageType}`)
  }
  return rate
}

export function formatUsdPerHour(usd: number): string {
  return `$${usd.toFixed(2)}/hr`
}

export function formatCreditsPerHour(credits: number): string {
  return `${credits.toFixed(2)}/hr`
}

export function formatUsdPerGbMonth(usd: number): string {
  return `$${usd.toFixed(2)}/GB/mo`
}

export function formatCreditsPerGbMonth(credits: number): string {
  return `${credits.toFixed(2)}/GB/mo`
}

const STORAGE_EXAMPLE_GB = 500

export function formatStorageExampleAmount(rate: StorageRate): string {
  return `$${(STORAGE_EXAMPLE_GB * rate.pricePerGbMonthUsd).toFixed(2)}`
}
