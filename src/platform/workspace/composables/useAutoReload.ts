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

export function deriveAutoReloadState(config: AutoReloadConfig) {
  const hasBudget = config.monthlyBudgetCents != null
  const reloadCostCents = creditsToCents(config.reloadCredits)
  const budgetLeftCents = hasBudget
    ? Math.max(0, (config.monthlyBudgetCents ?? 0) - config.spentThisCycleCents)
    : 0
  const budgetUsedFraction =
    config.monthlyBudgetCents != null && config.monthlyBudgetCents > 0
      ? Math.min(1, config.spentThisCycleCents / config.monthlyBudgetCents)
      : 0
  const reloadsLeft = hasBudget
    ? reloadCostCents > 0
      ? Math.floor(budgetLeftCents / reloadCostCents)
      : 0
    : null
  const isPaused = config.enabled && hasBudget && budgetLeftCents <= 0
  const isWarning =
    config.enabled && hasBudget && !isPaused && (reloadsLeft ?? Infinity) <= 1

  return {
    isConfigured: config.configured,
    isEnabled: config.enabled,
    hasBudget,
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
