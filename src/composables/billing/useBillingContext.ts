import { computed, ref, shallowRef, toValue, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import {
  KEY_TO_TIER,
  getTierFeatures
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  PreviewSubscribeOptions,
  SubscribeOptions
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type {
  BalanceInfo,
  BillingActions,
  BillingContext,
  BillingState,
  SubscriptionInfo
} from './types'
import { useBillingRouting } from './useBillingRouting'
import { useLegacyBilling } from './useLegacyBilling'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'

// Legacy per-member team plans use a hyphenated `team-{tier}-{cycle}` slug; the
// new credit-slider plan uses an underscore `team_per_credit_{cycle}` slug and
// carries a team_credit_stop. The hyphen prefix alone separates the two, so a
// new sub is never misrouted even before its credit stop is populated.
const LEGACY_TEAM_PLAN_SLUG_PREFIX = 'team-'

/**
 * Unified billing context that selects the billing implementation by build/flag.
 *
 * - Team workspaces disabled (OSS/Desktop): legacy billing via /customers/*
 * - Team workspaces enabled: workspace billing via /api/billing/* for team
 *   workspaces, and for personal workspaces once consolidated billing is
 *   enabled; personal workspaces otherwise stay on legacy billing
 *
 * The context automatically initializes when the workspace changes and provides
 * a unified interface for subscription status, balance, and billing actions.
 *
 * @example
 * ```typescript
 * const {
 *   type,
 *   subscription,
 *   balance,
 *   isInitialized,
 *   initialize,
 *   subscribe
 * } = useBillingContext()
 *
 * // Wait for initialization
 * await initialize()
 *
 * // Check subscription status
 * if (subscription.value?.isActive) {
 *   console.log(`Tier: ${subscription.value.tier}`)
 * }
 *
 * // Check balance
 * if (balance.value) {
 *   const dollars = balance.value.amountMicros / 1_000_000
 *   console.log(`Balance: $${dollars.toFixed(2)}`)
 * }
 * ```
 */
function useBillingContextInternal(): BillingContext {
  const store = useTeamWorkspaceStore()
  const { type } = useBillingRouting()

  const legacyBillingRef = shallowRef<(BillingState & BillingActions) | null>(
    null
  )
  const workspaceBillingRef = shallowRef<
    (BillingState & BillingActions) | null
  >(null)

  const getLegacyBilling = () => {
    if (!legacyBillingRef.value) {
      legacyBillingRef.value = useLegacyBilling()
    }
    return legacyBillingRef.value
  }

  const getWorkspaceBilling = () => {
    if (!workspaceBillingRef.value) {
      workspaceBillingRef.value = useWorkspaceBilling()
    }
    return workspaceBillingRef.value
  }

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const activeContext = computed(() =>
    type.value === 'legacy' ? getLegacyBilling() : getWorkspaceBilling()
  )

  // Proxy state from active context
  const subscription = computed<SubscriptionInfo | null>(() =>
    toValue(activeContext.value.subscription)
  )

  const balance = computed<BalanceInfo | null>(() =>
    toValue(activeContext.value.balance)
  )

  const plans = computed(() => toValue(activeContext.value.plans))

  const currentPlanSlug = computed(() =>
    toValue(activeContext.value.currentPlanSlug)
  )

  const teamCreditStops = computed(() =>
    toValue(activeContext.value.teamCreditStops)
  )

  const currentTeamCreditStop = computed(() =>
    toValue(activeContext.value.currentTeamCreditStop)
  )

  const isActiveSubscription = computed(() =>
    toValue(activeContext.value.isActiveSubscription)
  )

  const isFreeTier = computed(() => subscription.value?.tier === 'FREE')

  const isLegacyTeamPlan = computed(
    () =>
      type.value === 'workspace' &&
      isActiveSubscription.value &&
      !isFreeTier.value &&
      currentTeamCreditStop.value === null &&
      (currentPlanSlug.value
        ?.toLowerCase()
        .startsWith(LEGACY_TEAM_PLAN_SLUG_PREFIX) ??
        false)
  )

  const billingStatus = computed(() =>
    toValue(activeContext.value.billingStatus)
  )
  const subscriptionStatus = computed(() =>
    toValue(activeContext.value.subscriptionStatus)
  )
  const tier = computed(() => toValue(activeContext.value.tier))
  const renewalDate = computed(() => toValue(activeContext.value.renewalDate))

  function getMaxSeats(tierKey: TierKey): number {
    if (type.value === 'legacy') return 1

    const apiTier = KEY_TO_TIER[tierKey]
    const plan = plans.value.find(
      (p) => p.tier === apiTier && p.duration === 'MONTHLY'
    )
    return plan?.max_seats ?? getTierFeatures(tierKey).maxMembers
  }

  // Sync subscription info to workspace store for display in workspace switcher
  // A subscription is considered "subscribed" for workspace purposes if it's active AND not cancelled
  // This ensures the delete button is enabled after cancellation, even before the period ends
  watch(
    subscription,
    (sub) => {
      if (!sub) return

      store.updateActiveWorkspace({
        isSubscribed: sub.isActive && !sub.isCancelled,
        subscriptionPlan: sub.planSlug
      })
    },
    { immediate: true }
  )

  function resetBillingState() {
    isInitialized.value = false
    error.value = null
  }

  // A reinit (workspace switch or backend flip) can overlap an in-flight one.
  // The token gates completion so only the latest attempt may mark the context
  // ready, preventing a stale init from resolving into a false-ready state.
  let latestInitToken = 0

  // type can flip after setup when the team-workspaces or consolidated-billing
  // flag resolves from authenticated config, swapping the active backend; a
  // fresh init is needed. The watch fires only when id or type actually
  // changes, so any fire with a workspace selected warrants a reinit.
  watch(
    [() => store.activeWorkspace?.id, () => type.value],
    async ([newWorkspaceId]) => {
      if (!newWorkspaceId) {
        resetBillingState()
        return
      }

      isInitialized.value = false
      // The active adapter is a cached singleton whose initialize() short-
      // circuits on its own flag; clear it so it refetches for the new
      // workspace/backend instead of serving the prior context's data.
      activeContext.value.isInitialized.value = false
      try {
        await initialize()
      } catch (err) {
        console.error('Failed to initialize billing context:', err)
      }
    },
    { immediate: true }
  )

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    const initToken = ++latestInitToken
    isLoading.value = true
    error.value = null
    try {
      await activeContext.value.initialize()
      if (initToken !== latestInitToken) return
      isInitialized.value = true
    } catch (err) {
      if (initToken !== latestInitToken) return
      error.value =
        err instanceof Error ? err.message : 'Failed to initialize billing'
      throw err
    } finally {
      if (initToken === latestInitToken) isLoading.value = false
    }
  }

  async function fetchStatus(): Promise<void> {
    return activeContext.value.fetchStatus()
  }

  async function fetchBalance(): Promise<void> {
    return activeContext.value.fetchBalance()
  }

  async function subscribe(planSlug: string, options?: SubscribeOptions) {
    return activeContext.value.subscribe(planSlug, options)
  }

  async function previewSubscribe(
    planSlug: string,
    options?: PreviewSubscribeOptions
  ) {
    return activeContext.value.previewSubscribe(planSlug, options)
  }

  async function manageSubscription() {
    return activeContext.value.manageSubscription()
  }

  async function cancelSubscription() {
    return activeContext.value.cancelSubscription()
  }

  async function resubscribe() {
    return activeContext.value.resubscribe()
  }

  async function topup(amountCents: number) {
    if (
      !Number.isInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents % 100 !== 0
    ) {
      throw new Error(
        'Top-up amount must be a positive whole-dollar cent value'
      )
    }
    return activeContext.value.topup(amountCents)
  }

  async function fetchPlans() {
    return activeContext.value.fetchPlans()
  }

  async function requireActiveSubscription() {
    return activeContext.value.requireActiveSubscription()
  }

  function showSubscriptionDialog(options?: SubscriptionDialogOptions) {
    return activeContext.value.showSubscriptionDialog(options)
  }

  return {
    type,
    isInitialized,
    subscription,
    balance,
    plans,
    currentPlanSlug,
    teamCreditStops,
    currentTeamCreditStop,
    isLoading,
    error,
    isActiveSubscription,
    isFreeTier,
    isLegacyTeamPlan,
    billingStatus,
    subscriptionStatus,
    tier,
    renewalDate,
    getMaxSeats,

    initialize,
    fetchStatus,
    fetchBalance,
    subscribe,
    previewSubscribe,
    manageSubscription,
    cancelSubscription,
    resubscribe,
    topup,
    fetchPlans,
    requireActiveSubscription,
    showSubscriptionDialog
  }
}

export const useBillingContext = createSharedComposable(
  useBillingContextInternal
)
