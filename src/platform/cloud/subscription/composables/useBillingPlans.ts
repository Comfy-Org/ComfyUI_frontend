import { computed, ref } from 'vue'

import { isAnnualDuration } from '@/platform/cloud/subscription/utils/planDuration'
import type {
  BillingPlansResponse,
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { readOnRail } from '@/platform/workspace/composables/readOnRail'
import { useBillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'

const plans = ref<Plan[]>([])
const currentPlanSlug = ref<string | null>(null)
const teamCreditStops = ref<TeamCreditStops | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
let fetchPromise: Promise<void> | null = null

export function useBillingPlans() {
  function adopt(response: BillingPlansResponse): void {
    plans.value = response.plans
    currentPlanSlug.value = response.current_plan_slug ?? null
    teamCreditStops.value = response.team_credit_stops ?? null
  }

  function fetchPlans(): Promise<void> {
    if (fetchPromise) return fetchPromise

    const rail = useBillingReadRail()
    // A superseded read publishes nothing, so whatever the last read left
    // behind has to survive this one: the catalog stays, and so does the
    // error, or a failed read followed by a superseded one would leave an
    // empty catalog with nothing on screen to explain it.
    const priorError = error.value
    isLoading.value = true
    error.value = null

    fetchPromise = (
      rail ? readOnRail(rail.readPlans) : workspaceApi.getBillingPlans()
    )
      .then((response) => {
        // Undefined is a read the scope moved on under; the catalog it would
        // have published belongs to an actor this host has left.
        if (response === undefined) error.value = priorError
        else adopt(response)
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
    plans.value.filter((p) => isAnnualDuration(p.duration))
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
