import { useToast } from 'primevue/usetoast'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'

import type { ChurnkeySessionResults } from './types'
import { useChurnkey } from './useChurnkey'

let canceledThisSession = false

function deriveOutcome(
  results: ChurnkeySessionResults
): 'canceled' | 'reconsidered' | 'unknown' {
  if (canceledThisSession) return 'canceled'
  if (results.status === 'canceled') return 'canceled'
  if (results.status === 'closed') return 'reconsidered'
  return 'unknown'
}

export async function launchChurnkeyCancellation(): Promise<void> {
  const churnkey = useChurnkey()
  const billing = useBillingContext()
  const telemetry = useTelemetry()
  const toast = useToast()

  if (!churnkey.isConfigured) {
    console.error('Churnkey is not configured; falling back to legacy flow')
    throw new Error('Churnkey is not configured')
  }

  canceledThisSession = false
  telemetry?.trackCancellationFlowOpened()

  try {
    await churnkey.show({
      handleCancel: async () => {
        try {
          await billing.cancelSubscription()
          await billing.fetchStatus()
          canceledThisSession = true
          telemetry?.trackMonthlySubscriptionCancelled()
          return { message: t('subscription.cancelSuccess') }
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : t('subscription.cancelDialog.failed')
          throw { message }
        }
      },
      onCancel: (surveyResponse) => {
        canceledThisSession = true
        telemetry?.trackCancellationFlowClosed({
          outcome: 'canceled',
          survey_response: surveyResponse
        })
      },
      onClose: (results) => {
        const outcome = deriveOutcome(results)
        telemetry?.trackCancellationFlowClosed({ outcome })
        if (outcome === 'reconsidered') {
          telemetry?.trackCancellationReconsidered()
        }
      }
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : t('g.unknownError')
    toast.add({
      severity: 'error',
      summary: t('subscription.cancelDialog.failed'),
      detail,
      life: 5000
    })
    throw err
  }
}
