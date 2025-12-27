import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import {
  FirebaseAuthStoreError,
  useFirebaseAuthStore
} from '@/stores/firebaseAuthStore'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'

export type BillingCycle = 'monthly' | 'yearly'
type CheckoutTier = TierKey | `${TierKey}-yearly`

const getCheckoutTier = (
  tierKey: TierKey,
  billingCycle: BillingCycle
): CheckoutTier => (billingCycle === 'yearly' ? `${tierKey}-yearly` : tierKey)

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
  currentBillingCycle: BillingCycle,
  openInNewTab: boolean = true
): Promise<void> {
  if (!isCloud) return

  const { getAuthHeader } = useFirebaseAuthStore()
  const authHeader = await getAuthHeader()

  if (!authHeader) {
    throw new FirebaseAuthStoreError(t('toastMessages.userNotAuthenticated'))
  }

  const checkoutTier = getCheckoutTier(tierKey, currentBillingCycle)

  const response = await fetch(
    `${getComfyApiBaseUrl()}/customers/cloud-subscription-checkout/${checkoutTier}`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' }
    }
  )

  if (!response.ok) {
    let errorMessage = 'Failed to initiate checkout'
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
    } catch {
      // If JSON parsing fails, try to get text response or use HTTP status
      try {
        const errorText = await response.text()
        errorMessage =
          errorText || `HTTP ${response.status} ${response.statusText}`
      } catch {
        errorMessage = `HTTP ${response.status} ${response.statusText}`
      }
    }

    throw new FirebaseAuthStoreError(
      t('toastMessages.failedToInitiateSubscription', {
        error: errorMessage
      })
    )
  }

  const data = await response.json()

  if (data.checkout_url) {
    if (openInNewTab) {
      window.open(data.checkout_url, '_blank')
    } else {
      globalThis.location.href = data.checkout_url
    }
  }
}
