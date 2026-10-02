import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  PendingSubscriptionCheckoutAttempt,
  PendingSubscriptionCheckoutAttemptInput
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import {
  createPendingSubscriptionCheckoutAttempt,
  persistPendingSubscriptionCheckoutAttempt,
  withPendingCheckoutAttemptId
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { webSessionResourceHeader } from '@/platform/auth/session/webSessionFetch'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  CheckoutAttributionMetadata,
  PaymentIntentSource
} from '@/platform/telemetry/types'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import {
  BillingFailureError,
  PaymentPopupBlockedError,
  describeBillingFailure
} from '@/platform/telemetry/utils/billingFailureCategory'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'

import type { BillingCycle } from './subscriptionTierRank'
import { loadCheckoutAttributionModule } from './checkoutAttributionLoader'

type CheckoutTier = TierKey | `${TierKey}-yearly`

const getCheckoutTier = (
  tierKey: TierKey,
  billingCycle: BillingCycle
): CheckoutTier => (billingCycle === 'yearly' ? `${tierKey}-yearly` : tierKey)

type CheckoutAttributionStage = 'module_load' | 'collect'

type CheckoutAttributionOutcome =
  | { ok: true; attribution: CheckoutAttributionMetadata }
  | { ok: false; error: unknown; stage: CheckoutAttributionStage }

const getCheckoutAttributionForCloud =
  async (): Promise<CheckoutAttributionOutcome> => {
    if (__DISTRIBUTION__ !== 'cloud') {
      return { ok: true, attribution: {} }
    }

    let attributionModule
    try {
      attributionModule = await loadCheckoutAttributionModule()
    } catch (error) {
      return { ok: false, error, stage: 'module_load' }
    }

    const getCheckoutAttribution = attributionModule.getCheckoutAttribution

    if (typeof getCheckoutAttribution !== 'function') {
      return {
        ok: false,
        error: new TypeError('Checkout attribution module is unavailable'),
        stage: 'module_load'
      }
    }

    try {
      return {
        ok: true,
        attribution: await getCheckoutAttribution()
      }
    } catch (error) {
      return { ok: false, error, stage: 'collect' }
    }
  }

async function getCheckoutAttributionPayload(): Promise<CheckoutAttributionMetadata> {
  const attribution = await getCheckoutAttributionForCloud()
  if (attribution.ok) return attribution.attribution

  reportError(attribution.error, {
    surface: 'billing',
    errorType: 'cloud_checkout_attribution_fallback',
    tags: {
      failure_kind: 'degraded',
      feature_area: 'billing',
      operation: 'load',
      outcome: 'degraded',
      attribution_stage: attribution.stage
    },
    level: 'warning'
  })
  return {}
}

const checkoutAuthHeader = async (authStore: ReturnType<typeof useAuthStore>) =>
  (await webSessionResourceHeader()) ??
  (await authStore.getFirebaseAuthHeader())

interface PerformSubscriptionCheckoutOptions {
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

  await runReportedCheckoutAttempt(
    {
      tier: tierKey,
      cycle: currentBillingCycle,
      checkout_type: 'new',
      payment_intent_source: options.paymentIntentSource,
      owner_id: useAuthStore().userId ?? undefined,
      workspace_id: useTeamWorkspaceStore().activeWorkspaceId
    },
    (pendingAttempt) =>
      initiateSubscriptionCheckout(pendingAttempt, options.paymentIntentSource)
  )
}

export const missingCheckoutUrlError = () =>
  new BillingFailureError(
    t('toastMessages.failedToInitiateSubscription', {
      error: 'No checkout URL returned'
    }),
    { failure_category: 'unknown', error_code: 'missing_checkout_response' }
  )

export type ReportedCheckoutAttemptInput = Omit<
  PendingSubscriptionCheckoutAttemptInput,
  'start_reported'
>

/**
 * Reports `started` for one legacy checkout attempt and `failed` when `launch`
 * rejects. Its success is reported later by the pending-checkout recovery,
 * which closes only attempts marked `start_reported`.
 */
export async function runReportedCheckoutAttempt(
  input: ReportedCheckoutAttemptInput,
  launch: (attempt: PendingSubscriptionCheckoutAttempt) => Promise<void>
): Promise<void> {
  const telemetry = useTelemetry()
  const attempt = createPendingSubscriptionCheckoutAttempt({
    ...input,
    start_reported: true
  })
  const attemptEvent = {
    operation: 'subscription_checkout',
    checkout_attempt_id: attempt.attempt_id,
    tier: attempt.tier,
    cycle: attempt.cycle,
    checkout_type: attempt.checkout_type,
    payment_intent_source: attempt.payment_intent_source
  } as const
  telemetry?.trackBillingEvent({
    ...attemptEvent,
    stage: 'started',
    outcome: 'pending'
  })

  try {
    await launch(attempt)
  } catch (error) {
    telemetry?.trackBillingEvent({
      ...attemptEvent,
      stage: 'failed',
      outcome: 'failure',
      ...describeBillingFailure(error),
      duration_ms: Date.now() - attempt.started_at_ms
    })
    throw error
  }
}

async function initiateSubscriptionCheckout(
  pendingAttempt: PendingSubscriptionCheckoutAttempt,
  paymentIntentSource: PaymentIntentSource | undefined
): Promise<void> {
  const { tier: tierKey, cycle: currentBillingCycle } = pendingAttempt

  const authStore = useAuthStore()
  const telemetry = useTelemetry()
  const authHeader = await checkoutAuthHeader(authStore)

  if (!authHeader) {
    throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
  }

  const checkoutTier = getCheckoutTier(tierKey, currentBillingCycle)
  const checkoutAttribution = await getCheckoutAttributionPayload()
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

  completeSubscriptionCheckout(data.checkout_url, {
    tierKey,
    currentBillingCycle,
    paymentIntentSource,
    pendingAttempt,
    checkoutAttribution,
    telemetry
  })
}

interface CheckoutCompletionContext {
  tierKey: TierKey
  currentBillingCycle: BillingCycle
  paymentIntentSource?: PaymentIntentSource
  pendingAttempt: PendingSubscriptionCheckoutAttempt
  checkoutAttribution: CheckoutAttributionMetadata
  telemetry: ReturnType<typeof useTelemetry>
}

function trackBeginCheckout(context: CheckoutCompletionContext) {
  const { pendingAttempt, paymentIntentSource } = context
  const userId = pendingAttempt.owner_id
  if (!userId) return

  context.telemetry?.trackBeginCheckout(
    withPendingCheckoutAttemptId(
      {
        user_id: userId,
        tier: context.tierKey,
        cycle: context.currentBillingCycle,
        checkout_type: 'new',
        ...(paymentIntentSource
          ? { payment_intent_source: paymentIntentSource }
          : {}),
        ...context.checkoutAttribution
      },
      pendingAttempt
    )
  )
}

function completeSubscriptionCheckout(
  checkoutUrl: string | undefined,
  context: CheckoutCompletionContext
) {
  if (!checkoutUrl) throw missingCheckoutUrlError()

  trackBeginCheckout(context)

  if (!window.open(checkoutUrl, '_blank')) {
    throw new PaymentPopupBlockedError(
      t('subscription.preview.paymentPopupBlocked')
    )
  }
  persistPendingSubscriptionCheckoutAttempt(context.pendingAttempt)
}
