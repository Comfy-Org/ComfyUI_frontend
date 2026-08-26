import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import type {
  Plan,
  TeamCreditStops,
  TeamCreditStopSummary
} from '@/platform/workspace/api/workspaceApi'

import SettingsPlansSection from './SettingsPlansSection.vue'

const { mockIsSubscribing, mockSubscribeToPersonal, mockSubscribeToTeam } =
  vi.hoisted(() => ({
    // A real ref so the template unwraps it; a plain object reads truthy and
    // would disable every CTA.
    mockIsSubscribing: { current: null as ReturnType<typeof ref> | null },
    mockSubscribeToPersonal: vi.fn(),
    mockSubscribeToTeam: vi.fn()
  }))

vi.mock('@/platform/workspace/composables/useSettingsPlansCheckout', () => ({
  useSettingsPlansCheckout: () => ({
    isSubscribing: mockIsSubscribing.current,
    subscribeToPersonal: mockSubscribeToPersonal,
    subscribeToTeam: mockSubscribeToTeam
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makePlan(
  tier: Plan['tier'],
  duration: Plan['duration'],
  price_cents: number,
  credits_cents: number,
  slug = `${tier.toLowerCase()}-${duration.toLowerCase()}`
): Plan {
  return {
    slug,
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
  makePlan('PRO', 'MONTHLY', 10000, 21100),
  // TEAM rows carry the checkout slug per cycle; stops carry the id.
  makePlan('TEAM', 'ANNUAL', 0, 0, 'team-annual-catalog'),
  makePlan('TEAM', 'MONTHLY', 0, 0, 'team-monthly-catalog')
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
    currentPlanSlug?: string | null
    currentTeamCreditStop?: TeamCreditStopSummary | null
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
  beforeEach(() => {
    mockIsSubscribing.current = ref(false)
    mockSubscribeToPersonal.mockReset()
    mockSubscribeToTeam.mockReset()
  })

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

  it('surfaces a retryable failure over cached cards on a refetch error', async () => {
    const { emitted } = renderSection({ error: 'network down' })

    // The cached catalog stays on screen rather than flashing to empty...
    expect(screen.getByText('$20')).toBeTruthy()
    // ...but the failure is stated and retryable, not silent.
    expect(
      screen.getByText(
        "We couldn't refresh your plan details. These prices may be out of date."
      )
    ).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(emitted().retry).toBeTruthy()
  })

  it('shows a spinner and no prices while loading', () => {
    renderSection({ isLoading: true, catalogPlans: [], teamCreditStops: null })

    expect(screen.getByText('Loading')).toBeTruthy()
    expect(screen.queryByText("We couldn't load your plan details.")).toBeNull()
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()
  })

  it('exposes the billing switch by its accessible name', () => {
    renderSection()

    expect(screen.getByRole('switch', { name: 'Billed yearly' })).toBeTruthy()
  })

  it('shows the default stop credits when live stops replace the seeded set', async () => {
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

describe('SettingsPlansSection — checkout uses API plan identity', () => {
  beforeEach(() => {
    mockIsSubscribing.current = ref(false)
    mockSubscribeToPersonal.mockReset()
    mockSubscribeToTeam.mockReset()
  })

  it('submits the exact rendered API slug for the chosen card and cycle', async () => {
    // The slug is sourced from the rendered Plan, so mutating the fixture slug
    // must change the submitted slug — render and checkout share one identity.
    const catalog = CATALOG.map((p) =>
      p.tier === 'STANDARD' && p.duration === 'ANNUAL'
        ? makePlan('STANDARD', 'ANNUAL', 24000, 50400, 'standard-annual-v2')
        : p
    )
    renderSection({ catalogPlans: catalog })

    await userEvent.click(
      screen.getByRole('button', { name: 'Choose Standard' })
    )
    expect(mockSubscribeToPersonal).toHaveBeenCalledWith({
      slug: 'standard-annual-v2',
      tierKey: 'standard',
      billingCycle: 'yearly'
    })

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: 'Choose Pro' }))
    expect(mockSubscribeToPersonal).toHaveBeenCalledWith({
      slug: 'pro-monthly',
      tierKey: 'pro',
      billingCycle: 'monthly'
    })
  })

  it('disables only the current personal card, by exact API slug', async () => {
    renderSection({ currentPlanSlug: 'creator-annual' })

    const current = screen.getByRole('button', { name: 'Current Plan' })
    expect(current).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Choose Standard' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled()

    await userEvent.click(current)
    expect(mockSubscribeToPersonal).not.toHaveBeenCalled()
  })

  it('disables a card whose API plan is unavailable and blocks its checkout', async () => {
    const catalog = CATALOG.map((p) =>
      p.tier === 'STANDARD' && p.duration === 'ANNUAL'
        ? { ...p, availability: { available: false } }
        : p
    )
    renderSection({ catalogPlans: catalog })

    const standard = screen.getByRole('button', { name: 'Choose Standard' })
    expect(standard).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled()

    await userEvent.click(standard)
    expect(mockSubscribeToPersonal).not.toHaveBeenCalled()
  })

  it('disables every CTA while a checkout is in flight', async () => {
    mockIsSubscribing.current = ref(true)
    renderSection()

    for (const name of ['Choose Standard', 'Choose Creator', 'Choose Pro']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }

    // The team CTA must be locked too, or a second click could double-submit.
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeDisabled()
  })

  it('marks no card current for an enterprise/founder/legacy slug', () => {
    renderSection({ currentPlanSlug: 'enterprise-annual' })

    expect(screen.queryByRole('button', { name: 'Current Plan' })).toBeNull()
    for (const name of ['Choose Standard', 'Choose Creator', 'Choose Pro']) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
  })

  it('submits the team API slug and the selected stop id', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    )

    expect(mockSubscribeToTeam).toHaveBeenCalledWith({
      slug: 'team-annual-catalog',
      stop: expect.objectContaining({ id: 'team_900' }),
      billingCycle: 'yearly'
    })
  })

  it('disables the team CTA only for the current stop, not every stop in the cycle', async () => {
    // default stop is team_900; the current stop is team_300, a DIFFERENT stop.
    renderSection({
      currentTeamCreditStop: {
        id: 'team_300',
        stop_usd: 300,
        credits_monthly: 63_300
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    // Selected default (team_900) is not the current stop => actionable.
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeEnabled()
  })

  it('disables the team CTA when the selected stop is the current stop', async () => {
    renderSection({
      currentTeamCreditStop: {
        id: 'team_900',
        stop_usd: 900,
        credits_monthly: 189_900
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled()
  })

  it('does not submit a synthesized team slug when the catalog has no TEAM row', async () => {
    const noTeam = CATALOG.filter((p) => p.tier !== 'TEAM')
    renderSection({ catalogPlans: noTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    const cta = screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    expect(cta).toBeDisabled()
    await userEvent.click(cta)
    expect(mockSubscribeToTeam).not.toHaveBeenCalled()
  })

  it('disables the team CTA when the API TEAM row is unavailable', async () => {
    const catalog = CATALOG.map((p) =>
      p.tier === 'TEAM' && p.duration === 'ANNUAL'
        ? { ...p, availability: { available: false } }
        : p
    )
    renderSection({ catalogPlans: catalog })
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    const cta = screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    expect(cta).toBeDisabled()
    await userEvent.click(cta)
    expect(mockSubscribeToTeam).not.toHaveBeenCalled()
  })

  // The preview/consent dialog is what makes a plan change safe to offer, so a
  // subscriber's other plans are actionable and route through the same launcher.
  describe('for an existing subscriber', () => {
    it('offers every non-current personal plan and dispatches its checkout', async () => {
      renderSection({ currentPlanSlug: 'standard-annual' })

      const cta = screen.getByRole('button', { name: 'Choose Creator' })
      expect(cta).toBeEnabled()
      await userEvent.click(cta)

      expect(mockSubscribeToPersonal).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'creator-annual' })
      )
    })

    it('still labels the subscribed card as the current plan', () => {
      renderSection({ currentPlanSlug: 'standard-annual' })

      expect(
        screen.getByRole('button', { name: 'Current Plan' })
      ).toBeInTheDocument()
    })

    it('offers the team plan and dispatches its checkout', async () => {
      renderSection({ currentPlanSlug: 'standard-annual' })
      await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

      const cta = screen.getByRole('button', {
        name: 'Subscribe to Team Yearly'
      })
      expect(cta).toBeEnabled()
      await userEvent.click(cta)
      expect(mockSubscribeToTeam).toHaveBeenCalled()
    })
  })
})
