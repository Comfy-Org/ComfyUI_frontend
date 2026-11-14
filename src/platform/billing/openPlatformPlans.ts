import { useTelemetry } from '@comfyorg/telemetry'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'
import { effectScope } from 'vue'

import { refreshBilling } from '@/platform/billing/billingRefresh'
import { openBillingUrl } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { createJourneyId } from '@/platform/billing/utils/checkoutJourney'
import { platformLink } from '@/platform/workspace/utils/platformLink'

let stopReturnRefresh: (() => void) | null = null

async function refreshAfterPlans(): Promise<void> {
  const scope = effectScope(true)
  const capabilities = scope.run(useBillingCapabilities)
  await Promise.allSettled([refreshBilling('account'), capabilities?.refresh()])
  scope.stop()
}

function trackHandoff(correlationId: string): void {
  useTelemetry()?.trackBillingEvent({
    operation: 'platform_handoff',
    stage: 'opened',
    outcome: 'pending',
    correlation_id: correlationId,
    target: 'plans'
  })
}

function refreshOnReturn(): void {
  stopReturnRefresh?.()
  stopReturnRefresh = registerRefreshOnReturn(refreshAfterPlans)
}

/** The platform Plans page for the active workspace, for a link the user follows, and what to run when they follow it; `source` is the paywall they saw. */
export function platformPlansLink(source?: PaymentIntentSource): {
  href: string
  onFollow: () => void
} {
  const correlationId = createJourneyId()
  return {
    href: platformLink('/profile/billing/plans', correlationId, source),
    onFollow: () => {
      trackHandoff(correlationId)
      refreshOnReturn()
    }
  }
}

/** Opens the platform Plans page for the active workspace in a new tab, as Manage does, and re-reads billing on return; `false` when the browser blocked it. */
export function openPlatformPlans(source?: PaymentIntentSource): boolean {
  const { href, onFollow } = platformPlansLink(source)
  if (!openBillingUrl(href)) return false
  onFollow()
  return true
}

/** Leaves the app for the platform Plans page of the active workspace in this tab, and re-reads billing if a back navigation restores this page. */
export function navigateToPlatformPlans(source?: PaymentIntentSource): void {
  const correlationId = createJourneyId()
  trackHandoff(correlationId)
  refreshOnReturn()
  window.location.assign(
    platformLink('/profile/billing/plans', correlationId, source)
  )
}
