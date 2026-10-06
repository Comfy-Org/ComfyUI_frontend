import type {
  BillingPlansData,
  BillingTelemetryEvent,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
import { isAnnualDuration } from '@comfyorg/account-ui/billing/checkout'

import { outcomeOfCommandResult } from '@/telemetry/attemptTelemetry'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'
import { checkoutTierOf } from '@/telemetry/subscriptionCheckoutTelemetry'

export type CancelledPlan = Pick<
  BillingPlansData['plans'][number],
  'tier' | 'duration'
>

/**
 * The cancel flow's own stages. A confirmed cancel that issues an operation
 * ends in that operation's `billing.operation.*` events, which the SDK
 * reports, so `failed` here is only a refusal before any operation exists.
 */
export function createCancelFlowTelemetry({
  plan,
  track = billingWebTelemetry.trackBillingEvent
}: {
  readonly plan: () => CancelledPlan | undefined
  readonly track?: (event: BillingTelemetryEvent) => void
}) {
  let open = false

  function describe() {
    const current = plan()
    return {
      operation: 'cancel',
      billing_client: 'sdk',
      current_tier: current && checkoutTierOf(current.tier),
      cycle:
        current && (isAnnualDuration(current.duration) ? 'yearly' : 'monthly')
    } as const
  }

  return {
    intent() {
      if (open) return
      open = true
      track({ ...describe(), stage: 'intent', outcome: 'pending' })
    },
    abandoned() {
      if (!open) return
      open = false
      track({ ...describe(), stage: 'abandoned', outcome: 'pending' })
    },
    async confirm(
      command: () => Promise<SubscriptionCommandResult>
    ): Promise<SubscriptionCommandResult> {
      open = false
      const result = await command()
      const outcome = outcomeOfCommandResult(result)
      if (result.status === 'error' && outcome.kind === 'failed')
        track({
          ...describe(),
          stage: 'failed',
          outcome: 'failure',
          ...outcome.failure
        })
      return result
    }
  }
}
