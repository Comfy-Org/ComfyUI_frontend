import type { AutoTopUpCardStatus } from '@comfyorg/account-core/billing'
import { watch } from 'vue'

import { useTelemetry } from '@/platform/telemetry'

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
