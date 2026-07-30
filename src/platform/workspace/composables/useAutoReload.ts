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
const isInitialized = ref(false)
const isLoading = ref(false)
const isMutating = ref(false)
const error = ref<string | null>(null)
let scopedWorkspaceId: string | null | undefined
let latestReadId = 0
let latestMutationId = 0

function mapAutoReloadResponse(response: AutoReloadResponse): AutoReloadConfig {
  if (!response.configured) return createDefaultConfig()

  return {
    configured: true,
    enabled: response.enabled,
    thresholdCredits: response.threshold_credits ?? 0,
    reloadCredits: response.reload_credits ?? 0,
    monthlyBudgetCents: response.monthly_budget_cents,
    spentThisCycleCents: response.spent_this_cycle_cents
  }
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function resetConfig() {
  Object.assign(config, createDefaultConfig())
}

async function load(workspaceId: string, requestId: number) {
  isLoading.value = true
  error.value = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await workspaceApi.getAutoReload()
      if (requestId !== latestReadId || scopedWorkspaceId !== workspaceId)
        return

      Object.assign(config, mapAutoReloadResponse(response))
      isInitialized.value = true
      isLoading.value = false
      return
    } catch (err) {
      if (requestId !== latestReadId || scopedWorkspaceId !== workspaceId)
        return
      if (attempt === 0) continue

      error.value = errorMessage(err, 'Failed to load auto-reload settings')
      isLoading.value = false
    }
  }
}

function scopeToWorkspace(workspaceId: string | null): Promise<void> {
  if (scopedWorkspaceId === workspaceId) return Promise.resolve()
  scopedWorkspaceId = workspaceId
  latestReadId++
  latestMutationId++
  resetConfig()
  isInitialized.value = false
  isLoading.value = false
  isMutating.value = false
  error.value = null

  if (workspaceId === null) return Promise.resolve()
  return load(workspaceId, latestReadId)
}

function retry(): Promise<void> {
  if (scopedWorkspaceId == null) return Promise.resolve()
  return load(scopedWorkspaceId, ++latestReadId)
}

async function update(payload: UpdateAutoReloadRequest): Promise<void> {
  const workspaceId = scopedWorkspaceId
  if (workspaceId == null) throw new Error('No active workspace')

  const mutationId = ++latestMutationId
  isMutating.value = true
  error.value = null
  try {
    const response = await workspaceApi.updateAutoReload(payload)
    if (mutationId === latestMutationId && scopedWorkspaceId === workspaceId) {
      Object.assign(config, mapAutoReloadResponse(response))
    }
  } catch (err) {
    if (mutationId === latestMutationId && scopedWorkspaceId === workspaceId) {
      error.value = errorMessage(err, 'Failed to save auto-reload settings')
    }
    throw err
  } finally {
    if (mutationId === latestMutationId && scopedWorkspaceId === workspaceId) {
      isMutating.value = false
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

  async function setEnabled(value: boolean) {
    await update({
      enabled: value,
      threshold_credits: config.thresholdCredits,
      reload_credits: config.reloadCredits,
      monthly_budget_cents: config.monthlyBudgetCents
    })
  }

  async function save(next: AutoReloadSettings) {
    await update({
      enabled: true,
      threshold_credits: next.thresholdCredits,
      reload_credits: next.reloadCredits,
      monthly_budget_cents: next.monthlyBudgetCents
    })
  }

  return {
    config,
    isInitialized,
    isLoading,
    isMutating,
    error,
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
    scopeToWorkspace,
    retry
  }
}
