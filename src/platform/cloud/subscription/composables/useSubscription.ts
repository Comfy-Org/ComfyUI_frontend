import { computed, ref, watch } from 'vue'
import {
  createSharedComposable,
  defaultDocument,
  defaultWindow,
  useEventListener
} from '@vueuse/core'

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
import type { operations } from '@/types/comfyRegistryTypes'
import {
  PENDING_SUBSCRIPTION_CHECKOUT_EVENT,
  PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
  hasPendingSubscriptionCheckoutAttempt,
  recordPendingSubscriptionCheckoutAttempt
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { useSubscriptionCancellationWatcher } from './useSubscriptionCancellationWatcher'

type CloudSubscriptionCheckoutResponse = NonNullable<
  operations['createCloudSubscriptionCheckout']['responses']['201']['content']['application/json']
>

export type CloudSubscriptionStatusResponse = NonNullable<
  operations['GetCloudSubscriptionStatus']['responses']['200']['content']['application/json']
>

const PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS = [3000, 10000, 30000]

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

  let pendingCheckoutRecoveryTimeout: number | null = null
  let pendingCheckoutRecoveryAttempt = 0
  let isRecoveringPendingCheckout = false

  // Non-success returns attribute via this; success outcomes use the id from metadata (cross-session).
  let lastCheckoutAttempt: {
    attempt_id: string
    tier: string
    cycle: string
  } | null = null
  // Fire checkout_returned once per attempt despite pageshow/visibilitychange firing repeatedly.
  const reportedReturnedAttemptIds = new Set<string>()

  const reportCheckoutReturned = (
    checkoutAttemptId: string,
    outcome: 'success' | 'cancelled' | 'unknown'
  ) => {
    if (reportedReturnedAttemptIds.has(checkoutAttemptId)) {
      return
    }
    reportedReturnedAttemptIds.add(checkoutAttemptId)
    telemetry?.trackCheckoutReturned({
      checkout_attempt_id: checkoutAttemptId,
      outcome
    })
  }

  const stopPendingCheckoutRecovery = () => {
    if (pendingCheckoutRecoveryTimeout !== null && defaultWindow) {
      defaultWindow.clearTimeout(pendingCheckoutRecoveryTimeout)
    }

    pendingCheckoutRecoveryTimeout = null
    pendingCheckoutRecoveryAttempt = 0
  }

  const schedulePendingCheckoutRecovery = () => {
    if (
      !defaultWindow ||
      pendingCheckoutRecoveryTimeout !== null ||
      !isLoggedIn.value ||
      !hasPendingSubscriptionCheckoutAttempt()
    ) {
      return
    }

    const nextDelay =
      PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS[
        pendingCheckoutRecoveryAttempt
      ]

    if (nextDelay === undefined) {
      return
    }

    pendingCheckoutRecoveryTimeout = defaultWindow.setTimeout(() => {
      pendingCheckoutRecoveryTimeout = null
      pendingCheckoutRecoveryAttempt += 1
      void recoverPendingSubscriptionCheckout('retry')
    }, nextDelay)
  }

  const syncPendingSubscriptionSuccess = (
    statusData: CloudSubscriptionStatusResponse
  ) => {
    const metadata = consumePendingSubscriptionCheckoutSuccess(statusData)

    if (!metadata) {
      if (hasPendingSubscriptionCheckoutAttempt()) {
        // Back but Stripe unconfirmed; recovery retries resolve to success later.
        if (lastCheckoutAttempt) {
          reportCheckoutReturned(lastCheckoutAttempt.attempt_id, 'unknown')
        }
        schedulePendingCheckoutRecovery()
      } else {
        // No pending attempt remains: abandoned/cleared, i.e. cancelled at Stripe.
        if (lastCheckoutAttempt) {
          reportCheckoutReturned(lastCheckoutAttempt.attempt_id, 'cancelled')
        }
        stopPendingCheckoutRecovery()
      }
      return
    }

    reportCheckoutReturned(metadata.checkout_attempt_id, 'success')
    telemetry?.trackMonthlySubscriptionSucceeded({
      ...(authStore.userId ? { user_id: authStore.userId } : {}),
      ...metadata
    })
    stopPendingCheckoutRecovery()
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

  const fetchStatus = wrapWithErrorHandlingAsync(
    fetchSubscriptionStatus,
    reportError
  )

  const subscribe = wrapWithErrorHandlingAsync(async () => {
    let response: CloudSubscriptionCheckoutResponse
    try {
      response = await initiateSubscriptionCheckout()
    } catch (error) {
      telemetry?.trackCheckoutInitiateFailed({
        stage: 'server_error',
        error_code: error instanceof Error ? error.message : undefined
      })
      throw error
    }

    if (!response.checkout_url) {
      telemetry?.trackCheckoutInitiateFailed({ stage: 'no_url' })
      throw new Error(
        t('toastMessages.failedToInitiateSubscription', {
          error: 'No checkout URL returned'
        })
      )
    }

    const checkoutWindow = window.open(response.checkout_url, '_blank')
    if (!checkoutWindow) {
      telemetry?.trackCheckoutWindowBlocked()
      return
    }

    const attempt = recordPendingSubscriptionCheckoutAttempt({
      tier: 'standard',
      cycle: 'monthly',
      checkout_type: isSubscribedOrIsNotCloud.value ? 'change' : 'new',
      ...(subscriptionTier.value
        ? { previous_tier: TIER_TO_KEY[subscriptionTier.value] }
        : {}),
      ...(subscriptionDuration.value === 'ANNUAL'
        ? { previous_cycle: 'yearly' as const }
        : subscriptionDuration.value === 'MONTHLY'
          ? { previous_cycle: 'monthly' as const }
          : {})
    })

    lastCheckoutAttempt = {
      attempt_id: attempt.attempt_id,
      tier: attempt.tier,
      cycle: attempt.cycle
    }
    reportedReturnedAttemptIds.delete(attempt.attempt_id)
    telemetry?.trackCheckoutViewed({
      checkout_attempt_id: attempt.attempt_id,
      tier: attempt.tier,
      cycle: attempt.cycle
    })
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
    const didOpenPortal = await accessBillingPortal()
    if (!didOpenPortal) {
      return
    }

    startCancellationWatcher()
  }

  const requireActiveSubscription = async (): Promise<void> => {
    await fetchSubscriptionStatus()

    if (!isSubscribedOrIsNotCloud.value) {
      // Login-time enforcement, not a run gate; reason keeps the run_button cohort clean.
      showSubscriptionDialog({ reason: 'subscription_required' })
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

  const recoverPendingSubscriptionCheckout = async (
    source: 'bootstrap' | 'pageshow' | 'visibilitychange' | 'retry'
  ) => {
    if (
      !isCloud ||
      !isLoggedIn.value ||
      !hasPendingSubscriptionCheckoutAttempt() ||
      isRecoveringPendingCheckout
    ) {
      return
    }

    isRecoveringPendingCheckout = true

    try {
      await fetchSubscriptionStatus()
    } catch (error) {
      console.error(
        `[Subscription] Failed to recover pending checkout on ${source}:`,
        error
      )
      schedulePendingCheckoutRecovery()
    } finally {
      isRecoveringPendingCheckout = false
    }
  }

  /**
   * Fetch the current cloud subscription status for the authenticated user
   * @returns Subscription status or null if no subscription exists
   */
  async function fetchSubscriptionStatus(): Promise<CloudSubscriptionStatusResponse | null> {
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
    syncPendingSubscriptionSuccess(statusData)

    return statusData
  }

  const handlePendingSubscriptionCheckoutChange = () => {
    if (!hasPendingSubscriptionCheckoutAttempt()) {
      stopPendingCheckoutRecovery()
      return
    }

    stopPendingCheckoutRecovery()
    void recoverPendingSubscriptionCheckout('retry')
  }

  useEventListener(defaultWindow, PENDING_SUBSCRIPTION_CHECKOUT_EVENT, () => {
    handlePendingSubscriptionCheckoutChange()
  })

  useEventListener(defaultWindow, 'storage', (event: StorageEvent) => {
    if (event.key === PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY) {
      handlePendingSubscriptionCheckoutChange()
    }
  })

  useEventListener(defaultWindow, 'pageshow', () => {
    void recoverPendingSubscriptionCheckout('pageshow')
  })

  useEventListener(defaultDocument, 'visibilitychange', () => {
    if (defaultDocument?.visibilityState === 'visible') {
      void recoverPendingSubscriptionCheckout('visibilitychange')
    }
  })

  watch(
    () => [authStore.isInitialized, isLoggedIn.value] as const,
    async ([authInitialized, loggedIn]) => {
      if (!authInitialized) {
        return
      }

      if (loggedIn && isCloud) {
        try {
          if (hasPendingSubscriptionCheckoutAttempt()) {
            await recoverPendingSubscriptionCheckout('bootstrap')
          } else {
            await fetchSubscriptionStatus()
          }
        } catch (error) {
          // Network errors are expected during navigation/component unmount
          // and when offline - log for debugging but don't surface to user
          console.error('Failed to fetch subscription status:', error)
        } finally {
          isInitialized.value = true
        }
      } else {
        subscriptionStatus.value = null
        clearPendingSubscriptionCheckoutAttempt()
        stopPendingCheckoutRecovery()
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
    showSubscriptionDialog,
    manageSubscription,
    requireActiveSubscription,
    handleViewUsageHistory,
    handleLearnMore,
    handleInvoiceHistory
  }
}

export const useSubscription = createSharedComposable(useSubscriptionInternal)
