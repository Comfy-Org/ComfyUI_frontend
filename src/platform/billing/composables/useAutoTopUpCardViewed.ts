import type { AutoTopUpCardStatus } from '@comfyorg/account-core/billing'
import { useTelemetry } from '@comfyorg/telemetry'
import { watch } from 'vue'

export function useAutoTopUpCardViewed(
  renderedStatus: () => AutoTopUpCardStatus | undefined
) {
  let reportedStatus: AutoTopUpCardStatus | undefined

  watch(
    renderedStatus,
    (status) => {
      if (!status || status === reportedStatus) return
      reportedStatus = status
      useTelemetry()?.trackBillingEvent({
        operation: 'auto_top_up_card',
        stage: 'viewed',
        outcome: 'pending',
        status
      })
    },
    { immediate: true }
  )
}
