import type { AutoTopUpCardState } from '@comfyorg/account-core/billing'

type AutoReloadSettings = Extract<
  AutoTopUpCardState,
  { kind: 'loaded' }
>['settings']

export const configuredSettings: AutoReloadSettings = {
  auto_top_up_conflict: false,
  card_expiry: null,
  configured: true,
  cycle_resets_at: '2026-11-28T00:00:00Z',
  declined_payment_method: null,
  disabled_reason: null,
  enabled: true,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 100000,
  max_reload_credits: 100000,
  min_reload_credits: 1000,
  monthly_budget_cents: 20000,
  monthly_budget_is_default: false,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: 2500,
  reload_credits: 5275,
  spent_this_cycle_cents: 5000,
  status: 'on',
  target_credits: 6275,
  threshold_credits: 1000
}

export const notConfiguredSettings: AutoReloadSettings = {
  ...configuredSettings,
  configured: false,
  enabled: false,
  monthly_budget_cents: null,
  reload_amount_cents: null,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status: 'off',
  target_credits: null,
  threshold_credits: null
}

export function loaded(
  overrides: Partial<AutoReloadSettings> = {}
): AutoTopUpCardState {
  return { kind: 'loaded', settings: { ...configuredSettings, ...overrides } }
}
