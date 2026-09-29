import { describe, expect, it } from 'vitest'

import type { RateCard } from '../types/rate-card'
import {
  formatCreditsPerGbMonth,
  formatCreditsPerHour,
  formatStorageExampleAmount,
  formatUsdPerGbMonth,
  formatUsdPerHour,
  getStorageRate,
  rateCard
} from './rateCard'
import { findRateCardProblems, STORAGE_TYPE_LABEL_KEYS } from './rateCardChecks'

function cardWithStorageTypes(storageTypes: string[]): RateCard {
  return {
    gpus: rateCard.gpus,
    storage: storageTypes.map((storageType) => ({
      storageType,
      label: storageType,
      pricePerGbMonthUsd: 0.2,
      creditsPerGbMonth: 42.2
    }))
  }
}

describe('rateCard', () => {
  it('parses the committed snapshot into a validated rate card', () => {
    expect(rateCard.gpus.length).toBeGreaterThan(0)
    expect(rateCard.storage.length).toBeGreaterThan(0)
  })

  it('looks up a storage rate by storageType', () => {
    expect(getStorageRate('network_standard').label).toBe(
      'Network storage — standard, under 1 TB'
    )
  })

  it('throws for an unknown storage type', () => {
    expect(() => getStorageRate('does_not_exist')).toThrow(
      'Unknown storage type in rate card: does_not_exist'
    )
  })

  it('formats USD and credit rates', () => {
    expect(formatUsdPerHour(4.54)).toBe('$4.54/hr')
    expect(formatCreditsPerHour(957.94)).toBe('957.94/hr')
    expect(formatUsdPerGbMonth(0.2)).toBe('$0.20/GB/mo')
    expect(formatCreditsPerGbMonth(42.2)).toBe('42.20/GB/mo')
  })

  it('computes the storage worked example from the storage rate', () => {
    const rate = getStorageRate('network_standard')
    expect(formatStorageExampleAmount(rate)).toBe('$100.00')
  })

  it('maps every storageType in the committed snapshot to a label key', () => {
    for (const rate of rateCard.storage) {
      expect(STORAGE_TYPE_LABEL_KEYS[rate.storageType]).toBeDefined()
    }
  })

  describe('findRateCardProblems', () => {
    it('finds no problems in the committed snapshot', () => {
      expect(findRateCardProblems(rateCard)).toEqual([])
    })

    it('reports a storage entry with no label mapping', () => {
      const card = cardWithStorageTypes(['network_standard', 'unmapped_type'])
      expect(findRateCardProblems(card)).toEqual([
        'No pricing label mapped for storage type: unmapped_type'
      ])
    })

    it('reports a missing network_standard rate', () => {
      const card = cardWithStorageTypes(['container_disk'])
      expect(findRateCardProblems(card)).toEqual([
        'Missing required storage type: network_standard'
      ])
    })
  })
})
