import { computed, reactive } from 'vue'

import { creditsToCents } from '@/base/credits/comfyCredits'

export interface AutoReloadConfig {
  configured: boolean
  enabled: boolean
  thresholdCredits: number
  reloadCredits: number
  monthlyBudgetCents: number | null
  spentThisCycleCents: number
}

export type AutoReloadSettings = Pick<
  AutoReloadConfig,
  'thresholdCredits' | 'reloadCredits' | 'monthlyBudgetCents'
>

function toNonNegativeFinite(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function getReloadCostCents(reloadCredits: number): number {
  if (!Number.isFinite(reloadCredits) || reloadCredits <= 0) return 0

  const reloadCostCents = creditsToCents(reloadCredits)
  return Number.isFinite(reloadCostCents) && reloadCostCents > 0
    ? reloadCostCents
    : 0
}

export function getAffordableReloadCount(
  budgetCents: number,
  reloadCredits: number
): number {
  const reloadCostCents = getReloadCostCents(reloadCredits)
  if (reloadCostCents === 0) return 0

  return Math.floor(toNonNegativeFinite(budgetCents) / reloadCostCents)
}

export function deriveAutoReloadState(config: AutoReloadConfig) {
  const hasBudget = config.monthlyBudgetCents != null
  const monthlyBudgetCents = toNonNegativeFinite(config.monthlyBudgetCents ?? 0)
  const spentThisCycleCents = Number.isFinite(config.spentThisCycleCents)
    ? Math.max(0, config.spentThisCycleCents)
    : hasBudget
      ? monthlyBudgetCents
      : 0
  const reloadCostCents = getReloadCostCents(config.reloadCredits)
  const budgetLeftCents = hasBudget
    ? Math.max(0, monthlyBudgetCents - spentThisCycleCents)
    : 0
  const budgetUsedFraction =
    hasBudget && monthlyBudgetCents <= 0
      ? 1
      : hasBudget
        ? Math.min(1, Math.max(0, spentThisCycleCents / monthlyBudgetCents))
        : 0
  const reloadsLeft = hasBudget
    ? getAffordableReloadCount(budgetLeftCents, config.reloadCredits)
    : null
  const isPaused = config.enabled && hasBudget && reloadsLeft === 0
  const isWarning = config.enabled && hasBudget && reloadsLeft === 1

  return {
    isConfigured: config.configured,
    isEnabled: config.enabled,
    hasBudget,
    budgetTotalCents: monthlyBudgetCents,
    budgetSpentCents: spentThisCycleCents,
    reloadCostCents,
    budgetLeftCents,
    budgetUsedFraction,
    reloadsLeft,
    isPaused,
    isWarning
  }
}

function createDefaultConfig(): AutoReloadConfig {
  return {
    configured: false,
    enabled: false,
    thresholdCredits: 1000,
    reloadCredits: 5000,
    monthlyBudgetCents: null,
    spentThisCycleCents: 0
  }
}

// No production auto-reload endpoint exists yet. This state intentionally
// starts unconfigured and does not imply persistence across a page reload.
const config = reactive<AutoReloadConfig>(createDefaultConfig())
let scopedWorkspaceId: string | null | undefined

function resetConfig() {
  Object.assign(config, createDefaultConfig())
}

function scopeToWorkspace(workspaceId: string | null) {
  if (scopedWorkspaceId === workspaceId) return
  scopedWorkspaceId = workspaceId
  resetConfig()
}

export function useAutoReload() {
  const state = computed(() => deriveAutoReloadState(config))
  const isConfigured = computed(() => state.value.isConfigured)
  const isEnabled = computed(() => state.value.isEnabled)
  const hasBudget = computed(() => state.value.hasBudget)
  const budgetTotalCents = computed(() => state.value.budgetTotalCents)
  const budgetSpentCents = computed(() => state.value.budgetSpentCents)
  const reloadCostCents = computed(() => state.value.reloadCostCents)
  const budgetLeftCents = computed(() => state.value.budgetLeftCents)
  const budgetUsedFraction = computed(() => state.value.budgetUsedFraction)
  const reloadsLeft = computed(() => state.value.reloadsLeft)
  const isPaused = computed(() => state.value.isPaused)
  const isWarning = computed(() => state.value.isWarning)

  function setEnabled(value: boolean) {
    config.enabled = value
  }

  function save(next: AutoReloadSettings) {
    config.configured = true
    config.enabled = true
    config.thresholdCredits = next.thresholdCredits
    config.reloadCredits = next.reloadCredits
    config.monthlyBudgetCents = next.monthlyBudgetCents
  }

  return {
    config,
    isConfigured,
    isEnabled,
    hasBudget,
    budgetTotalCents,
    budgetSpentCents,
    reloadCostCents,
    budgetLeftCents,
    budgetUsedFraction,
    reloadsLeft,
    isPaused,
    isWarning,
    setEnabled,
    save,
    scopeToWorkspace
  }
}
