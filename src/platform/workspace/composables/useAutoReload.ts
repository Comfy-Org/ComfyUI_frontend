import { computed, reactive } from 'vue'

import { creditsToCents } from '@/base/credits/comfyCredits'

// Prototype: there is no auto-reload API yet, so the config is a client-side
// singleton. The initial scenario is seeded from a dev-harness key; the dialog
// and the header toggle mutate it live.
type AutoReloadScenario =
  | 'notset'
  | 'nobudget'
  | 'healthy'
  | 'nearlimit'
  | 'paused'
  | 'off'

const SCENARIOS: readonly AutoReloadScenario[] = [
  'notset',
  'nobudget',
  'healthy',
  'nearlimit',
  'paused',
  'off'
]

const HARNESS_KEY = 'cbm.autoReload'

interface AutoReloadConfig {
  configured: boolean
  enabled: boolean
  thresholdCredits: number
  reloadCredits: number
  // null = no monthly budget set
  monthlyBudgetCents: number | null
  spentThisCycleCents: number
  lastReload: { date: Date; credits: number } | null
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function resetDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 20)
  return d
}

const DEFAULT_RELOAD = { thresholdCredits: 1000, reloadCredits: 5000 }
const BUDGET_CENTS = 50_000 // $500
const lastReload = () => ({ date: daysAgo(3), credits: 5000 })

function scenarioConfig(scenario: AutoReloadScenario): AutoReloadConfig {
  const base: AutoReloadConfig = {
    configured: true,
    enabled: true,
    ...DEFAULT_RELOAD,
    monthlyBudgetCents: BUDGET_CENTS,
    spentThisCycleCents: 4800, // $48
    lastReload: lastReload()
  }
  switch (scenario) {
    case 'notset':
      return { ...base, configured: false, lastReload: null }
    case 'nobudget':
      return { ...base, monthlyBudgetCents: null }
    case 'nearlimit':
      return { ...base, spentThisCycleCents: 47_600 } // ~1 reload left
    case 'paused':
      return { ...base, spentThisCycleCents: BUDGET_CENTS } // budget exhausted
    case 'off':
      return { ...base, enabled: false }
    case 'healthy':
    default:
      return base
  }
}

function initialScenario(): AutoReloadScenario {
  try {
    const stored = localStorage.getItem(
      HARNESS_KEY
    ) as AutoReloadScenario | null
    if (stored && SCENARIOS.includes(stored)) return stored
  } catch {
    /* ignore */
  }
  return 'healthy'
}

const config = reactive<AutoReloadConfig>(scenarioConfig(initialScenario()))
const cycleResetDate = resetDate()

// Dev bridge: the billing-mock harness dispatches this to swap scenarios live,
// so flipping the picker updates the tile in place instead of reloading the page.
if (typeof window !== 'undefined') {
  window.addEventListener('cbm:autoReload', (event) => {
    const scenario = (event as CustomEvent<AutoReloadScenario>).detail
    if (SCENARIOS.includes(scenario)) {
      Object.assign(config, scenarioConfig(scenario))
    }
  })
}

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
    cycleResetDate,
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
