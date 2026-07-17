import { beforeEach, describe, expect, it } from 'vitest'

import {
  deriveAutoReloadState,
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
