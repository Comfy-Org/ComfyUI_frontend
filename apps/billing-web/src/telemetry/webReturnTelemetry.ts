import type { WebReturnControl } from '@comfyorg/account-core/billing'

import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

/** Each click is its own action, so unlike the entry and session events this is not once per tab. */
export function reportReturnClicked(control: WebReturnControl): void {
  billingWebTelemetry.trackBillingEvent({
    operation: 'web_return',
    stage: 'clicked',
    outcome: 'pending',
    control
  })
}
