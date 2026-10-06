import { readonly, shallowRef } from 'vue'

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

function refusedBeforeWrite(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError &&
    error.status !== undefined &&
    (error.status < 500 || error.status === 503)
  )
}

async function redeem(
  sessionId: string,
  workspaceId: string
): Promise<RedemptionResult> {
  try {
    const acceptance = await workspaceApi.acceptRetentionOffer(sessionId)
    const operation = await useBillingOperationStore().startOperation(
      acceptance.billing_op_id,
      'retention',
      { workspaceId }
    )
    switch (operation.status) {
      case 'succeeded':
        return { type: 'applied' }
      case 'failed':
        return { type: 'rejected' }
      default:
        return { type: 'unconfirmed' }
    }
  } catch (error) {
    if (refusedBeforeWrite(error)) return { type: 'rejected' }
    reportError(error, {
      surface: 'billing',
      errorType: 'retention_offer_outcome_unconfirmed'
    })
    return { type: 'unconfirmed' }
  }
}

export function useRetentionOffer(sessionId: string, workspaceId: string) {
  const phase = shallowRef<RetentionOfferPhase>('offered')

  function dispatch(event: RetentionOfferEvent) {
    phase.value = reduceRetentionOffer(phase.value, event)
  }

  async function accept() {
    const requested = reduceRetentionOffer(phase.value, {
      type: 'acceptRequested'
    })
    if (requested === phase.value) return
    phase.value = requested
    dispatch(await redeem(sessionId, workspaceId))
  }

  return { phase: readonly(phase), accept }
}
