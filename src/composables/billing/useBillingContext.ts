import { computed, ref, shallowRef, toValue, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  KEY_TO_TIER,
  getTierFeatures
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { SubscribeOptions } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type {
  BalanceInfo,
  BillingActions,
  BillingContext,
  BillingType,
  BillingState,
  SubscriptionInfo
} from './types'
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
 * - Team workspaces enabled: workspace billing via /api/billing/* for both
 *   personal (single-seat workspace) and team workspaces
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
  const { flags } = useFeatureFlags()

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

  /**
   * Determines which billing type to use, keyed only on the build/flag:
   * - Team workspaces feature disabled (OSS/Desktop): legacy (/customers)
   * - Team workspaces feature enabled: workspace (/api/billing), for both
   *   personal (single-seat workspace) and team workspaces
   */
  const type = computed<BillingType>(() =>
    flags.teamWorkspacesEnabled ? 'workspace' : 'legacy'
  )

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

  // Reinitialize when the workspace or the resolved billing type changes.
  // type can flip after setup (e.g. when the team-workspaces flag resolves from
  // authenticated config), which swaps the active backend and needs a fresh init.
  watch(
    [() => store.activeWorkspace?.id, () => type.value],
    async (
      [newWorkspaceId, newType],
      [oldWorkspaceId, oldType] = [undefined, undefined]
    ) => {
      if (!newWorkspaceId) {
        // No workspace selected - reset state
        isInitialized.value = false
        error.value = null
        return
      }

      if (newWorkspaceId !== oldWorkspaceId || newType !== oldType) {
        // Workspace or billing type changed - reinitialize
        isInitialized.value = false
        try {
          await initialize()
        } catch (err) {
          // Error is already captured in error ref
          console.error('Failed to initialize billing context:', err)
        }
      }
    },
    { immediate: true }
  )

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    isLoading.value = true
    error.value = null
    try {
      await activeContext.value.initialize()
      isInitialized.value = true
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to initialize billing'
      throw err
    } finally {
      isLoading.value = false
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

  async function previewSubscribe(planSlug: string) {
    return activeContext.value.previewSubscribe(planSlug)
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

  function showSubscriptionDialog() {
    return activeContext.value.showSubscriptionDialog()
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
