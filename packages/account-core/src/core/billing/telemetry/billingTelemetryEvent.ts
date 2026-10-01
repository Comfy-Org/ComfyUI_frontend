import type { CancelBillingEvent } from './cancelEvent.js'
import type { CapabilityReadBillingEvent } from './capabilityReadEvent.js'
import type { DowngradeToPersonalBillingEvent } from './downgradeToPersonalEvent.js'
import type { EntryBillingEvent } from './entryEvent.js'
import type { BillingOperationBillingEvent } from './operationEvent.js'
import type { ResubscribeBillingEvent } from './resubscribeEvent.js'
import type { SubscriptionCheckoutBillingEvent } from './subscriptionCheckoutEvent.js'
import type { TopupBillingEvent } from './topupEvent.js'
import type { WebHandoffBillingEvent } from './webHandoffEvent.js'

export type BillingSurface = 'cloud_app' | 'billing_web'

export type BillingClient = 'sdk' | 'legacy'

export type BillingTelemetryEvent = {
  /** The rail of the code that emitted the event; absent when the emitter does not know it. */
  billing_client?: BillingClient
} & (
  | CapabilityReadBillingEvent
  | SubscriptionCheckoutBillingEvent
  | BillingOperationBillingEvent
  | ResubscribeBillingEvent
  | TopupBillingEvent
  | DowngradeToPersonalBillingEvent
  | WebHandoffBillingEvent
  | EntryBillingEvent
  | CancelBillingEvent
)

type BillingTelemetryEventNameFor<T extends BillingTelemetryEvent> =
  T extends BillingTelemetryEvent
    ? `billing.${T['operation']}.${T['stage']}`
    : never

export type BillingTelemetryEventName =
  BillingTelemetryEventNameFor<BillingTelemetryEvent>

export function getBillingTelemetryEventName(
  event: BillingTelemetryEvent
): BillingTelemetryEventName {
  return `billing.${event.operation}.${event.stage}` as BillingTelemetryEventName
}
