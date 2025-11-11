import { computed, onScopeDispose, ref, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { getComfyApiBaseUrl, getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { MONTHLY_SUBSCRIPTION_PRICE } from '@/config/subscriptionPricesConfig'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import {
  FirebaseAuthStoreError,
  useFirebaseAuthStore
} from '@/stores/firebaseAuthStore'

type CloudSubscriptionCheckoutResponse = {
  checkout_url: string
}

type CloudSubscriptionStatusResponse = {
  is_active: boolean
  subscription_id: string
  renewal_date: string | null
  end_date?: string | null
}

const MAX_CANCELLATION_ATTEMPTS = 4
const CANCELLATION_BASE_DELAY_MS = 5000

function useSubscriptionInternal() {
  const subscriptionStatus = ref<CloudSubscriptionStatusResponse | null>(null)
  const telemetry = useTelemetry()

  const isSubscribedOrIsNotCloud = computed(() => {
    if (!isCloud || !window.__CONFIG__?.subscription_required) return true

    return subscriptionStatus.value?.is_active ?? false
  })
  const { reportError, accessBillingPortal } = useFirebaseAuthActions()
  const dialogService = useDialogService()

  const { getAuthHeader } = useFirebaseAuthStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const { isLoggedIn } = useCurrentUser()

  const isCancelled = computed(() => {
    return !!subscriptionStatus.value?.end_date
  })

  const formattedRenewalDate = computed(() => {
    if (!subscriptionStatus.value?.renewal_date) return ''

    const renewalDate = new Date(subscriptionStatus.value.renewal_date)

    return renewalDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const formattedEndDate = computed(() => {
    if (!subscriptionStatus.value?.end_date) return ''

    const endDate = new Date(subscriptionStatus.value.end_date)

    return endDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const formattedMonthlyPrice = computed(
    () => `$${MONTHLY_SUBSCRIPTION_PRICE.toFixed(0)}`
  )

  const buildApiUrl = (path: string) => `${getComfyApiBaseUrl()}${path}`

  const fetchStatus = wrapWithErrorHandlingAsync(
    fetchSubscriptionStatus,
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

  const showSubscriptionDialog = () => {
    if (isCloud) {
      useTelemetry()?.trackSubscription('modal_opened')
    }

    void dialogService.showSubscriptionRequiredDialog()
  }

  let cancellationTimeout: number | null = null
  let cancellationAttempts = 0
  let cancellationTracked = false
  let focusListenerAttached = false
  let cancellationCheckInFlight = false
  let watcherActive = false

  const shouldWatchCancellation = () =>
    isCloud && window.__CONFIG__?.subscription_required

  const handleWindowFocus = () => {
    if (!watcherActive) return
    void checkForCancellation(true)
  }

  const attachFocusListener = () => {
    if (focusListenerAttached) return
    window.addEventListener('focus', handleWindowFocus)
    focusListenerAttached = true
  }

  const detachFocusListener = () => {
    if (!focusListenerAttached) return
    window.removeEventListener('focus', handleWindowFocus)
    focusListenerAttached = false
  }

  const clearCancellationTimeout = () => {
    if (cancellationTimeout) {
      clearTimeout(cancellationTimeout)
      cancellationTimeout = null
    }
  }

  const stopCancellationWatcher = () => {
    watcherActive = false
    clearCancellationTimeout()
    detachFocusListener()
    cancellationAttempts = 0
    cancellationCheckInFlight = false
  }

  const scheduleNextCancellationCheck = () => {
    if (!watcherActive) return
    if (cancellationAttempts >= MAX_CANCELLATION_ATTEMPTS) {
      stopCancellationWatcher()
      return
    }

    const delay = CANCELLATION_BASE_DELAY_MS * 3 ** cancellationAttempts
    cancellationAttempts += 1
    cancellationTimeout = window.setTimeout(() => {
      void checkForCancellation()
    }, delay)
  }

  const checkForCancellation = async (triggeredFromFocus = false) => {
    if (!watcherActive || cancellationCheckInFlight) return

    cancellationCheckInFlight = true
    try {
      await fetchStatus()

      if (!isSubscribedOrIsNotCloud.value) {
        if (!cancellationTracked) {
          cancellationTracked = true
          telemetry?.trackMonthlySubscriptionCancelled()
        }
        stopCancellationWatcher()
        return
      }

      if (!triggeredFromFocus) {
        scheduleNextCancellationCheck()
      }
    } catch (error) {
      console.error('[Subscription] Error checking cancellation status:', error)
      scheduleNextCancellationCheck()
    } finally {
      cancellationCheckInFlight = false
    }
  }

  const startCancellationWatcher = () => {
    if (!shouldWatchCancellation() || !subscriptionStatus.value?.is_active) {
      return
    }

    stopCancellationWatcher()
    watcherActive = true
    cancellationTracked = false
    cancellationAttempts = 0
    attachFocusListener()
    scheduleNextCancellationCheck()
  }

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
  async function fetchSubscriptionStatus(): Promise<CloudSubscriptionStatusResponse | null> {
    const authHeader = await getAuthHeader()
    if (!authHeader) {
      throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    const response = await fetch(
      buildApiUrl('/customers/cloud-subscription-status'),
      {
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new FirebaseAuthStoreError(
        t('toastMessages.failedToFetchSubscription', {
          error: errorData.message
        })
      )
    }

    const statusData = await response.json()
    subscriptionStatus.value = statusData
    return statusData
  }

  watch(
    () => isLoggedIn.value,
    async (loggedIn) => {
      if (loggedIn) {
        await fetchSubscriptionStatus()
      } else {
        subscriptionStatus.value = null
        stopCancellationWatcher()
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    stopCancellationWatcher()
  })

  const initiateSubscriptionCheckout =
    async (): Promise<CloudSubscriptionCheckoutResponse> => {
      const authHeader = await getAuthHeader()
      if (!authHeader) {
        throw new FirebaseAuthStoreError(
          t('toastMessages.userNotAuthenticated')
        )
      }

      const response = await fetch(
        buildApiUrl('/customers/cloud-subscription-checkout'),
        {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new FirebaseAuthStoreError(
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
    isCancelled,
    formattedRenewalDate,
    formattedEndDate,
    formattedMonthlyPrice,

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
