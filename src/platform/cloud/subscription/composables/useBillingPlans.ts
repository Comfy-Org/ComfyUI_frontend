import { computed, ref, watch } from 'vue'

import type {
  BillingPlansResponse,
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { readOnRail } from '@/platform/workspace/composables/readOnRail'
import { useBillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

const plans = ref<Plan[]>([])
const currentPlanSlug = ref<string | null>(null)
const teamCreditStops = ref<TeamCreditStops | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
let fetchPromise: Promise<void> | null = null
let fetchPromiseScopeKey: string | null = null
let adoptedScopeKey: string | null = null

function billingScopeKey(): string {
  const identity = useCurrentUser().resolvedUserInfo.value?.id ?? 'anonymous'
  const workspace = useTeamWorkspaceStore().activeWorkspaceId ?? 'personal'
  return `${identity}:${workspace}`
}

function clearCatalog(): void {
  plans.value = []
  currentPlanSlug.value = null
  teamCreditStops.value = null
  adoptedScopeKey = null
}

function isAnonymousScope(scopeKey: string): boolean {
  return scopeKey.startsWith('anonymous:')
}

function hasCatalogForScope(scopeKey: string): boolean {
  return adoptedScopeKey === scopeKey && plans.value.length > 0
}

function reportCatalogFallback(err: unknown, hasCachedPlans: boolean): void {
  const hasTeamCreditStops = (teamCreditStops.value?.stops.length ?? 0) > 0
  reportError(err, {
    errorType: 'cloud_billing_plan_catalog_fallback',
    tags: {
      failure_kind: hasCachedPlans ? 'degraded' : 'caught_unexpected',
      feature_area: 'billing',
      has_cached_plans: hasCachedPlans,
      has_team_credit_stops: hasTeamCreditStops,
      operation: 'load',
      outcome: hasCachedPlans ? 'recovered' : 'failed'
    },
    level: hasCachedPlans ? 'warning' : 'error'
  })
}

export function useBillingPlans() {
  watch(billingScopeKey, (scopeKey) => {
    if (adoptedScopeKey !== null && adoptedScopeKey !== scopeKey) clearCatalog()
  })

  function adopt(response: BillingPlansResponse, scopeKey: string): void {
    if (!Array.isArray(response.plans)) {
      throw new TypeError('Billing plans response did not contain a plan list')
    }
    if (
      response.team_credit_stops != null &&
      !Array.isArray(response.team_credit_stops.stops)
    ) {
      throw new TypeError(
        'Billing plans response did not contain a team credit stop list'
      )
    }
    plans.value = response.plans
    currentPlanSlug.value = response.current_plan_slug ?? null
    teamCreditStops.value = response.team_credit_stops ?? null
    adoptedScopeKey = scopeKey
  }

  function fetchPlans(allowScopeReissue = true): Promise<void> {
    const scopeKey = billingScopeKey()
    if (fetchPromise && fetchPromiseScopeKey === scopeKey) return fetchPromise
    if (adoptedScopeKey !== null && adoptedScopeKey !== scopeKey) {
      clearCatalog()
    }
    const rail = useBillingReadRail()
    // A superseded read publishes nothing, so whatever the last read left
    // behind has to survive this one: the catalog stays, and so does the
    // error, or a failed read followed by a superseded one would leave an
    // empty catalog with nothing on screen to explain it.
    const priorError = error.value
    isLoading.value = true
    error.value = null

    const request = (
      rail ? readOnRail(rail.readPlans) : workspaceApi.getBillingPlans()
    )
      .then((response) => {
        if (fetchPromise !== request) return
        // Undefined is a read the scope moved on under; the catalog it would
        // have published belongs to an actor this host has left.
        if (response === undefined) error.value = priorError
        else if (billingScopeKey() === scopeKey) adopt(response, scopeKey)
        else {
          error.value = priorError
          const currentScope = billingScopeKey()
          if (allowScopeReissue && !isAnonymousScope(currentScope))
            return fetchPlans(false)
        }
      })
      .catch((err: unknown) => {
        if (fetchPromise !== request) return
        if (billingScopeKey() !== scopeKey) {
          error.value = priorError
          const currentScope = billingScopeKey()
          if (allowScopeReissue && !isAnonymousScope(currentScope))
            return fetchPlans(false)
          return
        }
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch plans'
        reportCatalogFallback(err, hasCatalogForScope(scopeKey))
      })
      .finally(() => {
        if (fetchPromise !== request) return
        isLoading.value = false
        fetchPromise = null
        fetchPromiseScopeKey = null
      })

    fetchPromise = request
    fetchPromiseScopeKey = scopeKey
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
