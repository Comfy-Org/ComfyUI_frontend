import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import type { CancellationFlowClosedMetadata } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { ChurnkeySession } from './churnkeyClient'
import { prepareChurnkey } from './churnkeyClient'
import { ChurnkeyAuthUnavailableError, ChurnkeyEmbedLoadError } from './errors'
import type { ChurnkeySessionResults } from './types'

type CancellationOutcome = CancellationFlowClosedMetadata['outcome']

function deriveOutcome(
  results: ChurnkeySessionResults,
  canceledThisSession: boolean,
  cancelApiFailed: boolean
): CancellationOutcome {
  if (canceledThisSession) return 'canceled'
  if (cancelApiFailed) return 'unknown'
  if (results.status === 'closed') return 'reconsidered'
  return results.status ?? 'unknown'
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
  inFlight = true
  try {
    await runCancellationFlow()
  } finally {
    inFlight = false
  }
}

async function runCancellationFlow(): Promise<void> {
  const billing = useBillingContext()
  const telemetry = useTelemetry()
  const toast = useToastStore()

  function showFailureToast(err: unknown) {
    toast.add({
      severity: 'error',
      summary: t('subscription.cancelDialog.failed'),
      detail: err instanceof Error ? err.message : t('g.unknownError'),
      life: 5000
    })
  }

  let session: ChurnkeySession
  try {
    session = await prepareChurnkey()
  } catch (err) {
    if (
      err instanceof ChurnkeyAuthUnavailableError ||
      err instanceof ChurnkeyEmbedLoadError
    ) {
      // Re-throw so the caller can route to the legacy dialog.
      throw err
    }
    showFailureToast(err)
    return
  }

  let canceledThisSession = false
  let cancelApiFailed = false
  let lastSurveyResponse: string | undefined

  telemetry?.trackCancellationFlowOpened()

  try {
    const results = await session.show({
      customerAttributes: buildCustomerAttributes(billing),
      // Workspace billing cancels through our API; legacy billing omits
      // handleCancel so Churnkey cancels directly via Stripe.
      ...(billing.type.value === 'workspace' && {
        handleCancel: async () => {
          try {
            await billing.cancelSubscription()
          } catch (err) {
            cancelApiFailed = true
            const message =
              err instanceof Error
                ? err.message
                : t('subscription.cancelDialog.failed')
            // Churnkey displays the rejection message in its own UI.
            throw new Error(message, { cause: err })
          }
          cancelApiFailed = false
          return { message: t('subscription.cancelSuccess') }
        }
      }),
      // Fires after a successful cancel — whether via handleCancel (team)
      // or Churnkey's own Stripe cancel (legacy). No double-fire with
      // useSubscriptionCancellationWatcher: that watcher only runs after
      // opening the Stripe billing portal via manageSubscription.
      onCancel: (surveyResponse) => {
        canceledThisSession = true
        lastSurveyResponse = surveyResponse
        telemetry?.trackMonthlySubscriptionCancelled()
      }
    })

    const outcome = deriveOutcome(results, canceledThisSession, cancelApiFailed)
    const failureReason = cancelApiFailed
      ? ('cancel_api_failed' as const)
      : undefined
    telemetry?.trackCancellationFlowClosed({
      outcome,
      ...(lastSurveyResponse !== undefined && {
        survey_response: lastSurveyResponse
      }),
      ...(failureReason !== undefined && { failure_reason: failureReason })
    })

    if (canceledThisSession) {
      // Refresh local state so the UI reflects the cancellation. Failure
      // here is non-blocking; the next page load will catch up.
      void billing.fetchStatus().catch(() => {})
    }
  } catch (err) {
    // session.show only rejects when churnkey.init itself throws — keep
    // the funnel balanced since `opened` has already been tracked.
    telemetry?.trackCancellationFlowClosed({
      outcome: 'unknown',
      failure_reason: 'unexpected'
    })
    showFailureToast(err)
  }
}
