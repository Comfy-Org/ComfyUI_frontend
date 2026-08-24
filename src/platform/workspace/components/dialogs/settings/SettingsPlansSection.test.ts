import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import type {
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import SettingsPlansSection from './SettingsPlansSection.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

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

// Distinct from any frontend constant so a render that ignored the prop would
// show different numbers (147,700 / $700 were the old TEAM_PLAN_CREDIT_STOPS).
const TEAM_STOPS: TeamCreditStops = {
  default_stop_index: 1,
  stops: [
    {
      id: 'team_300',
      credits: 63_300,
      monthly: { list_price_cents: 30_000, price_cents: 30_000 },
      yearly: { list_price_cents: 30_000, price_cents: 27_000 }
    },
    {
      id: 'team_900',
      credits: 189_900,
      monthly: { list_price_cents: 90_000, price_cents: 85_500 },
      yearly: { list_price_cents: 90_000, price_cents: 81_000 }
    }
  ]
}

function renderSection(
  props: {
    catalogPlans?: Plan[]
    teamCreditStops?: TeamCreditStops | null
    isLoading?: boolean
  } = {}
) {
  return render(SettingsPlansSection, {
    props: { catalogPlans: CATALOG, teamCreditStops: TEAM_STOPS, ...props },
    global: { plugins: [i18n] }
  })
}

describe('SettingsPlansSection — API is the source of truth', () => {
  it('renders personal prices and credits from the catalog (yearly)', () => {
    renderSection()

    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()
    expect(screen.getByText('$240 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$1200 Billed yearly')).toBeTruthy()
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()
  })

  it('moves the personal numbers when the catalog values change', () => {
    const mutated = CATALOG.map((p) =>
      p.tier === 'STANDARD' && p.duration === 'ANNUAL'
        ? makePlan('STANDARD', 'ANNUAL', 30000, 60000)
        : p
    )
    renderSection({ catalogPlans: mutated })

    expect(screen.getByText('$25')).toBeTruthy()
    expect(screen.getByText('$300 Billed yearly')).toBeTruthy()
    expect(screen.getByText('60,000')).toBeTruthy()
    expect(screen.queryByText('$240 Billed yearly')).toBeNull()
  })

  it('renders team credits from the API stops, not a constant', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    // default_stop_index 1 => the $900 / 189,900 stop.
    expect(screen.getByText('189,900')).toBeTruthy()
    // The old constant stop must never appear.
    expect(screen.queryByText('147,700')).toBeNull()
  })

  it('moves the team credits when the API stops change', async () => {
    const mutated: TeamCreditStops = {
      default_stop_index: 0,
      stops: [
        {
          id: 'team_500',
          credits: 111_000,
          monthly: { list_price_cents: 50_000, price_cents: 50_000 },
          yearly: { list_price_cents: 50_000, price_cents: 45_000 }
        }
      ]
    }
    renderSection({ teamCreditStops: mutated })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(screen.getByText('111,000')).toBeTruthy()
    expect(screen.queryByText('189,900')).toBeNull()
  })

  it('shows the unavailable state for personal when the catalog is empty', () => {
    renderSection({ catalogPlans: [], teamCreditStops: null })

    expect(screen.getByText("We couldn't load your plan details.")).toBeTruthy()
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()
    expect(screen.queryByText('50,400')).toBeNull()
  })

  it('shows the unavailable state for teams when stops are absent', async () => {
    renderSection({ teamCreditStops: null })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(screen.getByText("We couldn't load your plan details.")).toBeTruthy()
    // No constant-seeded slider stop.
    expect(screen.queryByText('147,700')).toBeNull()
  })

  it('emits retry from the unavailable state', async () => {
    const { emitted } = renderSection({
      catalogPlans: [],
      teamCreditStops: null
    })

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(emitted().retry).toBeTruthy()
  })

  it('shows a spinner and no prices while loading', () => {
    renderSection({ isLoading: true, catalogPlans: [], teamCreditStops: null })

    expect(screen.getByText('Loading')).toBeTruthy()
    expect(screen.queryByText("We couldn't load your plan details.")).toBeNull()
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()
  })

  it('keeps every CTA disabled (checkout is a later slice)', async () => {
    renderSection()

    for (const name of ['Choose Standard', 'Choose Creator', 'Choose Pro']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Contact us' })).toBeDisabled()
  })
})
