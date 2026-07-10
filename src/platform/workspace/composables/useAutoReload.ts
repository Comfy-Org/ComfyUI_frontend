import { computed, reactive } from 'vue'

import { creditsToCents } from '@/base/credits/comfyCredits'

interface AutoReloadConfig {
  configured: boolean
  enabled: boolean
  thresholdCredits: number
  reloadCredits: number
  // null = no monthly budget set
  monthlyBudgetCents: number | null
  spentThisCycleCents: number
}

// TODO(auto-reload endpoint): there is no auto-reload API yet, so the config
// is client-side state — it starts unconfigured and edits don't persist
// across reloads.
const config = reactive<AutoReloadConfig>({
  configured: false,
  enabled: false,
  thresholdCredits: 1000,
  reloadCredits: 5000,
  monthlyBudgetCents: null,
  spentThisCycleCents: 0
})

export function useAutoReload() {
  const isConfigured = computed(() => config.configured)
  const isEnabled = computed(() => config.enabled)
  const hasBudget = computed(() => config.monthlyBudgetCents != null)

  const reloadCostCents = computed(() => creditsToCents(config.reloadCredits))

  const budgetLeftCents = computed(() =>
    config.monthlyBudgetCents == null
      ? 0
      : Math.max(0, config.monthlyBudgetCents - config.spentThisCycleCents)
  )

  const budgetUsedFraction = computed(() =>
    config.monthlyBudgetCents != null && config.monthlyBudgetCents > 0
      ? Math.min(1, config.spentThisCycleCents / config.monthlyBudgetCents)
      : 0
  )

  const reloadsLeft = computed(() =>
    hasBudget.value
      ? Math.floor(budgetLeftCents.value / reloadCostCents.value)
      : null
  )

  // Budget drained while still enabled → auto-reload can't fire, so it's paused.
  const isPaused = computed(
    () => config.enabled && hasBudget.value && budgetLeftCents.value <= 0
  )

  // One reload (or none) of headroom left before the budget pauses it.
  const isWarning = computed(
    () =>
      config.enabled &&
      hasBudget.value &&
      !isPaused.value &&
      (reloadsLeft.value ?? Infinity) <= 1
  )

  function setEnabled(value: boolean) {
    config.enabled = value
  }

  function save(next: {
    thresholdCredits: number
    reloadCredits: number
    monthlyBudgetCents: number | null
  }) {
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
    save
  }
}
