import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWorkspaceApi = vi.hoisted(() => ({
  getAutoReload: vi.fn(),
  updateAutoReload: vi.fn()
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: mockWorkspaceApi
}))

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
  const unconfiguredResponse = {
    configured: false,
    enabled: false,
    threshold_credits: null,
    reload_credits: null,
    monthly_budget_cents: null,
    spent_this_cycle_cents: 0
  }

  beforeEach(async () => {
    await autoReload.scopeToWorkspace(null)
    vi.resetAllMocks()
    mockWorkspaceApi.getAutoReload.mockResolvedValue(unconfiguredResponse)
  })

  it('maps the persisted six-field configuration', async () => {
    mockWorkspaceApi.getAutoReload.mockResolvedValue({
      configured: true,
      enabled: true,
      threshold_credits: 2000,
      reload_credits: 6000,
      monthly_budget_cents: 25_000,
      spent_this_cycle_cents: 1200
    })

    await autoReload.scopeToWorkspace('workspace-a')

    expect(autoReload.config).toEqual({
      configured: true,
      enabled: true,
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: 25_000,
      spentThisCycleCents: 1200
    })
    expect(autoReload.isInitialized.value).toBe(true)
    expect(autoReload.isLoading.value).toBe(false)
  })

  it('uses setup defaults only for an unconfigured response', async () => {
    await autoReload.scopeToWorkspace('workspace-a')

    expect(autoReload.config).toEqual({
      configured: false,
      enabled: false,
      thresholdCredits: 1000,
      reloadCredits: 5000,
      monthlyBudgetCents: null,
      spentThisCycleCents: 0
    })
  })

  it('retries the initial read once before succeeding', async () => {
    mockWorkspaceApi.getAutoReload
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(unconfiguredResponse)

    await autoReload.scopeToWorkspace('workspace-a')

    expect(mockWorkspaceApi.getAutoReload).toHaveBeenCalledTimes(2)
    expect(autoReload.isInitialized.value).toBe(true)
    expect(autoReload.error.value).toBeNull()
  })

  it('exposes a terminal read error and supports a successful retry', async () => {
    mockWorkspaceApi.getAutoReload.mockRejectedValue(new Error('offline'))

    await autoReload.scopeToWorkspace('workspace-a')

    expect(mockWorkspaceApi.getAutoReload).toHaveBeenCalledTimes(2)
    expect(autoReload.isInitialized.value).toBe(false)
    expect(autoReload.error.value).toBe('offline')

    mockWorkspaceApi.getAutoReload.mockResolvedValue(unconfiguredResponse)
    await autoReload.retry()

    expect(autoReload.isInitialized.value).toBe(true)
    expect(autoReload.error.value).toBeNull()
  })

  it('ignores a late response from the previous workspace', async () => {
    let resolveOlder!: (value: typeof unconfiguredResponse) => void
    const older = new Promise<typeof unconfiguredResponse>((resolve) => {
      resolveOlder = resolve
    })
    mockWorkspaceApi.getAutoReload
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce({
        ...unconfiguredResponse,
        configured: true,
        enabled: true,
        threshold_credits: 3000,
        reload_credits: 7000
      })

    const firstLoad = autoReload.scopeToWorkspace('workspace-a')
    const secondLoad = autoReload.scopeToWorkspace('workspace-b')
    await secondLoad
    resolveOlder(unconfiguredResponse)
    await firstLoad

    expect(autoReload.config).toMatchObject({
      configured: true,
      thresholdCredits: 3000,
      reloadCredits: 7000
    })
  })

  it('saves the exact payload and applies the canonical response', async () => {
    await autoReload.scopeToWorkspace('workspace-a')
    mockWorkspaceApi.updateAutoReload.mockResolvedValue({
      configured: true,
      enabled: true,
      threshold_credits: 2100,
      reload_credits: 6100,
      monthly_budget_cents: 26_000,
      spent_this_cycle_cents: 500
    })

    await autoReload.save({
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: 25_000
    })

    expect(mockWorkspaceApi.updateAutoReload).toHaveBeenCalledWith({
      enabled: true,
      threshold_credits: 2000,
      reload_credits: 6000,
      monthly_budget_cents: 25_000
    })
    expect(autoReload.config).toEqual({
      configured: true,
      enabled: true,
      thresholdCredits: 2100,
      reloadCredits: 6100,
      monthlyBudgetCents: 26_000,
      spentThisCycleCents: 500
    })
  })

  it('disables with retained settings and applies the canonical response', async () => {
    mockWorkspaceApi.getAutoReload.mockResolvedValue({
      configured: true,
      enabled: true,
      threshold_credits: 2000,
      reload_credits: 6000,
      monthly_budget_cents: null,
      spent_this_cycle_cents: 400
    })
    await autoReload.scopeToWorkspace('workspace-a')
    mockWorkspaceApi.updateAutoReload.mockResolvedValue({
      configured: true,
      enabled: false,
      threshold_credits: 2000,
      reload_credits: 6000,
      monthly_budget_cents: null,
      spent_this_cycle_cents: 400
    })

    await autoReload.setEnabled(false)

    expect(mockWorkspaceApi.updateAutoReload).toHaveBeenCalledWith({
      enabled: false,
      threshold_credits: 2000,
      reload_credits: 6000,
      monthly_budget_cents: null
    })
    expect(autoReload.isEnabled.value).toBe(false)
  })

  it('keeps persisted state after a failed PUT and succeeds when retried', async () => {
    await autoReload.scopeToWorkspace('workspace-a')
    const before = { ...autoReload.config }
    mockWorkspaceApi.updateAutoReload.mockRejectedValueOnce(
      new Error('save failed')
    )

    await expect(
      autoReload.save({
        thresholdCredits: 2000,
        reloadCredits: 6000,
        monthlyBudgetCents: null
      })
    ).rejects.toThrow('save failed')

    expect({ ...autoReload.config }).toEqual(before)
    expect(autoReload.error.value).toBe('save failed')

    mockWorkspaceApi.updateAutoReload.mockResolvedValue({
      configured: true,
      enabled: true,
      threshold_credits: 2000,
      reload_credits: 6000,
      monthly_budget_cents: null,
      spent_this_cycle_cents: 0
    })
    await autoReload.save({
      thresholdCredits: 2000,
      reloadCredits: 6000,
      monthlyBudgetCents: null
    })

    expect(autoReload.config.configured).toBe(true)
    expect(autoReload.error.value).toBeNull()
  })
})
