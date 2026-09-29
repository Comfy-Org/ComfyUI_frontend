import type { RateCard } from '../types/rate-card'

// Kept free of the snapshot import so the refresh script can still run, and
// replace the snapshot, when the committed one is invalid.

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
