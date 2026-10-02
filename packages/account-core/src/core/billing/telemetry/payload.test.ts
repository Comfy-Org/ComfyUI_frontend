import { describe, expect, it } from 'vitest'

import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'
import {
  BILLING_PAYLOAD_FIELD_HANDLING,
  getBillingWebTelemetryEventPayload,
  getCloudAppBillingTelemetryEventPayload
} from './payload.js'
import type { BillingPayloadFieldHandling } from './payload.js'

const SURFACES = [
  {
    name: 'cloud app',
    build: getCloudAppBillingTelemetryEventPayload,
    surface: 'cloud_app',
    otherSurface: 'billing_web'
  },
  {
    name: 'billing web',
    build: getBillingWebTelemetryEventPayload,
    surface: 'billing_web',
    otherSurface: 'cloud_app'
  }
] as const

describe('the billing event payload for a surface', () => {
  it.for(SURFACES)(
    'claims the $name surface over any surface the event carries',
    ({ build, surface, otherSurface }) => {
      const event = {
        operation: 'resubscribe',
        stage: 'started',
        outcome: 'pending',
        source: 'settings_billing_panel',
        billing_surface: otherSurface
      } satisfies BillingTelemetryEvent & { billing_surface: string }

      expect(build(event)).toStrictEqual({
        operation: 'resubscribe',
        stage: 'started',
        outcome: 'pending',
        source: 'settings_billing_panel',
        billing_surface: surface
      })
    }
  )

  it.for(SURFACES)(
    'keeps the allowlisted fields of a $name event and nothing else',
    ({ build, surface }) => {
      const event = {
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'topup',
        billing_op_id: 'op-declined',
        failure_category: 'provider_decline',
        decline_reason: 'card_declined',
        duration_ms: 2300,
        email: 'ada@example.com',
        user_id: 'user-1',
        client_secret: 'pi_1_secret_2',
        return_url: 'https://billing.comfy.org/v1/result?promo=SPRING',
        promo_code: 'SPRING'
      } satisfies BillingTelemetryEvent & Record<string, string | number>

      expect(build(event)).toStrictEqual({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        operation_type: 'topup',
        billing_op_id: 'op-declined',
        failure_category: 'provider_decline',
        decline_reason: 'card_declined',
        duration_ms: 2300,
        billing_surface: surface
      })
    }
  )
})

describe('the billing web checkout failure payload', () => {
  it('keeps the checkout it happened in, the decline and the error code, and no raw detail', () => {
    const event = {
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      billing_client: 'sdk',
      checkout_ui: 'full_page',
      tier: 'creator',
      cycle: 'monthly',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_now_button',
      failure_category: 'provider_decline',
      decline_reason: 'insufficient_funds',
      error_code: 'quote_stale',
      billing_op_id: 'op_1',
      duration_ms: 1800,
      server_message: 'Stripe: card_declined for cus_123'
    } satisfies BillingTelemetryEvent & Record<string, string | number>

    expect(getBillingWebTelemetryEventPayload(event)).toStrictEqual({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      billing_client: 'sdk',
      checkout_ui: 'full_page',
      tier: 'creator',
      cycle: 'monthly',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_now_button',
      failure_category: 'provider_decline',
      decline_reason: 'insufficient_funds',
      error_code: 'quote_stale',
      billing_op_id: 'op_1',
      duration_ms: 1800,
      billing_surface: 'billing_web'
    })
  })
})

describe('the billing payload allowlist', () => {
  it('handles every field a billing event can carry', () => {
    const handled: BillingPayloadFieldHandling = BILLING_PAYLOAD_FIELD_HANDLING

    expect(handled).toHaveProperty('billing_op_id', 'optional')
  })

  it('stops compiling when an event carries a field the table does not handle', () => {
    type EventWithUnlistedField =
      | BillingTelemetryEvent
      | {
          operation: 'capability_read'
          stage: 'succeeded'
          outcome: 'success'
          unlisted_field: string
        }

    // @ts-expect-error unlisted_field has no handling in the table
    const refused: BillingPayloadFieldHandling<EventWithUnlistedField> =
      BILLING_PAYLOAD_FIELD_HANDLING

    expect(refused).not.toHaveProperty('unlisted_field')
  })
})
