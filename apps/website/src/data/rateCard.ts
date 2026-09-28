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

export type StorageLabelKey =
  | 'standardUnder1tb'
  | 'standardOver1tb'
  | 'highPerformance'
  | 'containerDisk'

// Maps the rate card's stable storageType to the i18n label keys used by
// PricingSection, which predate the rate card and read better split into
// title + sub-label.
export const STORAGE_TYPE_LABEL_KEYS: Partial<Record<string, StorageLabelKey>> =
  {
    network_standard: 'standardUnder1tb',
    network_standard_1tb_plus: 'standardOver1tb',
    network_high_performance: 'highPerformance',
    container_disk: 'containerDisk'
  }

// The storage type PricingSection's worked example is computed from; a
// snapshot missing it would fail at render time, so the refresh script
// checks for it up front via findRateCardProblems.
const REQUIRED_STORAGE_TYPE = 'network_standard'

// Pure so the refresh script can reject a bad response before writing the
// snapshot, instead of only failing later when the page renders.
export function findRateCardProblems(card: RateCard): string[] {
  const problems: string[] = []
  for (const rate of card.storage) {
    if (!(rate.storageType in STORAGE_TYPE_LABEL_KEYS)) {
      problems.push(
        `No pricing label mapped for storage type: ${rate.storageType}`
      )
    }
  }
  if (
    !card.storage.some((rate) => rate.storageType === REQUIRED_STORAGE_TYPE)
  ) {
    problems.push(`Missing required storage type: ${REQUIRED_STORAGE_TYPE}`)
  }
  return problems
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
