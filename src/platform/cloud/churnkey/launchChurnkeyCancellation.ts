import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import type { CancellationFlowClosedMetadata } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { ChurnkeySessionResults } from './types'
import { ChurnkeyAuthUnavailableError, useChurnkey } from './useChurnkey'

type CancellationOutcome = CancellationFlowClosedMetadata['outcome']
type FailureReason = NonNullable<
  CancellationFlowClosedMetadata['failure_reason']
>

function deriveOutcome(
  results: ChurnkeySessionResults,
  canceledThisSession: boolean
): CancellationOutcome {
  if (canceledThisSession) return 'canceled'
  if (results.status === 'closed') return 'reconsidered'
  return results.status ?? 'unknown'
}

function classifyFailure(err: unknown): FailureReason {
  if (err instanceof Error) {
    if (err.message.includes('embed script has not loaded')) {
      return 'embed_not_loaded'
    }
    if (err.message.includes('Churnkey is not configured')) {
      return 'auth_unavailable'
    }
  }
  return 'unexpected'
}

function buildCustomerAttributes(
  billing: ReturnType<typeof useBillingContext>
): Record<string, string> | undefined {
  const sub = billing.subscription.value
  if (!sub) return undefined
  const attrs: Record<string, string> = {}
  if (sub.tier) attrs.tier = sub.tier
  if (sub.duration) attrs.cycle = sub.duration
  if (sub.planSlug) attrs.plan_slug = sub.planSlug
  return Object.keys(attrs).length > 0 ? attrs : undefined
}

let inFlight = false

export async function launchChurnkeyCancellation(): Promise<void> {
  if (inFlight) return

  const churnkey = useChurnkey()
  if (!churnkey.isConfigured) {
    throw new Error('Churnkey is not configured')
  }

  inFlight = true
  try {
    const billing = useBillingContext()
    const telemetry = useTelemetry()
    const toast = useToastStore()

    let canceledThisSession = false
    let lastSurveyResponse: string | undefined
    let closedTracked = false

    function trackClosed(
      outcome: CancellationOutcome,
      failureReason?: FailureReason
    ) {
      if (closedTracked) return
      closedTracked = true
      telemetry?.trackCancellationFlowClosed({
        outcome,
        ...(lastSurveyResponse !== undefined && {
          survey_response: lastSurveyResponse
        }),
        ...(failureReason !== undefined && { failure_reason: failureReason })
      })
      if (outcome === 'reconsidered') {
        telemetry?.trackCancellationReconsidered()
      }
    }

    telemetry?.trackCancellationFlowOpened()

    try {
      await churnkey.show({
        customerAttributes: buildCustomerAttributes(billing),
        handleCancel: async () => {
          try {
            await billing.cancelSubscription()
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : t('subscription.cancelDialog.failed')
            const wrapped = new Error(message)
            if (err instanceof Error) wrapped.cause = err
            throw wrapped
          }
          canceledThisSession = true
          telemetry?.trackMonthlySubscriptionCancelled()
          // Local state refresh is best-effort; failure here must not
          // surface as a cancellation failure in the Churnkey embed.
          try {
            await billing.fetchStatus()
          } catch (err) {
            console.warn('[Churnkey] fetchStatus after cancel failed', err)
          }
          return { message: t('subscription.cancelSuccess') }
        },
        onCancel: (surveyResponse) => {
          canceledThisSession = true
          lastSurveyResponse = surveyResponse
        },
        onClose: (results) => {
          const outcome = deriveOutcome(results, canceledThisSession)
          trackClosed(outcome)
          // Reset Churnkey's cached session state so the next launch
          // restarts at step 1 (e.g. user visited Stripe but did not cancel).
          window.churnkey?.clearState?.()
        }
      })
    } catch (err) {
      if (err instanceof ChurnkeyAuthUnavailableError) {
        // Re-throw so the caller can route to the legacy dialog.
        throw err
      }
      trackClosed('unknown', classifyFailure(err))
      const detail = err instanceof Error ? err.message : t('g.unknownError')
      toast.add({
        severity: 'error',
        summary: t('subscription.cancelDialog.failed'),
        detail,
        life: 5000
      })
    }
  } finally {
    inFlight = false
  }
}
