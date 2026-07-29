import { beforeEach, describe, expect, it, vi } from 'vitest'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { AutoReloadResponse } from '@/platform/workspace/api/workspaceApi'

import {
  deriveAutoReloadState,
  getAffordableReloadCount,
  useAutoReload
} from '@/platform/workspace/composables/useAutoReload'
import type { AutoReloadConfig } from '@/platform/workspace/composables/useAutoReload'

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getAutoReload: vi.fn(),
    updateAutoReload: vi.fn()
  }
}))

const unconfiguredResponse: AutoReloadResponse = {
  configured: false,
  enabled: false,
  threshold_credits: null,
  reload_credits: null,
  monthly_budget_cents: null,
  spent_this_cycle_cents: 0
}

const configuredResponse: AutoReloadResponse = {
  configured: true,
  enabled: true,
  threshold_credits: 2000,
  reload_credits: 6000,
  monthly_budget_cents: 25_000,
  spent_this_cycle_cents: 1200
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

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

  beforeEach(async () => {
    vi.resetAllMocks()
    await autoReload.scopeToWorkspace(null)
    vi.mocked(workspaceApi.getAutoReload).mockResolvedValue(
      unconfiguredResponse
    )
    await autoReload.scopeToWorkspace('workspace-a')
  })

  it('maps persisted settings and only supplies defaults for an unconfigured response', async () => {
    expect(autoReload.config).toEqual({
      configured: false,
      enabled: false,
      thresholdCredits: 1000,
      reloadCredits: 5000,
      monthlyBudgetCents: null,
      spentThisCycleCents: 0
    })
    expect(autoReload.isInitialized.value).toBe(true)

    vi.mocked(workspaceApi.getAutoReload).mockResolvedValueOnce(
      configuredResponse
    )
    await autoReload.scopeToWorkspace('workspace-b')

    expect(autoReload.config).toEqual({
      configured: true,
      enabled: true,
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: 25_000,
      spentThisCycleCents: 1200
    })
  })

  it('retries the initial GET once and exposes a retryable terminal error', async () => {
    vi.mocked(workspaceApi.getAutoReload)
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(configuredResponse)

    await autoReload.scopeToWorkspace('workspace-b')

    expect(workspaceApi.getAutoReload).toHaveBeenCalledTimes(3)
    expect(autoReload.config.configured).toBe(true)
    expect(autoReload.error.value).toBeNull()

    vi.mocked(workspaceApi.getAutoReload).mockRejectedValue(
      new Error('still unavailable')
    )
    await autoReload.scopeToWorkspace('workspace-c')

    expect(workspaceApi.getAutoReload).toHaveBeenCalledTimes(5)
    expect(autoReload.isInitialized.value).toBe(false)
    expect(autoReload.error.value).toBe('still unavailable')

    vi.mocked(workspaceApi.getAutoReload).mockResolvedValueOnce(
      configuredResponse
    )
    await autoReload.retry()
    expect(autoReload.isInitialized.value).toBe(true)
    expect(autoReload.error.value).toBeNull()
  })

  it('discards a late GET after a workspace switch', async () => {
    const stale = deferred<AutoReloadResponse>()
    vi.mocked(workspaceApi.getAutoReload)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(configuredResponse)

    const oldLoad = autoReload.scopeToWorkspace('workspace-b')
    await autoReload.scopeToWorkspace('workspace-c')
    stale.resolve({
      ...configuredResponse,
      threshold_credits: 9999
    })
    await oldLoad

    expect(autoReload.config.thresholdCredits).toBe(2000)
  })

  it('sends the exact save payload and applies only the canonical response', async () => {
    vi.mocked(workspaceApi.updateAutoReload).mockResolvedValue({
      ...configuredResponse,
      threshold_credits: 2100,
      reload_credits: 6100,
      monthly_budget_cents: null
    })

    await autoReload.save({
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: null
    })

    expect(workspaceApi.updateAutoReload).toHaveBeenCalledWith(
      {
        enabled: true,
        threshold_credits: 2000,
        reload_credits: 6000,
        monthly_budget_cents: null
      },
      'workspace-a'
    )
    expect(autoReload.config).toMatchObject({
      configured: true,
      enabled: true,
      thresholdCredits: 2100,
      reloadCredits: 6100,
      monthlyBudgetCents: null
    })
  })

  it('disables and re-enables with retained numeric settings', async () => {
    Object.assign(autoReload.config, {
      configured: true,
      enabled: true,
      thresholdCredits: 2200,
      reloadCredits: 6200,
      monthlyBudgetCents: 30_000,
      spentThisCycleCents: 0
    } satisfies AutoReloadConfig)
    vi.mocked(workspaceApi.updateAutoReload)
      .mockResolvedValueOnce({
        configured: true,
        enabled: false,
        threshold_credits: 2200,
        reload_credits: 6200,
        monthly_budget_cents: 30_000,
        spent_this_cycle_cents: 0
      })
      .mockResolvedValueOnce({
        configured: true,
        enabled: true,
        threshold_credits: 2200,
        reload_credits: 6200,
        monthly_budget_cents: 30_000,
        spent_this_cycle_cents: 0
      })

    await autoReload.setEnabled(false)
    await autoReload.setEnabled(true)

    expect(workspaceApi.updateAutoReload).toHaveBeenNthCalledWith(
      1,
      {
        enabled: false,
        threshold_credits: 2200,
        reload_credits: 6200,
        monthly_budget_cents: 30_000
      },
      'workspace-a'
    )
    expect(workspaceApi.updateAutoReload).toHaveBeenNthCalledWith(
      2,
      {
        enabled: true,
        threshold_credits: 2200,
        reload_credits: 6200,
        monthly_budget_cents: 30_000
      },
      'workspace-a'
    )
    expect(autoReload.isEnabled.value).toBe(true)
  })

  it('keeps persisted state and remains retryable after a failed PUT', async () => {
    const before = { ...autoReload.config }
    vi.mocked(workspaceApi.updateAutoReload)
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValueOnce(configuredResponse)

    await expect(
      autoReload.save({
        thresholdCredits: 2000,
        reloadCredits: 6000,
        monthlyBudgetCents: 25_000
      })
    ).rejects.toThrow('save failed')

    expect({ ...autoReload.config }).toEqual(before)
    expect(autoReload.error.value).toBe('save failed')

    await autoReload.save({
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: 25_000
    })

    expect(autoReload.error.value).toBeNull()
    expect(autoReload.config.configured).toBe(true)
  })

  it('uses a visible fallback for errors with an empty message', async () => {
    vi.mocked(workspaceApi.getAutoReload).mockRejectedValue(new Error(''))

    await autoReload.scopeToWorkspace('workspace-b')

    expect(autoReload.error.value).toBe('Failed to load auto-reload settings')
  })
})
