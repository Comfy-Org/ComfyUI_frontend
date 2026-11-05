import { useTelemetry } from '@comfyorg/telemetry'

import { openBillingUrl } from '@/platform/billing/billingTab'
import { createJourneyId } from '@/platform/billing/utils/checkoutJourney'
import { platformLink } from '@/platform/workspace/utils/platformLink'

/** Opens the platform Plans page for the active workspace in a new tab, as Manage does; `false` when the browser blocked it. */
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
  return true
}
