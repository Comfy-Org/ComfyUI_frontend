import type {
  AutoReloadSettings,
  BillingBalanceResponse,
  CreateTopupCheckoutResponse,
  HostedTopupCheckout,
  ListSavedPaymentMethodsResponse,
  TopupQuoteResponse
} from '@comfyorg/ingest-types'

export const AUTO_TOP_UP_CHECKOUT_SESSION_ID = 'cs_test_front3912'

export const AUTO_TOP_UP_CHECKOUT: CreateTopupCheckoutResponse = {
  checkout_url: `https://checkout.stripe.com/c/pay/${AUTO_TOP_UP_CHECKOUT_SESSION_ID}`,
  session_id: AUTO_TOP_UP_CHECKOUT_SESSION_ID
}

export const DEFAULT_VISA: ListSavedPaymentMethodsResponse[number] = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
}

export const FIFTY_DOLLAR_QUOTE: TopupQuoteResponse = {
  amount_cents: 5000,
  credits: 10_550,
  expires_at: '2099-01-01T00:00:00Z'
}

export const AUTO_TOP_UP_OFF: AutoReloadSettings = {
  auto_top_up_conflict: false,
  card_expiry: null,
  configured: false,
  cycle_resets_at: null,
  declined_payment_method: null,
  disabled_reason: null,
  enabled: false,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 6_000_000,
  max_reload_credits: 12_660_000,
  min_reload_credits: 1055,
  monthly_budget_cents: null,
  monthly_budget_is_default: false,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: null,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status: 'off',
  target_credits: null,
  threshold_credits: null
}

export const BALANCE_AFTER_FIFTY_DOLLARS: BillingBalanceResponse = {
  amount_micros: 50_000_000,
  currency: 'usd',
  effective_balance_micros: 50_000_000
}

export const AUTO_TOP_UP_ACTIVATED: HostedTopupCheckout = {
  session_id: AUTO_TOP_UP_CHECKOUT_SESSION_ID,
  amount_cents: 5000,
  payment_amount_cents: 5000,
  state: 'fulfilled',
  auto_top_up_activation: 'on',
  auto_top_up: {
    threshold_credits: 1000,
    target_credits: 11_550,
    monthly_budget_cents: 6_000_000,
    monthly_budget_is_default: true
  }
}
