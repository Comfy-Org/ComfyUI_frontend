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
import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  CheckoutAttributionMetadata,
  ResubscribeClickMetadata
} from '@/platform/telemetry/types'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useDialogService } from '@/services/dialogService'
import { toTierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { operations } from '@/types/comfyRegistryTypes'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
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

const PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS = [3000, 10000, 30000]

function useSubscriptionInternal() {
  const subscriptionStatus = ref<BillingStatusResponse | null>(null)
  const telemetry = useTelemetry()
  const isInitialized = ref(false)

  const canAccessSubscriptionFeatures = computed(() => {
    if (!isCloud || !window.__CONFIG__.subscription_required) return true

    return subscriptionStatus.value?.is_active ?? false
  })
  const { reportError, accessBillingPortal } = useAuthActions()
  const { showSubscriptionRequiredDialog } = useDialogService()

  const authStore = useAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const { getFirebaseAuthHeader, fetchWithCustomerRecovery } = authStore
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const { isLoggedIn } = useCurrentUser()

  const isCancelled = computed(() => {
    return !!subscriptionStatus.value?.cancel_at
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
    if (!subscriptionStatus.value?.cancel_at) return ''

    const endDate = new Date(subscriptionStatus.value.cancel_at)

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
    const key = toTierKey(tier) ?? 'standard'
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

    const nextDelay = getPendingCheckoutRetryDelay(
      pendingCheckoutRecoveryAttempt
    )

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
    statusData: BillingStatusResponse
  ) => {
    const metadata = consumePendingSubscriptionCheckoutSuccess(statusData)

    if (!metadata) {
      if (hasPendingSubscriptionCheckoutAttempt()) {
        schedulePendingCheckoutRecovery()
      } else {
        stopPendingCheckoutRecovery()
      }
      return
    }

    telemetry?.trackMonthlySubscriptionSucceeded({
      ...(authStore.userId ? { user_id: authStore.userId } : {}),
      ...metadata
    })

    // The recovery flow is shared with plain (non-resubscribe) legacy subscribes,
    // which all funnel through the same subscribeDirect(). Only emit the canonical
    // resubscribe terminal when the attempt that just resolved was itself tagged
    // as a resubscribe at click time — otherwise a plain new subscribe would be
    // mislabeled as a resubscribe success. Without this, the legacy rail's
    // `billing.resubscribe.started` (emitted at checkout-tab-open) never gets a
    // matching terminal, so resubscribe conversion permanently reads ~0%.
    if (metadata.operation === 'resubscribe') {
      telemetry?.trackBillingEvent({
        operation: 'resubscribe',
        stage: 'succeeded',
        outcome: 'success',
        source: metadata.resubscribe_source ?? 'settings_billing_panel',
        ...(metadata.payment_intent_source
          ? { payment_intent_source: metadata.payment_intent_source }
          : {})
      })
    }

    stopPendingCheckoutRecovery()
  }

  const buildAuthHeaders = async (): Promise<Record<string, string>> => {
    const authHeader = await getFirebaseAuthHeader()
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

  interface SubscribeDirectOptions {
    /** Set when this call originates from the resubscribe flow, not a plain subscribe. */
    operation?: 'resubscribe'
    /** Click-time source for a resubscribe attempt; carried through to the terminal event. */
    source?: ResubscribeClickMetadata['source']
  }

  /** Unwrapped `subscribe`, for callers that need rejections to propagate (e.g. telemetry). */
  const subscribeDirect = async (
    options?: SubscribeDirectOptions
  ): Promise<void> => {
    const response = await initiateSubscriptionCheckout()

    if (!response.checkout_url) {
      throw new Error(
        t('toastMessages.failedToInitiateSubscription', {
          error: 'No checkout URL returned'
        })
      )
    }

    const checkoutWindow = window.open(response.checkout_url, '_blank')
    if (!checkoutWindow) {
      return
    }

    const previousTierKey = subscriptionTier.value
      ? toTierKey(subscriptionTier.value)
      : null

    recordPendingSubscriptionCheckoutAttempt({
      tier: 'standard',
      cycle: 'monthly',
      checkout_type: canAccessSubscriptionFeatures.value ? 'change' : 'new',
      ...(previousTierKey ? { previous_tier: previousTierKey } : {}),
      ...(subscriptionDuration.value === 'ANNUAL'
        ? { previous_cycle: 'yearly' as const }
        : subscriptionDuration.value === 'MONTHLY'
          ? { previous_cycle: 'monthly' as const }
          : {}),
      ...(options?.operation ? { operation: options.operation } : {}),
      ...(options?.source ? { resubscribe_source: options.source } : {})
    })
  }

  const subscribe = wrapWithErrorHandlingAsync(subscribeDirect, reportError)

  const showSubscriptionDialog = (options?: SubscriptionDialogOptions) => {
    void showSubscriptionRequiredDialog(options)
  }

  /**
   * Whether cloud subscription mode is enabled (cloud distribution with subscription_required config).
   */
  const isSubscriptionEnabled = (): boolean =>
    Boolean(isCloud && window.__CONFIG__.subscription_required)

  const { startCancellationWatcher, stopCancellationWatcher } =
    useSubscriptionCancellationWatcher({
      fetchStatus,
      canAccessSubscriptionFeatures: canAccessSubscriptionFeatures,
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

    if (!canAccessSubscriptionFeatures.value) {
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

  // Coalesce concurrent callers so an auth/session-rotation burst mints one fetch.
  let inFlightStatusFetch: Promise<BillingStatusResponse | null> | null = null
  let inFlightStatusOwnerId: string | null = null
  let inFlightStatusWorkspaceId: string | null = null

  async function fetchSubscriptionStatus(): Promise<BillingStatusResponse | null> {
    const ownerId = authStore.userId ?? null
    const workspaceId = workspaceStore.activeWorkspaceId
    if (
      inFlightStatusFetch &&
      inFlightStatusOwnerId === ownerId &&
      inFlightStatusWorkspaceId === workspaceId
    ) {
      return inFlightStatusFetch
    }

    const fetchPromise = performFetchSubscriptionStatus(ownerId, workspaceId)
    inFlightStatusFetch = fetchPromise
    inFlightStatusOwnerId = ownerId
    inFlightStatusWorkspaceId = workspaceId
    void fetchPromise
      .catch(() => undefined)
      .finally(() => {
        if (inFlightStatusFetch === fetchPromise) {
          inFlightStatusFetch = null
          inFlightStatusOwnerId = null
          inFlightStatusWorkspaceId = null
        }
      })
    return fetchPromise
  }

  async function performFetchSubscriptionStatus(
    ownerId: string | null,
    workspaceId: string | null
  ): Promise<BillingStatusResponse | null> {
    if (!isCloud) return null

    let statusData: BillingStatusResponse
    try {
      statusData = await workspaceApi.getBillingStatus()
    } catch (error) {
      throw new AuthStoreError(
        t('toastMessages.failedToFetchSubscription', {
          error: error instanceof Error ? error.message : String(error)
        })
      )
    }
    if (
      (authStore.userId ?? null) !== ownerId ||
      workspaceStore.activeWorkspaceId !== workspaceId
    ) {
      return null
    }
    subscriptionStatus.value = statusData
    if (workspaceId && statusData.billing_rail) {
      workspaceStore.setWorkspaceBillingRail(
        workspaceId,
        statusData.billing_rail
      )
    }
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
    () =>
      [authStore.isInitialized, isLoggedIn.value, authStore.userId] as const,
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

      const response = await fetchWithCustomerRecovery(
        buildApiUrl('/customers/cloud-subscription-checkout'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(checkoutAttribution)
        }
      )

      if (!response.ok) {
        const { message } = await parseErrorResponse(response)
        throw new AuthStoreError(
          t('toastMessages.failedToInitiateSubscription', {
            error: message
          }),
          response.status
        )
      }

      return response.json()
    }

  return {
    // State
    canAccessSubscriptionFeatures: canAccessSubscriptionFeatures,
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
    subscribeDirect,
    fetchStatus,
    showSubscriptionDialog,
    manageSubscription,
    requireActiveSubscription,
    handleViewUsageHistory,
    handleLearnMore,
    handleInvoiceHistory
  }
}

function getPendingCheckoutRetryDelay(attempt: number): number | undefined {
  return PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS[attempt]
}

export const useSubscription = createSharedComposable(useSubscriptionInternal)
