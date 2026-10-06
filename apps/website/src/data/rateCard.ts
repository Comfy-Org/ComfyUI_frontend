import type { Locale } from '@/config/locales'
import { t } from '@/i18n/translations'
import type { RateCard, StorageRate } from '@/types/rate-card'
import { zRateCard } from '@/types/rate-card/zod.gen'

import type { StorageLabelKey } from './rateCardChecks'
import { STORAGE_TYPE_LABEL_KEYS } from './rateCardChecks'
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

export function formatUsdPerHour(usd: number, locale: Locale = 'en'): string {
  return t(
    'platform.pricing.hourlyPrice',
    { amount: usd.toFixed(2) },
    { locale }
  )
}

export function formatCreditsPerHour(
  credits: number,
  locale: Locale = 'en'
): string {
  return t(
    'platform.pricing.hourlyCredits',
    { amount: credits.toFixed(2) },
    { locale }
  )
}

export function formatUsdPerGbMonth(
  usd: number,
  locale: Locale = 'en'
): string {
  return t(
    'platform.pricing.storagePrice',
    { amount: usd.toFixed(2) },
    { locale }
  )
}

export function formatCreditsPerGbMonth(
  credits: number,
  locale: Locale = 'en'
): string {
  return t(
    'platform.pricing.storageCredits',
    { amount: credits.toFixed(2) },
    { locale }
  )
}

const STORAGE_EXAMPLE_GB = 20

export function formatStorageExampleAmount(rate: StorageRate): string {
  return `$${(STORAGE_EXAMPLE_GB * rate.pricePerGbMonthUsd).toFixed(2)}`
}

export interface StorageDisplayRow {
  key: StorageLabelKey
  pricePerGbMonthUsd: number
  creditsPerGbMonth: number
}

function storageLabelKey(storageType: string): StorageLabelKey {
  const key = STORAGE_TYPE_LABEL_KEYS[storageType]
  if (!key) {
    throw new Error(`No pricing label mapped for storage type: ${storageType}`)
  }
  return key
}

// Several storageTypes (the network-storage tiers) share one display row.
// Group by label key and fail fast if rates mapped to the same row disagree,
// rather than silently rendering one of them.
export function groupStorageRatesForDisplay(
  storage: readonly StorageRate[]
): StorageDisplayRow[] {
  const groups = new Map<StorageLabelKey, StorageRate[]>()
  for (const rate of storage) {
    const key = storageLabelKey(rate.storageType)
    groups.set(key, [...(groups.get(key) ?? []), rate])
  }

  return [...groups.entries()].map(([key, rates]) => {
    const [first, ...rest] = rates
    const mismatch = rest.find(
      (rate) =>
        rate.pricePerGbMonthUsd !== first.pricePerGbMonthUsd ||
        rate.creditsPerGbMonth !== first.creditsPerGbMonth
    )
    if (mismatch) {
      throw new Error(
        `Storage rates mapped to "${key}" disagree: ${first.storageType} is $${first.pricePerGbMonthUsd}/GB-mo, ${mismatch.storageType} is $${mismatch.pricePerGbMonthUsd}/GB-mo`
      )
    }
    return {
      key,
      pricePerGbMonthUsd: first.pricePerGbMonthUsd,
      creditsPerGbMonth: first.creditsPerGbMonth
    }
  })
}
