import { readonly, shallowRef } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { recordRetentionFlowEvent } from '@/platform/cloud/subscription/launchCancellationFlow'
import type {
  RetentionOfferEvent,
  RetentionOfferPhase
} from '@/platform/cloud/subscription/utils/retentionOffer'
import { reduceRetentionOffer } from '@/platform/cloud/subscription/utils/retentionOffer'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

type RedemptionResult = Exclude<
  RetentionOfferEvent,
  { type: 'acceptRequested' }
>

function refusal(error: unknown): RedemptionResult | undefined {
  if (!(error instanceof WorkspaceApiError) || error.status === undefined) {
    return undefined
  }
  if (error.status >= 500 && error.status !== 503) return undefined
  switch (error.code) {
    case 'RETENTION_SESSION_STALE':
    case 'RETENTION_ALREADY_REDEEMED':
      return { type: 'expired' }
    case 'PREVIOUS_OPERATION_FAILED':
    case 'RETENTION_NOT_ALLOWED':
      return { type: 'declined' }
    default:
      return { type: 'rejected' }
  }
}

async function redeem(
  sessionId: string,
  workspaceId: string
): Promise<RedemptionResult> {
  try {
    const acceptance = await workspaceApi.acceptRetentionOffer(sessionId)
    if (acceptance.status === 'succeeded') return { type: 'applied' }
    const operation = await useBillingOperationStore().startOperation(
      acceptance.billing_op_id,
      'retention',
      { workspaceId }
    )
    switch (operation.status) {
      case 'succeeded':
        return { type: 'applied' }
      case 'failed':
        return { type: 'declined' }
      default:
        return { type: 'unconfirmed' }
    }
  } catch (error) {
    const refused = refusal(error)
    if (refused) return refused
    reportError(error, {
      surface: 'billing',
      errorType: 'failure_confirming_retention_offer'
    })
    return { type: 'unconfirmed' }
  }
}

export function useRetentionOffer(sessionId: string, workspaceId: string) {
  const { fetchStatus } = useBillingContext()
  const phase = shallowRef<RetentionOfferPhase>('offered')

  function dispatch(event: RetentionOfferEvent) {
    phase.value = reduceRetentionOffer(phase.value, event)
  }

  async function refreshPlan() {
    try {
      await fetchStatus()
    } catch (error) {
      reportError(error, {
        surface: 'billing',
        errorType: 'error_refreshing_billing_after_retention_discount'
      })
      useToast().warning(t('subscription.retentionOffer.refreshFailed'), {
        duration: 8000
      })
    }
  }

  async function recordShown() {
    const recorded = await recordRetentionFlowEvent(sessionId, 'offer_shown')
    if (recorded === 'expired') dispatch({ type: 'expired' })
  }

  async function accept() {
    const requested = reduceRetentionOffer(phase.value, {
      type: 'acceptRequested'
    })
    if (requested === phase.value) return
    phase.value = requested
    const result = await redeem(sessionId, workspaceId)
    dispatch(result)
    if (result.type === 'applied') await refreshPlan()
  }

  return { phase: readonly(phase), accept, recordShown }
}
