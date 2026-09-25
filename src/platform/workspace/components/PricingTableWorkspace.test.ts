import { useCommandStore } from '@/stores/commandStore'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import enMessages from '@/locales/en/main.json'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import PricingTableWorkspace from '@/platform/workspace/components/PricingTableWorkspace.vue'

const state = vi.hoisted(() => ({ plans: [] as Plan[] }))

vi.mock(import('@/composables/billing/useBillingContext'))

function apiPlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  creditsCents: number,
  priceCents = 2000
): Plan {
  return {
    availability: { available: true },
    credits_cents: creditsCents,
    duration,
    max_seats: 5,
    price_cents: priceCents,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: creditsCents
    },
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier
  }
}

// GET /api/billing/plans on testcloud, 2026-09-25. credits_cents is the grant in
// USD cents, not a credit count.
const TESTCLOUD_CATALOG: Plan[] = [
  apiPlan('STANDARD', 'MONTHLY', 1_991, 2_000),
  apiPlan('STANDARD', 'ANNUAL', 23_887, 19_200),
  apiPlan('CREATOR', 'MONTHLY', 3_508, 3_500),
  apiPlan('CREATOR', 'ANNUAL', 42_086, 33_600),
  apiPlan('PRO', 'MONTHLY', 10_000, 10_000),
  apiPlan('PRO', 'ANNUAL', 120_000, 96_000)
]

const CATALOG_CARDS = [
  {
    cycle: 'yearly',
    credits: ['50,400', '88,800', '253,200'],
    videos: ['4,560', '8,040', '22,980'],
    billed: ['$192 Billed yearly', '$336 Billed yearly', '$960 Billed yearly'],
    neverShown: ['23,887', '42,086', '120,000', '50,402', '88,801']
  },
  {
    cycle: 'monthly',
    credits: ['4,200', '7,400', '21,100'],
    videos: ['380', '670', '1,915'],
    billed: ['Billed monthly', 'Billed monthly', 'Billed monthly'],
    neverShown: ['1,991', '3,508', '10,000', '4,201', '7,402']
  }
] as const

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
        SelectButton: cycleToggleStub
      }
    }
  })
}

beforeEach(() => {
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
})

describe('PricingTableWorkspace credit allotment copy', () => {
  beforeEach(() => {
    const billing = useBillingContext()
    state.plans = []
    billing.plans = computed(() => state.plans)
    vi.mocked(billing.getMaxSeats).mockReturnValue(5)
    vi.mocked(useBillingContext).mockReturnValue(billing)
  })

  it.for(CATALOG_CARDS)(
    'shows the $cycle per-member grant, not the catalog cents',
    async ({ cycle, credits, videos, billed, neverShown }) => {
      state.plans = TESTCLOUD_CATALOG
      const user = userEvent.setup()
      renderComponent()

      if (cycle === 'monthly') {
        await user.click(screen.getByTestId('cycle-monthly'))
        await nextTick()
      }

      for (const amount of credits)
        expect(screen.getByText(amount)).toBeTruthy()
      for (const count of videos)
        expect(screen.getByText(`~${count}`)).toBeTruthy()
      expect(
        screen
          .getAllByText(/Billed (yearly|monthly)/)
          .map((el) => el.textContent.trim())
      ).toEqual([...billed])
      for (const amount of neverShown)
        expect(screen.queryByText(amount)).toBeNull()
    }
  )

  it('shows the raw credit grant when the catalog sends one', async () => {
    state.plans = TESTCLOUD_CATALOG.map((plan) =>
      plan.slug === 'standard-annual' ? { ...plan, credits: 60_000 } : plan
    )
    const user = userEvent.setup()
    renderComponent()

    expect(screen.getByText('60,000')).toBeTruthy()
    expect(screen.queryByText('50,400')).toBeNull()

    await user.click(screen.getByTestId('cycle-monthly'))
    await nextTick()

    expect(screen.getByText('4,200')).toBeTruthy()
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
