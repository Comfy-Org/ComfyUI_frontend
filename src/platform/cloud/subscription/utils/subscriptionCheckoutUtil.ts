import { storeToRefs } from 'pinia'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import {
  createPendingSubscriptionCheckoutAttempt,
  persistPendingSubscriptionCheckoutAttempt,
  withPendingCheckoutAttemptId
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  CheckoutAttributionMetadata,
  PaymentIntentSource
} from '@/platform/telemetry/types'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
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
 * - Reporting checkout-initiation failures via `trackBillingEvent`
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

  try {
    await initiateSubscriptionCheckout(tierKey, currentBillingCycle, options)
  } catch (error) {
    useTelemetry()?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: tierKey,
      cycle: currentBillingCycle,
      checkout_type: 'new',
      payment_intent_source: options.paymentIntentSource,
      failure_category: categorizeBillingApiError(error)
    })
    throw error
  }
}

async function initiateSubscriptionCheckout(
  tierKey: TierKey,
  currentBillingCycle: BillingCycle,
  options: PerformSubscriptionCheckoutOptions
): Promise<void> {
  const { openInNewTab = true, paymentIntentSource } = options

  const authStore = useAuthStore()
  const { userId } = storeToRefs(authStore)
  const telemetry = useTelemetry()
  const authHeader = await authStore.getFirebaseAuthHeader()

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
  const checkoutPayload = { ...checkoutAttribution }

  const response = await authStore.fetchWithCustomerRecovery(
    `${getComfyApiBaseUrl()}/customers/cloud-subscription-checkout/${checkoutTier}`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload)
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

  const data = await response.json()

  if (data.checkout_url) {
    const pendingAttempt = createPendingSubscriptionCheckoutAttempt({
      tier: tierKey,
      cycle: currentBillingCycle,
      checkout_type: 'new',
      payment_intent_source: paymentIntentSource
    })

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
        reportError(new Error('Subscription checkout popup was blocked'), {
          errorType: 'cloud_checkout_popup_blocked',
          tags: {
            failure_kind: 'bad_state',
            feature_area: 'cloud',
            operation: 'navigate',
            outcome: 'aborted',
            assert_mode: 'soft'
          },
          context: {
            checkout_type: 'new',
            open_in_new_tab: true
          },
          level: 'error'
        })
        return
      }
      persistPendingSubscriptionCheckoutAttempt(pendingAttempt)
    } else {
      persistPendingSubscriptionCheckoutAttempt(pendingAttempt)
      globalThis.location.href = data.checkout_url
    }
  }
}
