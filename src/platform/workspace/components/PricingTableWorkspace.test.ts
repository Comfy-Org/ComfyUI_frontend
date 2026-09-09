import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import enMessages from '@/locales/en/main.json'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import PricingTableWorkspace from '@/platform/workspace/components/PricingTableWorkspace.vue'

const state = vi.hoisted(() => ({ plans: [] as Plan[] }))

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    plans: computed(() => state.plans),
    currentPlanSlug: computed(() => null),
    fetchPlans: vi.fn(),
    subscription: computed(() => null),
    getMaxSeats: () => 5
  })
}))

function apiPlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  credits: number
): Plan {
  return {
    availability: { available: true },
    credits_cents: credits,
    duration,
    max_seats: 5,
    price_cents: 2000,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 2000,
      total_credits_cents: credits
    },
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier
  }
}

vi.mock<unknown>(import('@/stores/commandStore'), () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const cycleToggleStub = {
  props: ['options'],
  emits: ['update:modelValue'],
  template: `<div><button
      v-for="option in options"
      :key="option.value"
      :data-testid="'cycle-' + option.value"
      @click="$emit('update:modelValue', option.value)"
    >{{ option.label }}</button></div>`
}

function renderComponent() {
  return render(PricingTableWorkspace, {
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
        SelectButton: cycleToggleStub,
        Popover: { template: '<div><slot /></div>' }
      }
    }
  })
}

describe('PricingTableWorkspace credit allotment copy', () => {
  beforeEach(() => {
    state.plans = []
  })

  it('shows the catalog grant in preference to twelve static months', () => {
    state.plans = [apiPlan('STANDARD', 'ANNUAL', 60_000)]

    renderComponent()

    expect(screen.getByText('60,000')).toBeTruthy()
    expect(screen.queryByText('50,400')).toBeNull()
    expect(screen.getByText('~5,429')).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
  })

  it('states the whole-year per-member allotment on the yearly cycle', () => {
    renderComponent()

    expect(screen.getAllByText('Yearly credits / member')).toHaveLength(3)
    expect(screen.queryAllByText('Monthly credits / member')).toHaveLength(0)
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('~4,560')).toBeTruthy()
  })

  it('states the monthly per-member allotment on the monthly cycle', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('cycle-monthly'))
    await nextTick()

    expect(screen.getAllByText('Monthly credits / member')).toHaveLength(3)
    expect(screen.queryAllByText('Yearly credits / member')).toHaveLength(0)
    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('~380')).toBeTruthy()
  })
})
