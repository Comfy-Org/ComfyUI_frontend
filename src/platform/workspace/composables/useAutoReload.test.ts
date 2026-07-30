import { beforeEach, describe, expect, it } from 'vitest'

import {
  deriveAutoReloadState,
  getAffordableReloadCount,
  useAutoReload
} from '@/platform/workspace/composables/useAutoReload'
import type { AutoReloadConfig } from '@/platform/workspace/composables/useAutoReload'

const configured: AutoReloadConfig = {
  configured: true,
  enabled: true,
  thresholdCredits: 1000,
  reloadCredits: 5000,
  monthlyBudgetCents: 50_000,
  spentThisCycleCents: 4_800
}

describe('getAffordableReloadCount', () => {
  it('uses the rounded credit cost in cents', () => {
    expect(getAffordableReloadCount(7_109, 5_000)).toBe(2)
    expect(getAffordableReloadCount(7_110, 5_000)).toBe(3)
  })

  it.for([
    [Number.NaN, 5_000],
    [Number.POSITIVE_INFINITY, 5_000],
    [-1, 5_000],
    [50_000, Number.NaN],
    [50_000, Number.POSITIVE_INFINITY],
    [50_000, -1],
    [50_000, 0]
  ])(
    'returns zero for invalid inputs (%s, %s)',
    ([budgetCents, reloadCredits]) => {
      expect(getAffordableReloadCount(budgetCents, reloadCredits)).toBe(0)
    }
  )
})

describe('deriveAutoReloadState', () => {
  it('derives an enabled configuration without a budget', () => {
    const state = deriveAutoReloadState({
      ...configured,
      monthlyBudgetCents: null
    })

    expect(state).toMatchObject({
      isConfigured: true,
      isEnabled: true,
      hasBudget: false,
      budgetUsedFraction: 0,
      reloadsLeft: null,
      isPaused: false,
      isWarning: false
    })
  })

  it('distinguishes healthy, near-limit, and exhausted budgets', () => {
    expect(deriveAutoReloadState(configured).isWarning).toBe(false)

    const nearLimit = deriveAutoReloadState({
      ...configured,
      spentThisCycleCents: 47_600
    })
    expect(nearLimit).toMatchObject({
      reloadsLeft: 1,
      isPaused: false,
      isWarning: true
    })

    const cannotFundReload = deriveAutoReloadState({
      ...configured,
      spentThisCycleCents: 47_700
    })
    expect(cannotFundReload).toMatchObject({
      budgetLeftCents: 2300,
      reloadsLeft: 0,
      isPaused: true,
      isWarning: false
    })

    const exhausted = deriveAutoReloadState({
      ...configured,
      spentThisCycleCents: 50_000
    })
    expect(exhausted).toMatchObject({
      budgetLeftCents: 0,
      budgetUsedFraction: 1,
      isPaused: true,
      isWarning: false
    })
  })

  it('clamps progress and does not pause a disabled configuration', () => {
    const state = deriveAutoReloadState({
      ...configured,
      enabled: false,
      spentThisCycleCents: 60_000
    })

    expect(state).toMatchObject({
      budgetUsedFraction: 1,
      isPaused: false,
      isWarning: false
    })
  })

  it('lower-clamps progress and guards invalid usage values', () => {
    const negativeUsage = deriveAutoReloadState({
      ...configured,
      spentThisCycleCents: -1
    })
    expect(negativeUsage).toMatchObject({
      budgetLeftCents: 50_000,
      budgetUsedFraction: 0
    })

    const nonFiniteUsage = deriveAutoReloadState({
      ...configured,
      spentThisCycleCents: Number.POSITIVE_INFINITY
    })
    expect(nonFiniteUsage).toMatchObject({
      budgetTotalCents: 50_000,
      budgetSpentCents: 50_000,
      budgetLeftCents: 0,
      budgetUsedFraction: 1,
      reloadsLeft: 0,
      isPaused: true
    })
  })

  it('fails closed for invalid budgets and reload amounts', () => {
    const invalidBudget = deriveAutoReloadState({
      ...configured,
      monthlyBudgetCents: Number.NaN
    })
    expect(invalidBudget).toMatchObject({
      hasBudget: true,
      budgetTotalCents: 0,
      budgetLeftCents: 0,
      budgetUsedFraction: 1,
      reloadsLeft: 0,
      isPaused: true
    })

    const invalidReload = deriveAutoReloadState({
      ...configured,
      reloadCredits: Number.POSITIVE_INFINITY
    })
    expect(invalidReload).toMatchObject({
      reloadCostCents: 0,
      reloadsLeft: 0,
      isPaused: true
    })
  })
})

describe('useAutoReload', () => {
  const autoReload = useAutoReload()

  beforeEach(() => {
    Object.assign(autoReload.config, {
      configured: false,
      enabled: false,
      thresholdCredits: 1000,
      reloadCredits: 5000,
      monthlyBudgetCents: null,
      spentThisCycleCents: 0
    } satisfies AutoReloadConfig)
  })

  it('saves a configuration and enables auto-reload', () => {
    autoReload.save({
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: 25_000
    })

    expect(autoReload.config).toMatchObject({
      configured: true,
      enabled: true,
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: 25_000
    })
  })

  it('updates the enabled state without discarding the configuration', () => {
    autoReload.save({
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: null
    })

    autoReload.setEnabled(false)

    expect(autoReload.isEnabled.value).toBe(false)
    expect(autoReload.config).toMatchObject({
      configured: true,
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: null
    })
  })
})
