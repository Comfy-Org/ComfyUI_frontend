import { describe, expect, it } from 'vitest'

import type { RateCard, StorageRate } from '../types/rate-card'
import {
  formatCreditsPerGbMonth,
  formatCreditsPerHour,
  formatStorageExampleAmount,
  formatUsdPerGbMonth,
  formatUsdPerHour,
  getStorageRate,
  groupStorageRatesForDisplay,
  rateCard
} from './rateCard'
import { findRateCardProblems, STORAGE_TYPE_LABEL_KEYS } from './rateCardChecks'

function storageRate(overrides: Partial<StorageRate>): StorageRate {
  return {
    storageType: 'network_standard',
    label: 'Network storage',
    pricePerGbMonthUsd: 0.2,
    creditsPerGbMonth: 42.2,
    ...overrides
  }
}

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

  describe('groupStorageRatesForDisplay', () => {
    it('merges the identically priced network storage tiers into one row', () => {
      const rows = groupStorageRatesForDisplay([
        storageRate({ storageType: 'network_standard' }),
        storageRate({ storageType: 'network_standard_1tb_plus' }),
        storageRate({ storageType: 'network_high_performance' }),
        storageRate({
          storageType: 'container_disk',
          pricePerGbMonthUsd: 0.15,
          creditsPerGbMonth: 31.65
        })
      ])

      expect(rows).toEqual([
        { key: 'storage', pricePerGbMonthUsd: 0.2, creditsPerGbMonth: 42.2 },
        {
          key: 'containerDisk',
          pricePerGbMonthUsd: 0.15,
          creditsPerGbMonth: 31.65
        }
      ])
    })

    it('throws when rates mapped to the same row disagree', () => {
      expect(() =>
        groupStorageRatesForDisplay([
          storageRate({ storageType: 'network_standard' }),
          storageRate({
            storageType: 'network_high_performance',
            pricePerGbMonthUsd: 0.3
          })
        ])
      ).toThrow(
        'Storage rates mapped to "storage" disagree: network_standard is $0.2/GB-mo, network_high_performance is $0.3/GB-mo'
      )
    })

    it('throws for an unmapped storage type', () => {
      expect(() =>
        groupStorageRatesForDisplay([storageRate({ storageType: 'unknown' })])
      ).toThrow('No pricing label mapped for storage type: unknown')
    })
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
