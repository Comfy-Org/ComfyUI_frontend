import { computed, ref } from 'vue'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  SubscribeOptions,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useAuthStore } from '@/stores/authStore'
import { widenToNullish } from '@/utils/widenToNullish'

import type {
  BalanceInfo,
  BillingActions,
  BillingState,
  SubscriptionInfo
} from './types'

/**
 * Adapter for legacy user-scoped billing via /customers/* endpoints.
 * Used for personal workspaces.
 * @internal - Use useBillingContext() instead of importing directly.
 */
export function useLegacyBilling(): BillingState & BillingActions {
  const {
    canAccessSubscriptionFeatures: legacyCanAccessSubscriptionFeatures,
    subscriptionTier,
    subscriptionDuration,
    subscriptionStatus: legacySubscriptionStatus,
    isCancelled,
    fetchStatus: legacyFetchStatus,
    manageSubscription: legacyManageSubscription,
    subscribe: legacySubscribe,
    subscribeDirect: legacySubscribeDirect,
    showSubscriptionDialog: legacyShowSubscriptionDialog
  } = useSubscription()

  const authStore = useAuthStore()
  const authActions = useAuthActions()

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const canAccessSubscriptionFeatures = computed(
    () => legacyCanAccessSubscriptionFeatures.value
  )
  const isFreeTier = computed(() => subscriptionTier.value === 'FREE')
  const maxSeats = computed(() => null)
  const occupiedSeats = computed(() => null)

  const subscription = computed<SubscriptionInfo | null>(() => {
    if (!legacyCanAccessSubscriptionFeatures.value && !subscriptionTier.value) {
      return null
    }

    return {
      isActive: legacyCanAccessSubscriptionFeatures.value,
      tier: subscriptionTier.value,
      duration: subscriptionDuration.value,
      planSlug: null, // Legacy doesn't use plan slugs
      renewalDate: legacySubscriptionStatus.value?.renewal_date ?? null,
      endDate: legacySubscriptionStatus.value?.cancel_at ?? null,
      isCancelled: isCancelled.value,
      hasFunds: (authStore.balance?.amount_micros ?? 0) > 0
    }
  })

  const balance = computed<BalanceInfo | null>(() => {
    const legacyBalance = authStore.balance
    if (!legacyBalance) return null

    return {
      amountMicros: legacyBalance.amount_micros || 0,
      currency: legacyBalance.currency || 'usd',
      effectiveBalanceMicros:
        widenToNullish(legacyBalance.effective_balance_micros) ??
        widenToNullish(legacyBalance.amount_micros) ??
        0,
      prepaidBalanceMicros: legacyBalance.prepaid_balance_micros ?? 0,
      cloudCreditBalanceMicros: legacyBalance.cloud_credit_balance_micros ?? 0
    }
  })

  const billingStatus = computed<BillingStatus | null>(
    () => legacySubscriptionStatus.value?.billing_status ?? null
  )
  const subscriptionStatus = computed<BillingSubscriptionStatus | null>(() => {
    if (legacySubscriptionStatus.value?.subscription_status) {
      return legacySubscriptionStatus.value.subscription_status
    }
    if (isCancelled.value) return 'canceled'
    if (legacyCanAccessSubscriptionFeatures.value) return 'active'
    return null
  })
  const tier = computed(() => subscriptionTier.value)
  const renewalDate = computed(
    () => legacySubscriptionStatus.value?.renewal_date ?? null
  )

  // Legacy billing doesn't have workspace-style plans
  const plans = computed(() => [])
  const currentPlanSlug = computed(() => null)
  const teamCreditStops = computed(() => null)
  const currentTeamCreditStop = computed(
    () => legacySubscriptionStatus.value?.team_credit_stop ?? null
  )

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    isLoading.value = true
    error.value = null
    try {
      await Promise.all([fetchStatus(), fetchBalance()])
      // Re-fetch balance if free tier credits were just lazily granted
      if (isFreeTier.value && balance.value?.amountMicros === 0) {
        await fetchBalance()
      }
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
    isLoading.value = true
    error.value = null
    try {
      await legacyFetchStatus()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBalance(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await authStore.fetchBalance()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch balance'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function subscribe(
    _planSlug: string,
    _options?: SubscribeOptions
  ): Promise<SubscribeResponse | void> {
    // Legacy billing uses Stripe checkout flow via useSubscription
    await legacySubscribe()
  }

  async function previewSubscribe(
    _planSlug: string,
    _options?: PreviewSubscribeOptions
  ): Promise<PreviewSubscribeResponse | null> {
    // Legacy billing doesn't support preview - returns null
    return null
  }

  async function manageSubscription(): Promise<void> {
    await legacyManageSubscription()
  }

  async function cancelSubscription(): Promise<void> {
    await legacyManageSubscription()
  }

  async function resubscribe(options?: {
    source?: 'pricing_dialog' | 'settings_billing_panel'
  }): Promise<void> {
    // Legacy has no resubscribe endpoint; resubscribing is a fresh checkout.
    // Unwrapped so failures propagate to resubscribe telemetry instead of being swallowed.
    // Tag the attempt as a resubscribe so the pending-checkout recovery in
    // useSubscription.ts can later emit the canonical resubscribe terminal
    // instead of leaving it indistinguishable from a plain subscribe.
    await legacySubscribeDirect({
      operation: 'resubscribe',
      source: options?.source
    })
  }

  async function topup(amountCents: number): Promise<void> {
    // Facade standardizes on cents; legacy /customers/credit takes dollars.
    await authActions.purchaseCredits(amountCents / 100)
  }

  async function fetchPlans(): Promise<void> {
    // Legacy billing doesn't have workspace-style plans
    // Plans are hardcoded in the UI for legacy subscriptions
  }

  async function requireActiveSubscription(): Promise<void> {
    await fetchStatus()
    if (!canAccessSubscriptionFeatures.value) {
      legacyShowSubscriptionDialog({ reason: 'subscription_required' })
    }
  }

  function showSubscriptionDialog(options?: SubscriptionDialogOptions): void {
    legacyShowSubscriptionDialog(options)
  }

  return {
    // State
    isInitialized,
    subscription,
    balance,
    plans,
    currentPlanSlug,
    teamCreditStops,
    currentTeamCreditStop,
    maxSeats,
    occupiedSeats,
    isLoading,
    error,
    canAccessSubscriptionFeatures,
    isFreeTier,
    billingStatus,
    subscriptionStatus,
    tier,
    renewalDate,

    // Actions
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
