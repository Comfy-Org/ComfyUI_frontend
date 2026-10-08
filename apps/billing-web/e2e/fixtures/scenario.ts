import type {
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  PreviewSubscribeResponse,
  SavedPaymentMethod,
  TopupQuoteResponse
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
  topupQuote: TopupQuoteResponse
  operations: Record<string, BillingOpStatusResponse>
  /** `billing_web_checkout_ui`, answered only to an authenticated `/features` read, as the real Cloud does. */
  checkoutUi?: string
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
      can_revert_scheduled_change: false,
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

/** The plan the server reports on an operation for the Pro Monthly link, as it does in every status. */
export const PRO_MONTHLY_OP_PLAN = {
  slug: 'pro_monthly',
  duration: 'MONTHLY',
  tier: 'PRO',
  price_cents: 5000,
  currency: 'usd'
} as const satisfies NonNullable<BillingOpStatusResponse['plan']>

export function succeededOperation(id: string): BillingOpStatusResponse {
  const now = new Date().toISOString()
  return { id, status: 'succeeded', started_at: now, completed_at: now }
}

/** Genuinely still pending: no next action, no verdict yet. */
export function pendingOperation(id: string): BillingOpStatusResponse {
  return { id, status: 'pending', started_at: new Date().toISOString() }
}

/** In flight past the bank's challenge: the charge can no longer be called back. */
export function processingOperation(id: string): BillingOpStatusResponse {
  return { ...pendingOperation(id), authentication_state: 'processing' }
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

/** The live failure a misconfigured charge settles as: no retry, support only. */
export function contactSupportOperation(id: string): BillingOpStatusResponse {
  const now = new Date().toISOString()
  return {
    id,
    status: 'failed',
    error_message: 'parameter_missing',
    recovery_action: 'contact_support',
    retryable: false,
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
      transition_type: 'new_subscription',
      is_immediate: true,
      effective_at: new Date().toISOString(),
      renewal_at: inAnHour(),
      currency: 'usd',
      cost_today_cents: 5000,
      cost_next_period_cents: 5000,
      credits_today_cents: 10_000,
      credits_next_period_cents: 10_000,
      credits_today: 21_100,
      credits_next_period: 21_100,
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
    topupQuote: {
      amount_cents: 2500,
      credits: 5275,
      expires_at: '2027-09-30T12:00:00.000Z'
    },
    operations: {}
  }
}

const CREATOR_YEARLY = {
  slug: 'creator_yearly',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 26_880,
  credits_cents: 82_800,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 26_880,
    total_credits_cents: 82_800
  }
} as const

/**
 * The default Creator Monthly subscriber switching to Creator Yearly, quoted
 * as the real Cloud quotes it: the reset to yearly charges in full today,
 * carries no proration instant, and reports the yearly renewal date, the
 * plan's list price, its monthly figures and the pre-discount subtotal.
 */
export function switchToYearly(scenario: CloudScenario): void {
  const monthly = scenario.plans.plans[0]
  scenario.plans = {
    ...scenario.plans,
    plans: [...scenario.plans.plans, CREATOR_YEARLY]
  }
  scenario.preview = {
    ...scenario.preview,
    transition_type: 'duration_change',
    is_immediate: true,
    effective_at: new Date().toISOString(),
    renewal_at: '2027-09-30T00:00:00.000Z',
    cost_today_cents: 26_880,
    amount_due_cents: 26_880,
    subtotal_cents: 26_880,
    cost_next_period_cents: 26_880,
    renewal_amount_cents: 26_880,
    credits_today_cents: 82_800,
    credits_next_period_cents: 82_800,
    credits_today: 174_708,
    credits_next_period: 174_708,
    current_plan: {
      slug: monthly.slug,
      tier: monthly.tier,
      duration: monthly.duration,
      price_cents: monthly.price_cents,
      credits_cents: monthly.credits_cents,
      seat_summary: monthly.seat_summary,
      period_end: '2026-10-30T00:00:00.000Z'
    },
    new_plan: {
      slug: CREATOR_YEARLY.slug,
      tier: CREATOR_YEARLY.tier,
      duration: CREATOR_YEARLY.duration,
      price_cents: CREATOR_YEARLY.price_cents,
      list_price_cents: 33_600,
      monthly_price_cents: 2240,
      monthly_list_price_cents: 2800,
      credits_cents: CREATOR_YEARLY.credits_cents,
      seat_summary: CREATOR_YEARLY.seat_summary
    }
  }
}
