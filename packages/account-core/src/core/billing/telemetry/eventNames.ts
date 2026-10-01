import type { BillingTelemetryEventName } from './billingTelemetryEvent.js'

export const BILLING_TELEMETRY_EVENTS = {
  BILLING_SUBSCRIPTION_CHECKOUT_RECEIVED:
    'billing.subscription_checkout.checkout_received',
  BILLING_TOPUP_CHECKOUT_RECEIVED: 'billing.topup.checkout_received',
  BILLING_SUBSCRIPTION_CHECKOUT_REQUEST_SENT:
    'billing.subscription_checkout.request_sent',
  BILLING_TOPUP_REQUEST_SENT: 'billing.topup.request_sent',
  BILLING_SUBSCRIPTION_CHECKOUT_INTENT: 'billing.subscription_checkout.intent',
  BILLING_TOPUP_INTENT: 'billing.topup.intent',
  BILLING_SUBSCRIPTION_CHECKOUT_STARTED:
    'billing.subscription_checkout.started',
  BILLING_SUBSCRIPTION_CHECKOUT_SUCCEEDED:
    'billing.subscription_checkout.succeeded',
  BILLING_SUBSCRIPTION_CHECKOUT_FAILED: 'billing.subscription_checkout.failed',
  BILLING_SUBSCRIPTION_CHECKOUT_TIMEOUT:
    'billing.subscription_checkout.timeout',
  BILLING_OPERATION_STARTED: 'billing.operation.started',
  BILLING_CAPABILITY_READ_SUCCEEDED: 'billing.capability_read.succeeded',
  BILLING_CAPABILITY_READ_FAILED: 'billing.capability_read.failed',
  BILLING_OPERATION_SUCCEEDED: 'billing.operation.succeeded',
  BILLING_OPERATION_FAILED: 'billing.operation.failed',
  BILLING_OPERATION_TIMEOUT: 'billing.operation.timeout',
  BILLING_RESUBSCRIBE_STARTED: 'billing.resubscribe.started',
  BILLING_RESUBSCRIBE_SUCCEEDED: 'billing.resubscribe.succeeded',
  BILLING_RESUBSCRIBE_FAILED: 'billing.resubscribe.failed',
  BILLING_TOPUP_STARTED: 'billing.topup.started',
  BILLING_TOPUP_SUCCEEDED: 'billing.topup.succeeded',
  BILLING_TOPUP_FAILED: 'billing.topup.failed',
  BILLING_DOWNGRADE_TO_PERSONAL_STARTED:
    'billing.downgrade_to_personal.started',
  BILLING_DOWNGRADE_TO_PERSONAL_SUCCEEDED:
    'billing.downgrade_to_personal.succeeded',
  BILLING_DOWNGRADE_TO_PERSONAL_FAILED: 'billing.downgrade_to_personal.failed',
  BILLING_WEB_HANDOFF_OPENED: 'billing.web_handoff.opened',
  BILLING_ENTRY_PAYWALL_SHOWN: 'billing.entry.paywall_shown',
  BILLING_ENTRY_ADD_CREDITS_CLICKED: 'billing.entry.add_credits_clicked'
} as const satisfies Record<string, BillingTelemetryEventName>
