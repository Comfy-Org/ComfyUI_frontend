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
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

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
  const workspaceStore = useTeamWorkspaceStore()

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const statusData = shallowRef<BillingStatusResponse | null>(null)
  const seatCapacity = shallowRef<{
    maxSeats: number
    occupiedSeats: number
  } | null>(null)
  const balanceData = shallowRef<BillingBalanceResponse | null>(null)
  // Prevent older status and balance responses from overwriting newer state.
  const latestBillingReadIds = { status: 0, balance: 0 }

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
  const maxSeats = computed(() => seatCapacity.value?.maxSeats ?? null)
  const occupiedSeats = computed(
    () => seatCapacity.value?.occupiedSeats ?? null
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
    const requestId = ++latestBillingReadIds.status
    seatCapacity.value = null
    const workspaceId = workspaceStore.activeWorkspace?.id
    isLoading.value = true
    error.value = null
    try {
      const status = await workspaceApi.getBillingStatus()
      if (requestId === latestBillingReadIds.status) {
        statusData.value = status
        seatCapacity.value = {
          maxSeats: status.max_seats,
          occupiedSeats: status.occupied_seats
        }
        if (workspaceId && status.billing_rail) {
          workspaceStore.setWorkspaceBillingRail(
            workspaceId,
            status.billing_rail
          )
        }
      }
    } catch (err) {
      if (requestId === latestBillingReadIds.status) {
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch billing status'
      }
      throw err
    } finally {
      if (requestId === latestBillingReadIds.status) isLoading.value = false
    }
  }

  async function fetchBalance(): Promise<void> {
    const requestId = ++latestBillingReadIds.balance
    isLoading.value = true
    error.value = null
    try {
      const balance = await workspaceApi.getBillingBalance()
      if (requestId === latestBillingReadIds.balance) {
        balanceData.value = balance
      }
    } catch (err) {
      if (requestId === latestBillingReadIds.balance) {
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch balance'
      }
      throw err
    } finally {
      if (requestId === latestBillingReadIds.balance) isLoading.value = false
    }
  }

  async function retryBillingRead(
    fetchBillingResource: () => Promise<void>,
    billingResource: keyof typeof latestBillingReadIds
  ): Promise<{ failed: boolean; requestId: number }> {
    const firstAttempt = fetchBillingResource()
    const firstRequestId = latestBillingReadIds[billingResource]
    try {
      await firstAttempt
      return { failed: false, requestId: firstRequestId }
    } catch {
      if (firstRequestId !== latestBillingReadIds[billingResource]) {
        return { failed: false, requestId: firstRequestId }
      }
    }

    const retry = fetchBillingResource()
    const retryRequestId = latestBillingReadIds[billingResource]
    try {
      await retry
      return { failed: false, requestId: retryRequestId }
    } catch {
      return {
        failed: retryRequestId === latestBillingReadIds[billingResource],
        requestId: retryRequestId
      }
    }
  }

  async function reconcileBillingStateAfterSubscribe(): Promise<void> {
    const [statusResult, balanceResult] = await Promise.all([
      retryBillingRead(fetchStatus, 'status'),
      retryBillingRead(fetchBalance, 'balance')
    ])
    const statusFailed =
      statusResult.failed &&
      statusResult.requestId === latestBillingReadIds.status
    const balanceFailed =
      balanceResult.failed &&
      balanceResult.requestId === latestBillingReadIds.balance

    if (statusFailed || balanceFailed) {
      error.value = 'Subscription succeeded, but billing state refresh failed'
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
      isLoading.value = false
      void reconcileBillingStateAfterSubscribe()
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to subscribe'
      isLoading.value = false
      throw err
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
    maxSeats,
    occupiedSeats,
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
