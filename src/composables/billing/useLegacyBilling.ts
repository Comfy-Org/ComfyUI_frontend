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
      endDate: legacySubscriptionStatus.value?.end_date ?? null,
      isCancelled: isCancelled.value,
      hasFunds: (authStore.balance?.amount_micros ?? 0) > 0
    }
  })

  const balance = computed<BalanceInfo | null>(() => {
    const legacyBalance = authStore.balance
    if (!legacyBalance) return null

    return {
      amountMicros: legacyBalance.amount_micros ?? 0,
      currency: legacyBalance.currency ?? 'usd',
      effectiveBalanceMicros:
        legacyBalance.effective_balance_micros ??
        legacyBalance.amount_micros ??
        0,
      prepaidBalanceMicros: legacyBalance.prepaid_balance_micros ?? 0,
      cloudCreditBalanceMicros: legacyBalance.cloud_credit_balance_micros ?? 0
    }
  })

  // Legacy has no coarse billing_status concept (workspace-only).
  const billingStatus = computed<BillingStatus | null>(() => null)
  const subscriptionStatus = computed<BillingSubscriptionStatus | null>(() => {
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
  const currentTeamCreditStop = computed(() => null)

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

  async function resubscribe(): Promise<void> {
    // Legacy has no resubscribe endpoint; resubscribing is a fresh checkout.
    await legacySubscribe()
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
