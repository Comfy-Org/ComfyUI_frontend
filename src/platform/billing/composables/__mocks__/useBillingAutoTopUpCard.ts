import { onTestFinished, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import type { AutoReloadSettings } from '@comfyorg/billing-core'
import type { useBillingAutoTopUpCard as realUseBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'

type AutoTopUpCard = ReturnType<typeof realUseBillingAutoTopUpCard>
type AutoTopUpCardState = AutoTopUpCard['state']['value']

const offSettings: AutoReloadSettings = {
  card_expiry: null,
  configured: false,
  cycle_resets_at: null,
  declined_payment_method: null,
  disabled_reason: null,
  enabled: false,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 100000,
  max_reload_credits: 100000,
  min_reload_credits: 1000,
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

export function loadedAutoTopUp(
  status: AutoReloadSettings['status']
): AutoTopUpCardState {
  return { kind: 'loaded', settings: { ...offSettings, status } }
}

export const autoTopUpCardState = shallowRef<AutoTopUpCardState>({
  kind: 'loading'
})

const card: AutoTopUpCard = {
  state: computed(() => autoTopUpCardState.value),
  isReady: computed(() => autoTopUpCardState.value.kind !== 'loading'),
  ensureRead: vi.fn(),
  retry: vi.fn(async () => undefined)
}

export const useBillingAutoTopUpCard = vi.fn(() => {
  onTestFinished(() => {
    autoTopUpCardState.value = { kind: 'loading' }
  })
  return card
})
