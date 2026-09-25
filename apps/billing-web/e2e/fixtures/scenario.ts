import type {
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  PreviewSubscribeResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'

import { E2E_USER } from './env'

/** What the mocked Cloud answers; a spec mutates it before or during a run. */
export interface CloudScenario {
  status: BillingStatusResponse
  balance: BillingBalanceResponse
  capabilities: BillingCapabilitiesResponse
  plans: BillingPlansResponse
  paymentMethods: SavedPaymentMethod[]
  preview: PreviewSubscribeResponse
  operations: Record<string, BillingOpStatusResponse>
}

const HOUR_MS = 60 * 60 * 1000

export function inAnHour(): string {
  return new Date(Date.now() + HOUR_MS).toISOString()
}

export function capabilitiesWith(
  overrides: Partial<BillingCapabilitiesResponse['capabilities']>
): BillingCapabilitiesResponse {
  return {
    capabilities: {
      can_cancel: true,
      can_change_seats: false,
      can_downgrade_to_personal: false,
      can_invite_members: false,
      can_reactivate: false,
      can_subscribe_self_serve: true,
      can_top_up: true,
      ...overrides
    },
    expires_at: inAnHour(),
    resolved_for: {
      user_id: E2E_USER.uid,
      workspace_id: E2E_USER.workspaceId
    },
    revision: 1,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    }
  }
}

export function succeededOperation(id: string): BillingOpStatusResponse {
  const now = new Date().toISOString()
  return { id, status: 'succeeded', started_at: now, completed_at: now }
}

/** Genuinely still pending: no next action, no verdict yet. */
export function pendingOperation(id: string): BillingOpStatusResponse {
  return { id, status: 'pending', started_at: new Date().toISOString() }
}

export function declinedOperation(id: string): BillingOpStatusResponse {
  const now = new Date().toISOString()
  return {
    id,
    status: 'failed',
    decline_reason: 'card_declined',
    retryable: true,
    started_at: now,
    completed_at: now
  }
}

/** A poll response asking the tab to drive an embedded 3DS challenge. */
export function challengeRequiredOperation(
  id: string,
  clientSecret: string
): BillingOpStatusResponse {
  return {
    id,
    status: 'pending',
    started_at: new Date().toISOString(),
    authentication_state: 'requires_action',
    payment_intent_client_secret: clientSecret
  }
}

/** A Creator subscriber looking at an upgrade to Pro. */
export function defaultScenario(): CloudScenario {
  return {
    status: {
      is_active: true,
      has_funds: true,
      max_seats: 1,
      occupied_seats: 1,
      billing_rail: 'stripe',
      billing_status: 'paid',
      plan_slug: 'creator_monthly',
      subscription_tier: 'CREATOR',
      subscription_duration: 'MONTHLY',
      subscription_status: 'active',
      renewal_date: inAnHour(),
      scheduled_change: null,
      team_credit_stop: null
    },
    balance: { amount_micros: 12_500_000, currency: 'usd' },
    capabilities: capabilitiesWith({}),
    plans: {
      current_plan_slug: 'creator_monthly',
      plans: [
        {
          slug: 'creator_monthly',
          tier: 'CREATOR',
          duration: 'MONTHLY',
          price_cents: 2800,
          credits_cents: 6900,
          max_seats: 1,
          availability: { available: false, reason: 'same_plan' },
          seat_summary: {
            seat_count: 1,
            total_cost_cents: 2800,
            total_credits_cents: 6900
          }
        },
        {
          slug: 'pro_monthly',
          tier: 'PRO',
          duration: 'MONTHLY',
          price_cents: 5000,
          credits_cents: 10_000,
          max_seats: 1,
          availability: { available: true },
          seat_summary: {
            seat_count: 1,
            total_cost_cents: 5000,
            total_credits_cents: 10_000
          }
        }
      ]
    },
    paymentMethods: [
      {
        id: 'pm_e2e',
        type: 'card',
        brand: 'visa',
        last4: '4242',
        is_default: true
      }
    ],
    preview: {
      allowed: true,
      transition_type: 'upgrade',
      is_immediate: true,
      effective_at: new Date().toISOString(),
      renewal_at: inAnHour(),
      currency: 'usd',
      cost_today_cents: 5000,
      cost_next_period_cents: 5000,
      credits_today_cents: 10_000,
      credits_next_period_cents: 10_000,
      amount_due_cents: 5000,
      quote_id: 'quote_e2e',
      quote_version: 1,
      new_plan: {
        slug: 'pro_monthly',
        tier: 'PRO',
        duration: 'MONTHLY',
        price_cents: 5000,
        credits_cents: 10_000,
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 5000,
          total_credits_cents: 10_000
        }
      }
    },
    operations: {}
  }
}
