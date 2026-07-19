import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CancelSubscriptionResponse,
  CreateTopupResponse,
  Plan,
  PreviewSubscribeResponse,
  ResubscribeResponse,
  SubscribeResponse,
  TeamCreditStops
} from '@comfyorg/ingest-types'

import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

// `/api/features` is the remote-config source: production builds resolve the
// workspaces flag from it (the `ff:` localStorage override is dev-only).
export const WORKSPACE_FEATURE_FLAG: RemoteConfig = {
  team_workspaces_enabled: true,
  billing_control_enabled: true
}

export const TEAM_WORKSPACE: WorkspaceWithRole = {
  id: 'ws-team',
  name: 'Team Comfy',
  type: 'team',
  created_at: '2025-01-01T00:00:00Z',
  joined_at: '2025-01-02T00:00:00Z',
  role: 'owner',
  subscription_tier: 'PRO'
}

export const CREATOR: Member = {
  id: 'u-liz',
  name: 'Liz',
  email: 'liz@test.comfy.org',
  joined_at: '2025-01-01T00:00:00Z',
  role: 'owner',
  is_original_owner: true
}

// Identity must match the CloudAuthHelper mock user so this row counts as
// "(You)".
export const VIEWER: Member = {
  id: 'u-me',
  name: 'E2E Test User',
  email: 'e2e@test.comfy.org',
  joined_at: '2025-01-02T00:00:00Z',
  role: 'owner',
  is_original_owner: false
}

export const MEMBER_JANE: Member = {
  id: 'u-jane',
  name: 'Jane',
  email: 'jane@test.comfy.org',
  joined_at: '2025-01-03T00:00:00Z',
  role: 'member',
  is_original_owner: false
}

export const MEMBER_JOHN: Member = {
  id: 'u-john',
  name: 'John',
  email: 'john@test.comfy.org',
  joined_at: '2025-01-04T00:00:00Z',
  role: 'member',
  is_original_owner: false
}

export const DEFAULT_TEAM_MEMBERS: Member[] = [
  CREATOR,
  VIEWER,
  MEMBER_JANE,
  MEMBER_JOHN
]

export const BILLING_RENEWAL_DATE = '2099-02-20T00:00:00Z'
export const BILLING_OPERATION_STARTED_AT = '2099-01-20T00:00:00Z'
export const BILLING_OPERATION_COMPLETED_AT = '2099-01-20T00:00:01Z'

const TEAM_PLAN_SLUG = 'team-pro-monthly'

function billingPlan(
  slug: string,
  tier: Plan['tier'],
  duration: Plan['duration'],
  priceCents: number,
  creditsCents: number,
  maxSeats: number,
  seatCount: number
): Plan {
  return {
    slug,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: creditsCents,
    max_seats: maxSeats,
    availability: { available: true },
    seat_summary: {
      seat_count: seatCount,
      total_cost_cents: priceCents * seatCount,
      total_credits_cents: creditsCents * seatCount
    }
  }
}

export const TEAM_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  plan_slug: TEAM_PLAN_SLUG,
  billing_status: 'paid',
  has_funds: true,
  renewal_date: BILLING_RENEWAL_DATE,
  team_credit_stop: null
}

export const TEAM_PRO_PLAN: Plan = {
  slug: TEAM_PLAN_SLUG,
  tier: 'PRO',
  duration: 'MONTHLY',
  price_cents: 10_000,
  credits_cents: 21_100,
  max_seats: 30,
  availability: { available: true },
  seat_summary: {
    seat_count: 4,
    total_cost_cents: 40_000,
    total_credits_cents: 0
  }
}

export const DEFAULT_BILLING_STATUS: BillingStatusResponse = {
  is_active: false,
  subscription_tier: 'FREE',
  billing_status: 'inactive',
  has_funds: true,
  team_credit_stop: null
}

export const PERSONAL_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: BILLING_RENEWAL_DATE,
  team_credit_stop: null
}

export const TEAM_CREDIT_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'TEAM',
  subscription_duration: 'ANNUAL',
  plan_slug: 'team_per_credit_annual',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: BILLING_RENEWAL_DATE,
  team_credit_stop: {
    id: 'team_700',
    credits_monthly: 147_700,
    stop_usd: 700
  }
}

export const CANCELLED_TEAM_BILLING_STATUS: BillingStatusResponse = {
  ...TEAM_CREDIT_BILLING_STATUS,
  subscription_status: 'canceled',
  cancel_at: BILLING_RENEWAL_DATE
}

export const DEFAULT_BILLING_BALANCE: BillingBalanceResponse = {
  amount_micros: 2_500,
  currency: 'usd',
  effective_balance_micros: 2_500,
  cloud_credit_balance_micros: 2_000,
  prepaid_balance_micros: 500
}

export const PERSONAL_STANDARD_ANNUAL_PLAN = billingPlan(
  'standard-annual',
  'STANDARD',
  'ANNUAL',
  19_200,
  4_200,
  1,
  1
)

const PERSONAL_PLANS: Plan[] = [
  billingPlan('standard-monthly', 'STANDARD', 'MONTHLY', 2_000, 4_200, 1, 1),
  PERSONAL_STANDARD_ANNUAL_PLAN,
  billingPlan('creator-monthly', 'CREATOR', 'MONTHLY', 3_500, 7_400, 5, 1),
  billingPlan('creator-annual', 'CREATOR', 'ANNUAL', 33_600, 7_400, 5, 1),
  billingPlan('pro-monthly', 'PRO', 'MONTHLY', 10_000, 21_100, 20, 1),
  billingPlan('pro-annual', 'PRO', 'ANNUAL', 96_000, 21_100, 20, 1)
]

export const DEFAULT_TEAM_CREDIT_STOPS: TeamCreditStops = {
  default_stop_index: 0,
  stops: [
    {
      id: 'team_700',
      credits: 147_700,
      monthly: { list_price_cents: 70_000, price_cents: 66_500 },
      yearly: { list_price_cents: 70_000, price_cents: 63_000 }
    }
  ]
}

const TEAM_PLANS: Plan[] = [
  billingPlan('team_per_credit_monthly', 'TEAM', 'MONTHLY', 66_500, 0, 30, 1),
  billingPlan('team_per_credit_annual', 'TEAM', 'ANNUAL', 756_000, 0, 30, 1)
]

export const DEFAULT_BILLING_PLANS: BillingPlansResponse = {
  plans: [...PERSONAL_PLANS, ...TEAM_PLANS],
  team_credit_stops: DEFAULT_TEAM_CREDIT_STOPS
}

export const DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: BILLING_OPERATION_COMPLETED_AT,
  is_immediate: true,
  cost_today_cents: PERSONAL_STANDARD_ANNUAL_PLAN.price_cents,
  cost_next_period_cents: PERSONAL_STANDARD_ANNUAL_PLAN.price_cents,
  credits_today_cents: PERSONAL_STANDARD_ANNUAL_PLAN.credits_cents,
  credits_next_period_cents: PERSONAL_STANDARD_ANNUAL_PLAN.credits_cents,
  new_plan: PERSONAL_STANDARD_ANNUAL_PLAN
}

export const SCHEDULED_PREVIEW_SUBSCRIBE_RESPONSE: PreviewSubscribeResponse = {
  ...DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
  transition_type: 'downgrade',
  effective_at: BILLING_RENEWAL_DATE,
  is_immediate: false,
  cost_today_cents: 0,
  credits_today_cents: 0
}

export const DEFAULT_SUBSCRIBE_RESPONSE: SubscribeResponse = {
  billing_op_id: 'billing-op-subscribe',
  status: 'subscribed',
  effective_at: BILLING_OPERATION_COMPLETED_AT
}

export const PENDING_SUBSCRIBE_RESPONSE: SubscribeResponse = {
  ...DEFAULT_SUBSCRIBE_RESPONSE,
  status: 'pending_payment'
}

export const DEFAULT_TOPUP_RESPONSE: CreateTopupResponse = {
  billing_op_id: 'billing-op-topup',
  topup_id: 'topup-1',
  status: 'completed',
  amount_cents: 2_500
}

export const PENDING_TOPUP_RESPONSE: CreateTopupResponse = {
  ...DEFAULT_TOPUP_RESPONSE,
  status: 'pending'
}

export const FAILED_TOPUP_RESPONSE: CreateTopupResponse = {
  ...DEFAULT_TOPUP_RESPONSE,
  status: 'failed'
}

export const DEFAULT_CANCEL_RESPONSE: CancelSubscriptionResponse = {
  billing_op_id: 'billing-op-cancel',
  cancel_at: BILLING_RENEWAL_DATE
}

export const DEFAULT_RESUBSCRIBE_RESPONSE: ResubscribeResponse = {
  billing_op_id: 'billing-op-resubscribe',
  status: 'active'
}

export const PENDING_RESUBSCRIBE_RESPONSE: ResubscribeResponse = {
  ...DEFAULT_RESUBSCRIBE_RESPONSE,
  status: 'pending'
}

export const PENDING_BILLING_OPERATION: BillingOpStatusResponse = {
  id: 'billing-op',
  status: 'pending',
  started_at: BILLING_OPERATION_STARTED_AT
}

export const SUCCEEDED_BILLING_OPERATION: BillingOpStatusResponse = {
  ...PENDING_BILLING_OPERATION,
  status: 'succeeded',
  completed_at: BILLING_OPERATION_COMPLETED_AT
}

export const FAILED_BILLING_OPERATION: BillingOpStatusResponse = {
  ...PENDING_BILLING_OPERATION,
  status: 'failed',
  error_message: 'Mock billing operation failed',
  completed_at: BILLING_OPERATION_COMPLETED_AT
}
