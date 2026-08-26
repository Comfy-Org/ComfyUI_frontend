import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
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
    error?: string | null
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
    expect(screen.getByText('$420 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$1,200 Billed yearly')).toBeTruthy()

    // credits_cents is the annual total, rendered as-is (no ×12).
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()

    // Per dollar = annual credits / annual list price (50400/240, 88800/420, 253200/1200).
    expect(screen.getByText('210 per dollar')).toBeTruthy()
    expect(screen.getAllByText('211 per dollar')).toHaveLength(2)
  })

  it('renders the API price and credits for the monthly cycle', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('switch'))
    await nextTick()

    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()
    expect(screen.getAllByText('Billed monthly')).toHaveLength(3)

    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('7,400')).toBeTruthy()
    expect(screen.getByText('21,100')).toBeTruthy()
    expect(screen.getAllByText(/^21[01] per dollar$/)).toHaveLength(3)
  })

  it('keeps the cents of a yearly price that does not divide evenly', () => {
    renderSection({
      catalogPlans: [makePlan('STANDARD', 'ANNUAL', 19999, 50400)]
    })

    expect(screen.getByText('$16.67')).toBeTruthy()
    expect(screen.getByText('$199.99 Billed yearly')).toBeTruthy()
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

  it('shows the unavailable state and no prices when the personal catalog is empty', () => {
    renderSection({ catalogPlans: [], teamCreditStops: null })

    expect(
      screen.getByText('No plans are available right now. Check back soon.')
    ).toBeTruthy()
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()
    expect(screen.queryByText('50,400')).toBeNull()
  })

  it('shows the unavailable state and no constant stop when team stops are absent', async () => {
    renderSection({ teamCreditStops: null })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(
      screen.getByText('No plans are available right now. Check back soon.')
    ).toBeTruthy()
    // No constant-seeded slider stop.
    expect(screen.queryByText('147,700')).toBeNull()
  })

  it('emits retry from the error state', async () => {
    const { emitted } = renderSection({
      catalogPlans: [],
      teamCreditStops: null,
      error: 'network down'
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

  it('exposes the billing switch by its accessible name', () => {
    renderSection()

    expect(screen.getByRole('switch', { name: 'Billed yearly' })).toBeTruthy()
  })

  it('shows the default stop credits when live stops replace the seeded set', async () => {
    // Seed with one breakpoint set, then swap to a disjoint set: the previously
    // seeded USD matches no new stop, so the display falls back to the API
    // default stop (no stale/blank credits).
    const { rerender } = renderSection({
      teamCreditStops: {
        default_stop_index: 0,
        stops: [
          {
            id: 'team_200',
            credits: 42_200,
            monthly: { list_price_cents: 20_000, price_cents: 20_000 },
            yearly: { list_price_cents: 20_000, price_cents: 18_000 }
          }
        ]
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    expect(screen.getByText('42,200')).toBeTruthy()

    await rerender({
      catalogPlans: CATALOG,
      teamCreditStops: {
        default_stop_index: 1,
        stops: [
          {
            id: 'team_400',
            credits: 84_400,
            monthly: { list_price_cents: 40_000, price_cents: 40_000 },
            yearly: { list_price_cents: 40_000, price_cents: 36_000 }
          },
          {
            id: 'team_1200',
            credits: 253_200,
            monthly: { list_price_cents: 120_000, price_cents: 114_000 },
            yearly: { list_price_cents: 120_000, price_cents: 108_000 }
          }
        ]
      }
    })

    expect(await screen.findByText('253,200')).toBeTruthy()
    expect(screen.queryByText('42,200')).toBeNull()
  })

  it('shows the empty-state copy (no retry) when the catalog loaded but is empty', () => {
    renderSection({ catalogPlans: [], teamCreditStops: null, error: null })

    expect(
      screen.getByText('No plans are available right now. Check back soon.')
    ).toBeTruthy()
    expect(screen.queryByText("We couldn't load your plan details.")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('shows the error copy and a working retry when the load failed', async () => {
    const { emitted } = renderSection({
      catalogPlans: [],
      teamCreditStops: null,
      error: 'network down'
    })

    expect(screen.getByText("We couldn't load your plan details.")).toBeTruthy()
    expect(
      screen.queryByText('No plans are available right now. Check back soon.')
    ).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(emitted().retry).toBeTruthy()
  })

  it('keeps the cards visible during a refetch instead of flashing the spinner', async () => {
    const { rerender } = renderSection()
    expect(screen.getByText('$20')).toBeTruthy()

    await rerender({
      catalogPlans: CATALOG,
      teamCreditStops: TEAM_STOPS,
      isLoading: true
    })

    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.queryByText('Loading')).toBeNull()
  })
})
