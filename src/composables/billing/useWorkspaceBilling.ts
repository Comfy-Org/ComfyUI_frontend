import { computed, ref, shallowRef } from 'vue'

import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  BillingBalanceResponse,
  BillingStatusResponse,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import type {
  BalanceInfo,
  BillingActions,
  BillingState,
  SubscriptionInfo
} from './types'

/**
 * Adapter for workspace-scoped billing via /billing/* endpoints.
 * Used for team workspaces.
 * @internal - Use useBillingContext() instead of importing directly.
 */
export function useWorkspaceBilling(): BillingState & BillingActions {
  const billingPlans = useBillingPlans()

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const statusData = shallowRef<BillingStatusResponse | null>(null)
  const balanceData = shallowRef<BillingBalanceResponse | null>(null)

  const isActiveSubscription = computed(
    () => statusData.value?.is_active ?? false
  )

  const subscription = computed<SubscriptionInfo | null>(() => {
    const status = statusData.value
    if (!status) return null

    return {
      isActive: status.is_active,
      tier: status.subscription_tier ?? null,
      duration: status.subscription_duration ?? null,
      planSlug: status.plan_slug ?? null,
      renewalDate: null, // Workspace billing uses cancel_at for end date
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
      effectiveBalanceMicros: data.effective_balance_micros,
      prepaidBalanceMicros: data.prepaid_balance_micros,
      cloudCreditBalanceMicros: data.cloud_credit_balance_micros
    }
  })

  const plans = computed(() => billingPlans.plans.value)
  const currentPlanSlug = computed(
    () => statusData.value?.plan_slug ?? billingPlans.currentPlanSlug.value
  )

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    isLoading.value = true
    error.value = null
    try {
      await Promise.all([fetchStatus(), fetchBalance(), fetchPlans()])
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
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<SubscribeResponse> {
    isLoading.value = true
    error.value = null
    try {
      const response = await workspaceApi.subscribe(
        planSlug,
        returnUrl,
        cancelUrl
      )

      // Refresh status and balance after subscription
      await Promise.all([fetchStatus(), fetchBalance()])

      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to subscribe'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function previewSubscribe(
    planSlug: string
  ): Promise<PreviewSubscribeResponse | null> {
    isLoading.value = true
    error.value = null
    try {
      return await workspaceApi.previewSubscribe(planSlug)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to preview subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function manageSubscription(): Promise<void> {
    // TODO: Implement workspace billing portal when available
    // For now, this is a no-op as workspace billing may use a different portal
    console.warn('Workspace billing portal not yet implemented')
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
      subscriptionDialog.show()
    }
  }

  function showSubscriptionDialog(): void {
    subscriptionDialog.show()
  }

  return {
    // State
    isInitialized,
    subscription,
    balance,
    plans,
    currentPlanSlug,
    isLoading,
    error,
    isActiveSubscription,

    // Actions
    initialize,
    fetchStatus,
    fetchBalance,
    subscribe,
    previewSubscribe,
    manageSubscription,
    fetchPlans,
    requireActiveSubscription,
    showSubscriptionDialog
  }
}
