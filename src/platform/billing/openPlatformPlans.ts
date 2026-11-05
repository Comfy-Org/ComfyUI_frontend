import { useTelemetry } from '@comfyorg/telemetry'

import { refreshBilling } from '@/platform/billing/billingRefresh'
import { openBillingUrl } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { createJourneyId } from '@/platform/billing/utils/checkoutJourney'
import { platformLink } from '@/platform/workspace/utils/platformLink'

let stopReturnRefresh: (() => void) | null = null

/** Opens the platform Plans page for the active workspace in a new tab, as Manage does, and re-reads billing on return; `false` when the browser blocked it. */
export function openPlatformPlans(): boolean {
  const correlationId = createJourneyId()
  if (!openBillingUrl(platformLink('/profile/billing/plans', correlationId))) {
    return false
  }
  useTelemetry()?.trackBillingEvent({
    operation: 'platform_handoff',
    stage: 'opened',
    outcome: 'pending',
    correlation_id: correlationId,
    target: 'plans'
  })
  stopReturnRefresh?.()
  stopReturnRefresh = registerRefreshOnReturn(() =>
    Promise.allSettled([
      refreshBilling('account'),
      useBillingCapabilities().refresh()
    ])
  )
  return true
}
