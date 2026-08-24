import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

import SettingsPlansSection from './SettingsPlansSection.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Pinned to the real billing catalog (cloud common/billing/catalog/catalog_test.go:32-36):
// price_cents is the LIST amount, credits_cents the period credit total.
function makePlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  price_cents: number,
  credits_cents: number
): Plan {
  return {
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    tier,
    duration,
    price_cents,
    credits_cents,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: price_cents,
      total_credits_cents: credits_cents
    }
  }
}

const CATALOG: Plan[] = [
  makePlan('STANDARD', 'ANNUAL', 24000, 50400),
  makePlan('STANDARD', 'MONTHLY', 2000, 4200),
  makePlan('CREATOR', 'ANNUAL', 42000, 88800),
  makePlan('CREATOR', 'MONTHLY', 3500, 7400),
  makePlan('PRO', 'ANNUAL', 120000, 253200),
  makePlan('PRO', 'MONTHLY', 10000, 21100)
]

function renderSection(catalogPlans: Plan[] = CATALOG) {
  return render(SettingsPlansSection, {
    props: { catalogPlans },
    global: {
      plugins: [i18n],
      stubs: {
        CreditSlider: {
          template:
            '<button data-testid="team-slider" @click="$emit(\'update:modelValue\', 200)" />',
          emits: ['update:modelValue']
        }
      }
    }
  })
}

describe('SettingsPlansSection personal cards from the API catalog', () => {
  it('renders the API list price and credits for the yearly cycle', () => {
    renderSection()

    // $20/mo = list 24000/100/12, billed yearly total $240 = 24000/100 — the
    // API list price, not the discounted $16/$192 the old constant baked in.
    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()

    expect(screen.getByText('$240 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$420 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$1200 Billed yearly')).toBeTruthy()

    // credits_cents is the annual total, rendered as-is (no ×12).
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()
  })

  it('renders the API price and credits for the monthly cycle', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('switch'))

    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()
    expect(screen.getAllByText('Billed monthly')).toHaveLength(3)

    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('7,400')).toBeTruthy()
    expect(screen.getByText('21,100')).toBeTruthy()
  })

  it('moves the rendered numbers when the catalog values change', () => {
    const mutated = CATALOG.map((p) =>
      p.tier === 'STANDARD' && p.duration === 'ANNUAL'
        ? makePlan('STANDARD', 'ANNUAL', 30000, 60000)
        : p
    )
    renderSection(mutated)

    // $25/mo = 30000/100/12, $300 yearly, 60,000 credits — proof the render is
    // wired to the API row, not to a constant.
    expect(screen.getByText('$25')).toBeTruthy()
    expect(screen.getByText('$300 Billed yearly')).toBeTruthy()
    expect(screen.getByText('60,000')).toBeTruthy()
    expect(screen.queryByText('$240 Billed yearly')).toBeNull()
  })

  it('renders no personal cards when the catalog is empty', () => {
    renderSection([])

    expect(screen.queryByText('Standard')).toBeNull()
    expect(screen.queryByText('Creator')).toBeNull()
    expect(screen.queryByText('Pro')).toBeNull()
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()
  })

  it('disables the choose CTA and shows no discount pill or checkout caption', () => {
    renderSection()

    for (const name of ['Choose Standard', 'Choose Creator', 'Choose Pro']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.queryByText('Save 20%')).toBeNull()
    expect(screen.queryByText(/Checkout happens right here/)).toBeNull()
  })

  it('keeps the active audience selected when its toggle is clicked again', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Personal' }))
    expect(screen.getByText('Choose Standard')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    expect(screen.getByText('Team Plan')).toBeTruthy()
    expect(screen.queryByText('Choose Standard')).toBeNull()
  })
})
