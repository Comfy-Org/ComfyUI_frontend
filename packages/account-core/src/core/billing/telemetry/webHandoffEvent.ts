import type { HostedBillingIntent, PaymentIntentSource } from './vocabulary.js'

export type WebHandoffBillingEvent = {
  operation: 'web_handoff'
  stage: 'opened'
  outcome: 'pending'
  intent: HostedBillingIntent
  result: 'opened' | 'blocked'
  payment_intent_source?: PaymentIntentSource
  /** The cloud journey id the entry link carries as `correlation_id`. */
  correlation_id: string
}
