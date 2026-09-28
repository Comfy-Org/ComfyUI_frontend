import { describe, expect, it } from 'vitest'

import {
  formatCreditsPerGbMonth,
  formatCreditsPerHour,
  formatStorageExampleAmount,
  formatUsdPerGbMonth,
  formatUsdPerHour,
  getStorageRate,
  rateCard
} from './rateCard'

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
})
