import { useToast } from 'primevue/usetoast'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'

import type { ChurnkeySessionResults } from './types'
import { useChurnkey } from './useChurnkey'

type CancellationOutcome = 'canceled' | 'reconsidered' | 'unknown'

function deriveOutcome(
  results: ChurnkeySessionResults,
  canceledThisSession: boolean
): CancellationOutcome {
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
    throw new Error('Churnkey is not configured')
  }

  let canceledThisSession = false
  let lastSurveyResponse: string | undefined
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
        lastSurveyResponse = surveyResponse
      },
      onClose: (results) => {
        const outcome = deriveOutcome(results, canceledThisSession)
        telemetry?.trackCancellationFlowClosed({
          outcome,
          survey_response: lastSurveyResponse
        })
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
  }
}
