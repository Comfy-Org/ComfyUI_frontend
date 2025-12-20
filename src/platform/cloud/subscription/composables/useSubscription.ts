import { computed, ref, watch } from 'vue'
import { createSharedComposable } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { getComfyApiBaseUrl, getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import {
  FirebaseAuthStoreError,
  useFirebaseAuthStore
} from '@/stores/firebaseAuthStore'
import { useDialogService } from '@/services/dialogService'
import type { components, operations } from '@/types/comfyRegistryTypes'
import { useSubscriptionCancellationWatcher } from './useSubscriptionCancellationWatcher'

type CloudSubscriptionCheckoutResponse = NonNullable<
  operations['createCloudSubscriptionCheckout']['responses']['201']['content']['application/json']
>

export type CloudSubscriptionStatusResponse = NonNullable<
  operations['GetCloudSubscriptionStatus']['responses']['200']['content']['application/json']
>

type SubscriptionTier = components['schemas']['SubscriptionTier']

const TIER_TO_I18N_KEY: Record<SubscriptionTier, string> = {
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDERS_EDITION: 'founder'
}

function useSubscriptionInternal() {
  const subscriptionStatus = ref<CloudSubscriptionStatusResponse | null>(null)
  const telemetry = useTelemetry()

  const isSubscribedOrIsNotCloud = computed(() => {
    if (!isCloud || !window.__CONFIG__?.subscription_required) return true

    return subscriptionStatus.value?.is_active ?? false
  })
  const { reportError, accessBillingPortal } = useFirebaseAuthActions()
  const { showSubscriptionRequiredDialog } = useDialogService()

  const { getAuthHeader } = useFirebaseAuthStore()
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

  const subscriptionTierName = computed(() => {
    const tier = subscriptionTier.value
    if (!tier) return ''
    const key = TIER_TO_I18N_KEY[tier] ?? 'standard'
    return t(`subscription.tiers.${key}.name`)
  })

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

    void showSubscriptionRequiredDialog()
  }

  const shouldWatchCancellation = (): boolean =>
    Boolean(isCloud && window.__CONFIG__?.subscription_required)

  const { startCancellationWatcher, stopCancellationWatcher } =
    useSubscriptionCancellationWatcher({
      fetchStatus,
      isActiveSubscription: isSubscribedOrIsNotCloud,
      subscriptionStatus,
      telemetry,
      shouldWatchCancellation
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
    subscriptionTier,
    subscriptionTierName,
    subscriptionStatus,

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
