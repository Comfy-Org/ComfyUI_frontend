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

export const FREE_TIER_ACTIVE: SubscriptionStatusResponse =
  createSubscriptionStatus({
    is_active: true,
    subscription_id: 'sub_free_001',
    subscription_tier: 'FREE',
    renewal_date: '2099-12-31T00:00:00.000Z'
  })

export const CREATOR_ACTIVE: SubscriptionStatusResponse =
  createSubscriptionStatus({
    is_active: true,
    subscription_id: 'sub_creator_001',
    subscription_tier: 'CREATOR',
    subscription_duration: 'MONTHLY',
    renewal_date: '2099-12-31T00:00:00.000Z'
  })

export const PRO_ACTIVE: SubscriptionStatusResponse = createSubscriptionStatus({
  is_active: true,
  subscription_id: 'sub_pro_001',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-12-31T00:00:00.000Z'
})

export const CANCELLED_SUBSCRIPTION: SubscriptionStatusResponse =
  createSubscriptionStatus({
    is_active: true,
    subscription_id: 'sub_cancelled_001',
    subscription_tier: 'CREATOR',
    subscription_duration: 'MONTHLY',
    end_date: '2099-12-31T00:00:00.000Z'
  })

export const ZERO_BALANCE: BalanceResponse = createBalance({
  amount_micros: 0,
  effective_balance_micros: 0
})

export const FUNDED_BALANCE: BalanceResponse = createBalance({
  amount_micros: 2_500_000,
  prepaid_balance_micros: 1_000_000,
  cloud_credit_balance_micros: 1_500_000,
  effective_balance_micros: 2_500_000
})
