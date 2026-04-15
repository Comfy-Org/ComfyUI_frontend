import { computed, onScopeDispose, ref, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { getComfyApiBaseUrl, getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { SubscriptionDialogReason } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { CheckoutAttributionMetadata } from '@/platform/telemetry/types'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useDialogService } from '@/services/dialogService'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { operations } from '@/types/comfyRegistryTypes'
import { useSubscriptionCancellationWatcher } from './useSubscriptionCancellationWatcher'

type CloudSubscriptionCheckoutResponse = NonNullable<
  operations['createCloudSubscriptionCheckout']['responses']['201']['content']['application/json']
>

export type CloudSubscriptionStatusResponse = NonNullable<
  operations['GetCloudSubscriptionStatus']['responses']['200']['content']['application/json']
>

type TrackedSubscriptionTierKey = Exclude<TierKey, 'free'>

type PendingSubscriptionSuccessResponse = {
  id: string
  transaction_id: string
  value: number
  currency: string
  tier: TrackedSubscriptionTierKey
  cycle: 'monthly' | 'yearly'
  checkout_type: 'new' | 'change'
  previous_tier?: TrackedSubscriptionTierKey | null
}

type FetchSubscriptionStatusOptions = {
  syncPendingSuccess?: boolean
}

const SUBSCRIPTION_SUCCESS_DELIVERED_STORAGE_KEY =
  'comfy.subscription_success.delivered_transactions'

function readDeliveredSubscriptionSuccessTransactions(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(
      SUBSCRIPTION_SUCCESS_DELIVERED_STORAGE_KEY
    )
    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter(
      (transactionId): transactionId is string =>
        typeof transactionId === 'string' && transactionId.length > 0
    )
  } catch {
    return []
  }
}

function hasDeliveredSubscriptionSuccess(transactionId: string): boolean {
  return readDeliveredSubscriptionSuccessTransactions().includes(transactionId)
}

function markSubscriptionSuccessAsDelivered(transactionId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const nextTransactions = [
    transactionId,
    ...readDeliveredSubscriptionSuccessTransactions().filter(
      (existingTransactionId) => existingTransactionId !== transactionId
    )
  ].slice(0, 20)

  try {
    window.localStorage.setItem(
      SUBSCRIPTION_SUCCESS_DELIVERED_STORAGE_KEY,
      JSON.stringify(nextTransactions)
    )
  } catch (error) {
    console.warn(
      '[Subscription] Failed to persist delivered subscription success transaction',
      error
    )
  }
}

function useSubscriptionInternal() {
  const subscriptionStatus = ref<CloudSubscriptionStatusResponse | null>(null)
  const telemetry = useTelemetry()
  const isInitialized = ref(false)

  const isSubscribedOrIsNotCloud = computed(() => {
    if (!isCloud || !window.__CONFIG__?.subscription_required) return true

    return subscriptionStatus.value?.is_active ?? false
  })
  const { reportError, accessBillingPortal } = useAuthActions()
  const { showSubscriptionRequiredDialog } = useDialogService()

  const authStore = useAuthStore()
  const { getAuthHeader } = authStore
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const { isLoggedIn } = useCurrentUser()

  const isCancelled = computed(() => {
    return !!subscriptionStatus.value?.end_date
  })

  const formattedRenewalDate = computed(() => {
    if (!subscriptionStatus.value?.renewal_date) return ''

    const renewalDate = new Date(subscriptionStatus.value.renewal_date)

    return renewalDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const formattedEndDate = computed(() => {
    if (!subscriptionStatus.value?.end_date) return ''

    const endDate = new Date(subscriptionStatus.value.end_date)

    return endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const subscriptionTier = computed(
    () => subscriptionStatus.value?.subscription_tier ?? null
  )

  const isFreeTier = computed(() => subscriptionTier.value === 'FREE')

  const subscriptionDuration = computed(
    () => subscriptionStatus.value?.subscription_duration ?? null
  )

  const isYearlySubscription = computed(
    () => subscriptionDuration.value === 'ANNUAL'
  )

  const subscriptionTierName = computed(() => {
    const tier = subscriptionTier.value
    if (!tier) return ''
    const key = TIER_TO_KEY[tier] ?? 'standard'
    const baseName = t(`subscription.tiers.${key}.name`)
    return isYearlySubscription.value
      ? t('subscription.tierNameYearly', { name: baseName })
      : baseName
  })

  function buildApiUrl(path: string): string {
    return `${getComfyApiBaseUrl()}${path}`
  }

  const getCheckoutAttributionForCloud =
    async (): Promise<CheckoutAttributionMetadata> => {
      if (__DISTRIBUTION__ !== 'cloud') {
        return {}
      }

      const { getCheckoutAttribution } =
        await import('@/platform/telemetry/utils/checkoutAttribution')

      return getCheckoutAttribution()
    }

  const buildAuthHeaders = async (): Promise<Record<string, string>> => {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    return {
      ...authHeader,
      'Content-Type': 'application/json'
    }
  }

  const fetchPendingSubscriptionSuccess = async (
    headers: Record<string, string>
  ): Promise<PendingSubscriptionSuccessResponse | null> => {
    const response = await fetch(
      buildApiUrl('/customers/pending-subscription-success'),
      {
        headers
      }
    )

    if (response.status === 204) {
      return null
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch pending subscription success: ${response.status}`
      )
    }

    return response.json()
  }

  const consumePendingSubscriptionSuccess = async (
    headers: Record<string, string>,
    id: string
  ): Promise<void> => {
    const response = await fetch(
      buildApiUrl(`/customers/pending-subscription-success/${id}/consume`),
      {
        method: 'POST',
        headers
      }
    )

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Failed to consume pending subscription success: ${response.status}`
      )
    }
  }

  const syncPendingSubscriptionSuccess = async (
    headers: Record<string, string>
  ): Promise<void> => {
    const pendingSuccess = await fetchPendingSubscriptionSuccess(headers)
    if (!pendingSuccess) {
      return
    }

    if (hasDeliveredSubscriptionSuccess(pendingSuccess.transaction_id)) {
      await consumePendingSubscriptionSuccess(headers, pendingSuccess.id)
      return
    }

    telemetry?.trackMonthlySubscriptionSucceeded({
      ...(authStore.userId ? { user_id: authStore.userId } : {}),
      transaction_id: pendingSuccess.transaction_id,
      value: pendingSuccess.value,
      currency: pendingSuccess.currency,
      tier: pendingSuccess.tier,
      cycle: pendingSuccess.cycle,
      checkout_type: pendingSuccess.checkout_type,
      ...(pendingSuccess.previous_tier
        ? { previous_tier: pendingSuccess.previous_tier }
        : {}),
      ecommerce: {
        transaction_id: pendingSuccess.transaction_id,
        value: pendingSuccess.value,
        currency: pendingSuccess.currency,
        items: [
          {
            item_name: pendingSuccess.tier,
            item_category: 'subscription',
            item_variant: pendingSuccess.cycle,
            price: pendingSuccess.value,
            quantity: 1
          }
        ]
      }
    })

    markSubscriptionSuccessAsDelivered(pendingSuccess.transaction_id)
    await consumePendingSubscriptionSuccess(headers, pendingSuccess.id)
  }

  const fetchStatus = wrapWithErrorHandlingAsync(
    () => fetchSubscriptionStatus(),
    reportError
  )

  const syncStatusAfterCheckout = wrapWithErrorHandlingAsync(
    () => fetchSubscriptionStatus({ syncPendingSuccess: true }),
    reportError
  )

  const subscribe = wrapWithErrorHandlingAsync(async () => {
    const response = await initiateSubscriptionCheckout()

    if (!response.checkout_url) {
      throw new Error(
        t('toastMessages.failedToInitiateSubscription', {
          error: 'No checkout URL returned'
        })
      )
    }

    window.open(response.checkout_url, '_blank')
  }, reportError)

  const showSubscriptionDialog = (options?: {
    reason?: SubscriptionDialogReason
  }) => {
    if (isCloud) {
      useTelemetry()?.trackSubscription('modal_opened', {
        current_tier: subscriptionTier.value?.toLowerCase(),
        reason: options?.reason
      })
    }

    void showSubscriptionRequiredDialog(options)
  }

  /**
   * Whether cloud subscription mode is enabled (cloud distribution with subscription_required config).
   * Use to determine which UI to show (SubscriptionPanel vs LegacyCreditsPanel).
   */
  const isSubscriptionEnabled = (): boolean =>
    Boolean(isCloud && window.__CONFIG__?.subscription_required)

  const { startCancellationWatcher, stopCancellationWatcher } =
    useSubscriptionCancellationWatcher({
      fetchStatus,
      isActiveSubscription: isSubscribedOrIsNotCloud,
      subscriptionStatus,
      telemetry,
      shouldWatchCancellation: isSubscriptionEnabled
    })

  const manageSubscription = async () => {
    await accessBillingPortal()
    startCancellationWatcher()
  }

  const requireActiveSubscription = async (): Promise<void> => {
    await fetchSubscriptionStatus()

    if (!isSubscribedOrIsNotCloud.value) {
      showSubscriptionDialog()
    }
  }

  const handleViewUsageHistory = () => {
    window.open(`${getComfyPlatformBaseUrl()}/profile/usage`, '_blank')
  }

  const handleLearnMore = () => {
    window.open('https://docs.comfy.org', '_blank')
  }

  const handleInvoiceHistory = async () => {
    await accessBillingPortal()
  }

  /**
   * Fetch the current cloud subscription status for the authenticated user
   * @returns Subscription status or null if no subscription exists
   */
  async function fetchSubscriptionStatus(
    options?: FetchSubscriptionStatusOptions
  ): Promise<CloudSubscriptionStatusResponse | null> {
    const headers = await buildAuthHeaders()

    const response = await fetch(
      buildApiUrl('/customers/cloud-subscription-status'),
      {
        headers
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new AuthStoreError(
        t('toastMessages.failedToFetchSubscription', {
          error: errorData.message
        })
      )
    }

    const statusData = await response.json()
    subscriptionStatus.value = statusData

    if (options?.syncPendingSuccess && statusData.is_active) {
      await syncPendingSubscriptionSuccess(headers)
    }

    return statusData
  }

  const handleDeliveredSubscriptionSuccessChange = (event: StorageEvent) => {
    if (
      event.key !== SUBSCRIPTION_SUCCESS_DELIVERED_STORAGE_KEY ||
      !isCloud ||
      !isLoggedIn.value
    ) {
      return
    }

    void fetchSubscriptionStatus().catch((error) => {
      console.error(
        '[Subscription] Failed to refresh subscription status after cross-tab success delivery:',
        error
      )
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleDeliveredSubscriptionSuccessChange)

    onScopeDispose(() => {
      window.removeEventListener(
        'storage',
        handleDeliveredSubscriptionSuccessChange
      )
    })
  }

  watch(
    () => isLoggedIn.value,
    async (loggedIn) => {
      if (loggedIn && isCloud) {
        try {
          await fetchSubscriptionStatus({ syncPendingSuccess: true })
        } catch (error) {
          // Network errors are expected during navigation/component unmount
          // and when offline - log for debugging but don't surface to user
          console.error('Failed to fetch subscription status:', error)
        } finally {
          isInitialized.value = true
        }
      } else {
        subscriptionStatus.value = null
        stopCancellationWatcher()
        isInitialized.value = true
      }
    },
    { immediate: true }
  )

  const initiateSubscriptionCheckout =
    async (): Promise<CloudSubscriptionCheckoutResponse> => {
      const headers = await buildAuthHeaders()
      const checkoutAttribution = await getCheckoutAttributionForCloud()

      const response = await fetch(
        buildApiUrl('/customers/cloud-subscription-checkout'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(checkoutAttribution)
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new AuthStoreError(
          t('toastMessages.failedToInitiateSubscription', {
            error: errorData.message
          })
        )
      }

      return response.json()
    }

  return {
    // State
    isActiveSubscription: isSubscribedOrIsNotCloud,
    isInitialized,
    isCancelled,
    formattedRenewalDate,
    formattedEndDate,
    subscriptionTier,
    isFreeTier,
    subscriptionDuration,
    isYearlySubscription,
    subscriptionTierName,
    subscriptionStatus,

    // Utilities
    isSubscriptionEnabled,

    // Actions
    subscribe,
    fetchStatus,
    syncStatusAfterCheckout,
    showSubscriptionDialog,
    manageSubscription,
    requireActiveSubscription,
    handleViewUsageHistory,
    handleLearnMore,
    handleInvoiceHistory
  }
}

export const useSubscription = createSharedComposable(useSubscriptionInternal)
