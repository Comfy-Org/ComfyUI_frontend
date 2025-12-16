import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import {
  FirebaseAuthStoreError,
  useFirebaseAuthStore
} from '@/stores/firebaseAuthStore'

export type TierKey = 'standard' | 'creator' | 'pro'

interface CheckoutResponse {
  checkout_url?: string
}

/**
 * Core subscription checkout logic shared between PricingTable and
 * SubscriptionRedirectView. Handles:
 * - Ensuring the user is authenticated
 * - Calling the backend checkout endpoint
 * - Normalizing error responses
 * - Opening the checkout URL in a new tab when available
 *
 * Callers are responsible for:
 * - Guarding on cloud-only behavior (isCloud)
 * - Managing loading state
 * - Wrapping with error handling (e.g. useErrorHandling)
 */
export async function performSubscriptionCheckout(
  tierKey: TierKey,
  openInNewTab: boolean = true
): Promise<void> {
  if (!isCloud) return

  const { getAuthHeader } = useFirebaseAuthStore()
  const authHeader = await getAuthHeader()

  if (!authHeader) {
    throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
  }

  const response = await fetch(
    `${getComfyApiBaseUrl()}/customers/cloud-subscription-checkout/${tierKey}`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' }
    }
  )

  if (!response.ok) {
    let errorMessage = 'Failed to initiate checkout'

    try {
      const text = await response.text()
      try {
        const errorData = JSON.parse(text) as { message?: string }
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = text || `HTTP ${response.status} ${response.statusText}`
      }
    } catch {
      errorMessage = `HTTP ${response.status} ${response.statusText}`
    }

    throw new FirebaseAuthStoreError(
      t('toastMessages.failedToInitiateSubscription', {
        error: errorMessage
      })
    )
  }

  let data: CheckoutResponse
  try {
    data = (await response.json()) as CheckoutResponse
  } catch (error) {
    throw new FirebaseAuthStoreError(
      t('toastMessages.failedToInitiateSubscription', {
        error: 'Invalid response from server'
      })
    )
  }

  if (data.checkout_url) {
    if (openInNewTab) {
      window.open(data.checkout_url, '_blank')
    } else {
      globalThis.location.href = data.checkout_url
    }
  }
}
