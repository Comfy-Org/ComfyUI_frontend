import type { operations } from '@comfyorg/registry-types'

import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'

export type BalanceResponse =
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']

export function createSubscriptionStatus(
  overrides: Partial<BillingStatusResponse> = {}
): BillingStatusResponse {
  return {
    is_active: false,
    subscription_tier: 'FREE',
    has_funds: false,
    billing_rail: 'legacy_stripe',
    ...overrides
  }
}

export function createBalance(
  overrides: Partial<BalanceResponse> = {}
): BalanceResponse {
  return {
    amount_micros: 0,
    prepaid_balance_micros: 0,
    cloud_credit_balance_micros: 0,
    pending_charges_micros: 0,
    effective_balance_micros: 0,
    currency: 'USD',
    ...overrides
  }
}

export const UNSUBSCRIBED: BillingStatusResponse = createSubscriptionStatus({
  is_active: false,
  subscription_tier: 'FREE'
})

export const ZERO_BALANCE: BalanceResponse = createBalance({
  amount_micros: 0,
  effective_balance_micros: 0
})
