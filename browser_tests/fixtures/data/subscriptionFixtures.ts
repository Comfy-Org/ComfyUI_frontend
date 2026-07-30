import type { operations } from '@comfyorg/registry-types'

export type SubscriptionStatusResponse =
  operations['GetCloudSubscriptionStatus']['responses']['200']['content']['application/json']

export type BalanceResponse =
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']

export function createSubscriptionStatus(
  overrides: Partial<SubscriptionStatusResponse> = {}
): SubscriptionStatusResponse {
  return {
    is_active: false,
    subscription_id: null,
    subscription_tier: 'FREE',
    subscription_duration: null,
    has_fund: false,
    renewal_date: null,
    end_date: null,
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

export const UNSUBSCRIBED: SubscriptionStatusResponse =
  createSubscriptionStatus({
    is_active: false,
    subscription_id: null,
    subscription_tier: 'FREE',
    end_date: null
  })

export const ZERO_BALANCE: BalanceResponse = createBalance({
  amount_micros: 0,
  effective_balance_micros: 0
})
