import { computed, ref, shallowRef } from 'vue'

import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  BillingBalanceResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  SubscribeOptions,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

import type {
  BalanceInfo,
  BillingActions,
  BillingState,
  SubscriptionInfo
} from '../../../composables/billing/types'

/**
 * Adapter for workspace-scoped billing via /billing/* endpoints.
 * Used for team workspaces.
 * @internal - Use useBillingContext() instead of importing directly.
 */
export function useWorkspaceBilling(): BillingState & BillingActions {
  const billingPlans = useBillingPlans()
  const billingOperationStore = useBillingOperationStore()

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const statusData = shallowRef<BillingStatusResponse | null>(null)
  const balanceData = shallowRef<BillingBalanceResponse | null>(null)

  const isActiveSubscription = computed(
    () => statusData.value?.is_active ?? false
  )
  const isFreeTier = computed(
    () => statusData.value?.subscription_tier === 'FREE'
  )

  const subscription = computed<SubscriptionInfo | null>(() => {
    const status = statusData.value
    if (!status) return null

    return {
      isActive: status.is_active,
      tier: status.subscription_tier ?? null,
      duration: status.subscription_duration ?? null,
      planSlug: status.plan_slug ?? null,
      renewalDate: status.renewal_date ?? null,
      endDate: status.cancel_at ?? null,
      isCancelled: status.subscription_status === 'canceled',
      hasFunds: status.has_funds
    }
  })

  const balance = computed<BalanceInfo | null>(() => {
    const data = balanceData.value
    if (!data) return null

    return {
      amountMicros: data.amount_micros,
      currency: data.currency,
      effectiveBalanceMicros:
        data.effective_balance_micros ?? data.amount_micros,
      prepaidBalanceMicros: data.prepaid_balance_micros ?? 0,
      cloudCreditBalanceMicros: data.cloud_credit_balance_micros ?? 0
    }
  })

  const billingStatus = computed(() => statusData.value?.billing_status ?? null)
  const subscriptionStatus = computed(
    () => statusData.value?.subscription_status ?? null
  )
  const tier = computed(() => statusData.value?.subscription_tier ?? null)
  const renewalDate = computed(() => statusData.value?.renewal_date ?? null)

  const plans = computed(() => billingPlans.plans.value)
  const currentPlanSlug = computed(
    () => statusData.value?.plan_slug ?? billingPlans.currentPlanSlug.value
  )
  const teamCreditStops = computed(() => billingPlans.teamCreditStops.value)
  const currentTeamCreditStop = computed(
    () => statusData.value?.team_credit_stop ?? null
  )

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    isLoading.value = true
    error.value = null
    try {
      await Promise.all([fetchStatus(), fetchBalance(), fetchPlans()])
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
      statusData.value = await workspaceApi.getBillingStatus()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch billing status'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBalance(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      balanceData.value = await workspaceApi.getBillingBalance()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch balance'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function subscribe(
    planSlug: string,
    options?: SubscribeOptions
  ): Promise<SubscribeResponse> {
    isLoading.value = true
    error.value = null
    try {
      const response = await workspaceApi.subscribe(planSlug, options)

      // Refresh is non-fatal: the subscribe write already succeeded, so a failed
      // refresh must not reject and prompt a retry of an active subscription.
      const [statusResult, balanceResult] = await Promise.allSettled([
        fetchStatus(),
        fetchBalance()
      ])
      if (
        statusResult.status === 'rejected' ||
        balanceResult.status === 'rejected'
      ) {
        error.value = 'Subscription succeeded, but billing state refresh failed'
      }

      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to subscribe'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function previewSubscribe(
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<PreviewSubscribeResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      return await workspaceApi.previewSubscribe(planSlug, options)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to preview subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function manageSubscription(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const returnUrl = window.location.href
      const response = await workspaceApi.getPaymentPortalUrl(returnUrl)
      if (response.url) {
        window.open(response.url, '_blank')
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to open billing portal'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function cancelSubscription(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const response = await workspaceApi.cancelSubscription()
      const operation = await billingOperationStore.startOperation(
        response.billing_op_id,
        'cancel'
      )

      if (operation.status !== 'succeeded') {
        throw new Error(
          operation.errorMessage ?? 'Failed to cancel subscription'
        )
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to cancel subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function resubscribe(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await workspaceApi.resubscribe()
      await Promise.all([fetchStatus(), fetchBalance()])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resubscribe'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function topup(amountCents: number): Promise<CreateTopupResponse> {
    isLoading.value = true
    error.value = null
    try {
      return await workspaceApi.createTopup(amountCents)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to top up credits'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPlans(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await billingPlans.fetchPlans()
      if (billingPlans.error.value) {
        error.value = billingPlans.error.value
      }
    } finally {
      isLoading.value = false
    }
  }

  const subscriptionDialog = useSubscriptionDialog()

  async function requireActiveSubscription(): Promise<void> {
    await fetchStatus()
    if (!isActiveSubscription.value) {
      subscriptionDialog.show({ reason: 'subscription_required' })
    }
  }

  function showSubscriptionDialog(options?: SubscriptionDialogOptions): void {
    subscriptionDialog.show(options)
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
    isActiveSubscription,
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
