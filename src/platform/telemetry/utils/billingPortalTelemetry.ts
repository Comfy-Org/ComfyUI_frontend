import type {
  BillingClient,
  BillingPortalTarget,
  BillingTelemetryFailure
} from '@comfyorg/account-core/billing'

import type { TelemetryDispatcher } from '@/platform/telemetry/types'
import { describeBillingFailure } from '@/platform/telemetry/utils/billingFailureCategory'
import { registerRefreshOnReturn } from '@/platform/workspace/billing/refreshOnReturn'

const PORTAL_TAB_BLOCKED: BillingTelemetryFailure = {
  failure_category: 'redirect',
  error_code: 'payment_popup_blocked'
}

/** Only the latest portal trip waits for a return, so one return is reported once. */
let stopWatchingForReturn: (() => void) | undefined

/** Reports one trip to the provider's portal, which opens in its own tab. */
export function createBillingPortalReporter(
  telemetry: TelemetryDispatcher | null,
  target: BillingPortalTarget
) {
  const client = (billingClient?: BillingClient) =>
    billingClient ? { billing_client: billingClient } : {}

  function failed(
    failure: BillingTelemetryFailure,
    billingClient?: BillingClient
  ) {
    telemetry?.trackBillingEvent({
      operation: 'portal',
      stage: 'failed',
      outcome: 'failure',
      target,
      ...client(billingClient),
      ...failure
    })
  }

  return {
    /** Also reports the first return to this tab after the portal opened. */
    opened(billingClient?: BillingClient) {
      telemetry?.trackBillingEvent({
        operation: 'portal',
        stage: 'opened',
        outcome: 'pending',
        target,
        ...client(billingClient)
      })
      stopWatchingForReturn?.()
      const stopWatching = registerRefreshOnReturn(async () => {
        stopWatching()
        telemetry?.trackBillingEvent({
          operation: 'portal',
          stage: 'returned',
          outcome: 'pending',
          target,
          ...client(billingClient)
        })
      })
      stopWatchingForReturn = stopWatching
    },
    blocked(billingClient?: BillingClient) {
      failed(PORTAL_TAB_BLOCKED, billingClient)
    },
    failed(error: unknown, billingClient?: BillingClient) {
      failed(describeBillingFailure(error), billingClient)
    }
  }
}
