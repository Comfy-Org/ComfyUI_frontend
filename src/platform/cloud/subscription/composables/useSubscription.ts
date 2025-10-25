import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { COMFY_API_BASE_URL } from '@/config/comfyApi'
import { MONTHLY_SUBSCRIPTION_PRICE } from '@/config/subscriptionPricesConfig'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import {
  FirebaseAuthStoreError,
  useFirebaseAuthStore
} from '@/stores/firebaseAuthStore'

interface CloudSubscriptionCheckoutResponse {
  checkout_url: string
}

interface CloudSubscriptionStatusResponse {
  is_active: boolean
  subscription_id: string
  renewal_date: string
}

const subscriptionStatus = ref<CloudSubscriptionStatusResponse | null>(null)

const isActiveSubscription = computed(() => {
  if (!isCloud || !window.__CONFIG__?.subscription_required) return true

  return subscriptionStatus.value?.is_active ?? false
})

let isWatchSetup = false

export function useSubscription() {
  const authActions = useFirebaseAuthActions()
  const dialogService = useDialogService()

  const { getAuthHeader } = useFirebaseAuthStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const { reportError } = useFirebaseAuthActions()

  const { isLoggedIn } = useCurrentUser()

  const formattedRenewalDate = computed(() => {
    if (!subscriptionStatus.value?.renewal_date) return ''

    const renewalDate = new Date(subscriptionStatus.value.renewal_date)

    return renewalDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const formattedMonthlyPrice = computed(
    () => `$${MONTHLY_SUBSCRIPTION_PRICE.toFixed(0)}`
  )

  const fetchStatus = wrapWithErrorHandlingAsync(async () => {
    return await fetchSubscriptionStatus()
  }, reportError)

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

    dialogService.showSubscriptionRequiredDialog()
  }

  const manageSubscription = async () => {
    await authActions.accessBillingPortal()
  }

  const requireActiveSubscription = async (): Promise<void> => {
    await fetchSubscriptionStatus()

    if (!isActiveSubscription.value) {
      showSubscriptionDialog()
    }
  }

  const handleViewUsageHistory = () => {
    window.open('https://platform.comfy.org/profile/usage', '_blank')
  }

  const handleLearnMore = () => {
    window.open('https://docs.comfy.org', '_blank')
  }

  const handleInvoiceHistory = async () => {
    await authActions.accessBillingPortal()
  }

  /**
   * Fetch the current cloud subscription status for the authenticated user
   * @returns Subscription status or null if no subscription exists
   */
  const fetchSubscriptionStatus =
    async (): Promise<CloudSubscriptionStatusResponse | null> => {
      const authHeader = await getAuthHeader()
      if (!authHeader) {
        throw new FirebaseAuthStoreError(
          t('toastMessages.userNotAuthenticated')
        )
      }

      const response = await fetch(
        `${COMFY_API_BASE_URL}/customers/cloud-subscription-status`,
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

  if (!isWatchSetup) {
    isWatchSetup = true
    watch(
      () => isLoggedIn.value,
      async (loggedIn) => {
        if (loggedIn) {
          await fetchSubscriptionStatus()
        } else {
          subscriptionStatus.value = null
        }
      },
      { immediate: true }
    )
  }

  const initiateSubscriptionCheckout =
    async (): Promise<CloudSubscriptionCheckoutResponse> => {
      const authHeader = await getAuthHeader()
      if (!authHeader) {
        throw new FirebaseAuthStoreError(
          t('toastMessages.userNotAuthenticated')
        )
      }

      const response = await fetch(
        `${COMFY_API_BASE_URL}/customers/cloud-subscription-checkout`,
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
    isActiveSubscription,
    formattedRenewalDate,
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
