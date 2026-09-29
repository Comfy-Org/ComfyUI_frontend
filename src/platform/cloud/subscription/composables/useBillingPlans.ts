import { computed, effectScope, ref, watch } from 'vue'

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
import { t } from '@/i18n'

const plans = ref<Plan[]>([])
const currentPlanSlug = ref<string | null>(null)
const teamCreditStops = ref<TeamCreditStops | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
let fetchPromise: Promise<void> | null = null
let fetchPromiseScopeKey: string | null = null
let adoptedScopeKey: string | null = null
let errorScopeKey: string | null = null
let isScopeWatcherInitialized = false
const MAX_SCOPE_REISSUES = 4

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
  error.value = null
  errorScopeKey = null
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

function ensureScopeWatcher(): void {
  if (isScopeWatcherInitialized) return
  isScopeWatcherInitialized = true
  effectScope(true).run(() =>
    watch(billingScopeKey, (scopeKey) => {
      if (adoptedScopeKey !== null && adoptedScopeKey !== scopeKey)
        clearCatalog()
      else if (errorScopeKey !== null && errorScopeKey !== scopeKey) {
        error.value = null
        errorScopeKey = null
      }
    })
  )
}

export function useBillingPlans() {
  ensureScopeWatcher()
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

  function fetchPlans(reissueCount = 0): Promise<void> {
    const scopeKey = billingScopeKey()
    if (fetchPromise && fetchPromiseScopeKey === scopeKey) return fetchPromise
    if (adoptedScopeKey !== null && adoptedScopeKey !== scopeKey) {
      clearCatalog()
    } else if (errorScopeKey !== null && errorScopeKey !== scopeKey) {
      error.value = null
      errorScopeKey = null
    }
    const rail = useBillingReadRail()
    // A superseded read publishes nothing, so whatever the last read left
    // behind has to survive this one: the catalog stays, and so does the
    // error, or a failed read followed by a superseded one would leave an
    // empty catalog with nothing on screen to explain it.
    const priorError = error.value
    isLoading.value = true
    error.value = null

    const reissueForCurrentScope = (): Promise<void> | undefined => {
      const currentScope = billingScopeKey()
      if (errorScopeKey === currentScope) error.value = priorError
      if (isAnonymousScope(currentScope)) return
      if (currentScope === scopeKey) return
      if (reissueCount >= MAX_SCOPE_REISSUES) {
        const exhaustion = new Error(t('subscription.plansLoadFailed'), {
          cause: { reissueCount, scopeKey: currentScope }
        })
        error.value ??= t('subscription.plansLoadFailed')
        errorScopeKey = currentScope
        reportCatalogFallback(exhaustion, hasCatalogForScope(currentScope))
        return
      }
      if (fetchPromise === request) {
        fetchPromise = null
        fetchPromiseScopeKey = null
      }
      return fetchPlans(reissueCount + 1)
    }

    const request: Promise<void> = (
      rail ? readOnRail(rail.readPlans) : workspaceApi.getBillingPlans()
    )
      .then((response) => {
        if (fetchPromise !== request) return fetchPromise ?? undefined
        // Undefined is a read the scope moved on under; the catalog it would
        // have published belongs to an actor this host has left.
        if (response === undefined) return reissueForCurrentScope()
        else if (billingScopeKey() === scopeKey) adopt(response, scopeKey)
        else return reissueForCurrentScope()
      })
      .catch((err: unknown) => {
        if (fetchPromise !== request) return fetchPromise ?? undefined
        if (billingScopeKey() !== scopeKey) {
          return reissueForCurrentScope()
        }
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch plans'
        errorScopeKey = scopeKey
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
    return request
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
