import { computed, reactive, ref } from 'vue'

import { creditsToCents } from '@/base/credits/comfyCredits'
import type {
  AutoReloadResponse,
  UpdateAutoReloadRequest
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

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

const config = reactive<AutoReloadConfig>(createDefaultConfig())
const isLoading = ref(false)
const isSaving = ref(false)
const isInitialized = ref(false)
const error = ref<string | null>(null)
let scopedWorkspaceId: string | null | undefined
let requestGeneration = 0
let mutationId = 0

function resetConfig() {
  Object.assign(config, createDefaultConfig())
}

function mapResponse(response: AutoReloadResponse): AutoReloadConfig {
  const thresholdCredits =
    response.threshold_credits ??
    (response.configured ? null : createDefaultConfig().thresholdCredits)
  const reloadCredits =
    response.reload_credits ??
    (response.configured ? null : createDefaultConfig().reloadCredits)
  if (thresholdCredits === null || reloadCredits === null) {
    throw new Error('Configured auto-reload settings are incomplete')
  }

  return {
    configured: response.configured,
    enabled: response.enabled,
    thresholdCredits,
    reloadCredits,
    monthlyBudgetCents: response.monthly_budget_cents,
    spentThisCycleCents: response.spent_this_cycle_cents
  }
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

async function load(workspaceId: string, generation: number, retry: boolean) {
  isLoading.value = true
  error.value = null
  const attempts = retry ? 2 : 1

  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await workspaceApi.getAutoReload()
        if (
          generation !== requestGeneration ||
          workspaceId !== scopedWorkspaceId
        ) {
          return
        }
        Object.assign(config, mapResponse(response))
        isInitialized.value = true
        return
      } catch (err) {
        if (
          generation !== requestGeneration ||
          workspaceId !== scopedWorkspaceId
        ) {
          return
        }
        if (attempt === attempts - 1) {
          error.value = errorMessage(err, 'Failed to load auto-reload settings')
        }
      }
    }
  } finally {
    if (generation === requestGeneration && workspaceId === scopedWorkspaceId) {
      isLoading.value = false
    }
  }
}

function scopeToWorkspace(workspaceId: string | null): Promise<void> {
  if (scopedWorkspaceId === workspaceId) return Promise.resolve()
  scopedWorkspaceId = workspaceId
  const generation = ++requestGeneration
  mutationId++
  resetConfig()
  isInitialized.value = false
  isLoading.value = false
  isSaving.value = false
  error.value = null
  return workspaceId ? load(workspaceId, generation, true) : Promise.resolve()
}

function retry(): Promise<void> {
  if (!scopedWorkspaceId || isLoading.value) return Promise.resolve()
  return load(scopedWorkspaceId, requestGeneration, false)
}

function toRequest(
  enabled: boolean,
  settings: AutoReloadSettings
): UpdateAutoReloadRequest {
  return {
    enabled,
    threshold_credits: settings.thresholdCredits,
    reload_credits: settings.reloadCredits,
    monthly_budget_cents: settings.monthlyBudgetCents
  }
}

async function update(payload: UpdateAutoReloadRequest): Promise<void> {
  const workspaceId = scopedWorkspaceId
  if (!workspaceId) throw new Error('No active workspace')
  const generation = requestGeneration
  const currentMutationId = ++mutationId
  isSaving.value = true
  error.value = null

  try {
    const response = await workspaceApi.updateAutoReload(payload)
    if (
      generation === requestGeneration &&
      workspaceId === scopedWorkspaceId &&
      currentMutationId === mutationId
    ) {
      Object.assign(config, mapResponse(response))
      isInitialized.value = true
    }
  } catch (err) {
    if (
      generation === requestGeneration &&
      workspaceId === scopedWorkspaceId &&
      currentMutationId === mutationId
    ) {
      error.value = errorMessage(err, 'Failed to save auto-reload settings')
    }
    throw err
  } finally {
    if (
      generation === requestGeneration &&
      workspaceId === scopedWorkspaceId &&
      currentMutationId === mutationId
    ) {
      isSaving.value = false
    }
  }
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

  async function setEnabled(value: boolean): Promise<void> {
    await update(
      toRequest(value, {
        thresholdCredits: config.thresholdCredits,
        reloadCredits: config.reloadCredits,
        monthlyBudgetCents: config.monthlyBudgetCents
      })
    )
  }

  async function save(next: AutoReloadSettings): Promise<void> {
    await update(toRequest(true, next))
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
    isLoading,
    isSaving,
    isInitialized,
    error,
    setEnabled,
    save,
    scopeToWorkspace,
    retry
  }
}
