import { storeToRefs } from 'pinia'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { fetchWithUnifiedRemint } from '@/platform/auth/unified/remintRetry'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import {
  createPendingSubscriptionCheckoutAttempt,
  persistPendingSubscriptionCheckoutAttempt,
  withPendingCheckoutAttemptId
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type {
  CheckoutAttributionMetadata,
  PaymentIntentSource
} from '@/platform/telemetry/types'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import type { BillingCycle } from './subscriptionTierRank'

type CheckoutTier = TierKey | `${TierKey}-yearly`

const getCheckoutTier = (
  tierKey: TierKey,
  billingCycle: BillingCycle
): CheckoutTier => (billingCycle === 'yearly' ? `${tierKey}-yearly` : tierKey)

const getCheckoutAttributionForCloud =
  async (): Promise<CheckoutAttributionMetadata> => {
    if (__DISTRIBUTION__ !== 'cloud') {
      return {}
    }

    const { getCheckoutAttribution } =
      await import('@/platform/telemetry/utils/checkoutAttribution')

    return getCheckoutAttribution()
  }

interface PerformSubscriptionCheckoutOptions {
  openInNewTab?: boolean
  paymentIntentSource?: PaymentIntentSource
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
  currentBillingCycle: BillingCycle,
  options: PerformSubscriptionCheckoutOptions = {}
): Promise<void> {
  if (!isCloud) return

  const { openInNewTab = true, paymentIntentSource } = options

  const authStore = useAuthStore()
  const { userId } = storeToRefs(authStore)
  const telemetry = useTelemetry()
  const authHeader = await authStore.getAuthHeader()

  if (!authHeader) {
    throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
  }

  const checkoutTier = getCheckoutTier(tierKey, currentBillingCycle)
  let checkoutAttribution: CheckoutAttributionMetadata = {}
  try {
    checkoutAttribution = await getCheckoutAttributionForCloud()
  } catch (error) {
    console.warn(
      '[SubscriptionCheckout] Failed to collect checkout attribution',
      error
    )
  }
  // Created before the request so the attempt id rides the checkout API call
  // into Stripe subscription metadata; the backend echoes it on the
  // server-side billing success events, joining them to begin_checkout /
  // app:monthly_subscription_succeeded (which carry the same id below).
  const pendingAttempt = createPendingSubscriptionCheckoutAttempt({
    tier: tierKey,
    cycle: currentBillingCycle,
    checkout_type: 'new',
    payment_intent_source: paymentIntentSource
  })
  const checkoutPayload = {
    ...checkoutAttribution,
    checkout_attempt_id: pendingAttempt.attempt_id
  }

  const response = await fetchWithUnifiedRemint(
    `${getComfyApiBaseUrl()}/customers/cloud-subscription-checkout/${checkoutTier}`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload)
    },
    isCloud && useFeatureFlags().flags.unifiedCloudAuthEnabled
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

    throw new AuthStoreError(
      t('toastMessages.failedToInitiateSubscription', {
        error: errorMessage
      })
    )
  }

  const data = await response.json()

  if (data.checkout_url) {
    if (userId.value) {
      telemetry?.trackBeginCheckout(
        withPendingCheckoutAttemptId(
          {
            user_id: userId.value,
            tier: tierKey,
            cycle: currentBillingCycle,
            checkout_type: 'new',
            ...(paymentIntentSource
              ? { payment_intent_source: paymentIntentSource }
              : {}),
            ...checkoutAttribution
          },
          pendingAttempt
        )
      )
    }

    if (openInNewTab) {
      const checkoutWindow = window.open(data.checkout_url, '_blank')
      if (!checkoutWindow) {
        return
      }
      persistPendingSubscriptionCheckoutAttempt(pendingAttempt)
    } else {
      persistPendingSubscriptionCheckoutAttempt(pendingAttempt)
      globalThis.location.href = data.checkout_url
    }
  }
}
