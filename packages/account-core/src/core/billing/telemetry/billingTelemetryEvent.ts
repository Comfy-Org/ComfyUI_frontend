import type { AutoTopUpCardBillingEvent } from './autoTopUpCardEvent'
import type { CancelBillingEvent } from './cancelEvent'
import type { CapabilityReadBillingEvent } from './capabilityReadEvent'
import type { CheckoutChallengeBillingEvent } from './checkoutChallengeEvent'
import type { CheckoutRedirectBillingEvent } from './checkoutRedirectEvent'
import type { DowngradeToPersonalBillingEvent } from './downgradeToPersonalEvent'
import type { EntryBillingEvent } from './entryEvent'
import type { BillingOperationBillingEvent } from './operationEvent'
import type { PlatformHandoffBillingEvent } from './platformHandoffEvent'
import type { PortalBillingEvent } from './portalEvent'
import type { ResubscribeBillingEvent } from './resubscribeEvent'
import type { SubscriptionCheckoutBillingEvent } from './subscriptionCheckoutEvent'
import type { TopupBillingEvent } from './topupEvent'
import type { WebEntryBillingEvent } from './webEntryEvent'
import type { WebHandoffBillingEvent } from './webHandoffEvent'
import type { WebReturnBillingEvent } from './webReturnEvent'
import type { WebSessionBillingEvent } from './webSessionEvent'

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
  | WebEntryBillingEvent
  | WebHandoffBillingEvent
  | WebReturnBillingEvent
  | WebSessionBillingEvent
  | EntryBillingEvent
  | CancelBillingEvent
  | PortalBillingEvent
  | AutoTopUpCardBillingEvent
  | PlatformHandoffBillingEvent
  | CheckoutChallengeBillingEvent
  | CheckoutRedirectBillingEvent
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
