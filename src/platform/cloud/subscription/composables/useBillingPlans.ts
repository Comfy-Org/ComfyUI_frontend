import { computed, ref } from 'vue'

import type {
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

const plans = ref<Plan[]>([])
const currentPlanSlug = ref<string | null>(null)
const teamCreditStops = ref<TeamCreditStops | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
let fetchPromise: Promise<void> | null = null

export function useBillingPlans() {
  function fetchPlans(): Promise<void> {
    if (fetchPromise) return fetchPromise

    isLoading.value = true
    error.value = null

    fetchPromise = workspaceApi
      .getBillingPlans()
      .then((response) => {
        plans.value = response.plans
        currentPlanSlug.value = response.current_plan_slug ?? null
        teamCreditStops.value = response.team_credit_stops ?? null
      })
      .catch((err: unknown) => {
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch plans'
        console.error('[useBillingPlans] Failed to fetch plans:', err)
      })
      .finally(() => {
        isLoading.value = false
        fetchPromise = null
      })

    return fetchPromise
  }

  const monthlyPlans = computed(() =>
    plans.value.filter((p) => p.duration === 'MONTHLY')
  )

  const annualPlans = computed(() =>
    plans.value.filter((p) => p.duration === 'ANNUAL')
  )

  function getPlanBySlug(slug: string) {
    return plans.value.find((p) => p.slug === slug)
  }

  function getPlansForTier(tier: Plan['tier']) {
    return plans.value.filter((p) => p.tier === tier)
  }

  const isCurrentPlan = (slug: string) => currentPlanSlug.value === slug

  return {
    plans,
    currentPlanSlug,
    teamCreditStops,
    isLoading,
    error,
    monthlyPlans,
    annualPlans,
    fetchPlans,
    getPlanBySlug,
    getPlansForTier,
    isCurrentPlan
  }
}
