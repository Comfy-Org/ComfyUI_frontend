import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

import SettingsPlansSection from './SettingsPlansSection.vue'

const {
  mockFetchPlans,
  mockCatalogPlans,
  mockCurrentPlanSlug,
  mockSubscribeToPersonal,
  mockSubscribeToTeam
} = vi.hoisted(() => ({
  mockFetchPlans: vi.fn(),
  mockCatalogPlans: { value: [] as unknown[] },
  mockCurrentPlanSlug: { value: null as string | null },
  mockSubscribeToPersonal: vi.fn(),
  mockSubscribeToTeam: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchPlans: mockFetchPlans,
    plans: mockCatalogPlans,
    currentPlanSlug: mockCurrentPlanSlug
  })
}))

vi.mock(
  '@/platform/workspace/composables/useSettingsPlansCheckout',
  async () => {
    const { ref } = await import('vue')
    return {
      useSettingsPlansCheckout: () => ({
        isSubscribing: ref(false),
        subscribeToPersonal: mockSubscribeToPersonal,
        subscribeToTeam: mockSubscribeToTeam
      })
    }
  }
)

function makeCatalogPlan(
  slug: string,
  tier: Plan['tier'],
  duration: Plan['duration']
): Plan {
  return {
    slug,
    tier,
    duration,
    price_cents: 1600,
    credits_cents: 4200,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 1600,
      total_credits_cents: 4200
    }
  }
}

const yearlyCatalog = () => [
  makeCatalogPlan('standard-yearly', 'STANDARD', 'ANNUAL'),
  makeCatalogPlan('creator-yearly', 'CREATOR', 'ANNUAL'),
  makeCatalogPlan('pro-yearly', 'PRO', 'ANNUAL')
]

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderSection() {
  return render(SettingsPlansSection, {
    global: {
      plugins: [i18n],
      stubs: {
        // Clicking moves the v-model selection to the $200 stop so tests can
        // drive the team credits display.
        CreditSlider: {
          template:
            '<button data-testid="team-slider" @click="$emit(\'update:modelValue\', 200)" />',
          emits: ['update:modelValue']
        }
      }
    }
  })
}

describe('SettingsPlansSection', () => {
  beforeEach(() => {
    useBillingPlans().teamCreditStops.value = null
    mockCatalogPlans.value = []
    mockCurrentPlanSlug.value = null
    mockFetchPlans.mockReset()
    mockSubscribeToPersonal.mockReset()
    mockSubscribeToTeam.mockReset()
  })

  it('renders team stops loaded through the billing context, re-snapping to the API default', async () => {
    // Resolves after mount, like the real fetch: the slider is seeded from the
    // static $700 stop, which the arriving breakpoints do not contain.
    mockFetchPlans.mockImplementation(async () => {
      useBillingPlans().teamCreditStops.value = {
        default_stop_index: 1,
        stops: [
          {
            id: 'team_300',
            credits: 63_300,
            monthly: { list_price_cents: 30_000, price_cents: 30_000 },
            yearly: { list_price_cents: 30_000, price_cents: 30_000 }
          },
          {
            id: 'team_900',
            credits: 189_900,
            monthly: { list_price_cents: 90_000, price_cents: 85_500 },
            yearly: { list_price_cents: 90_000, price_cents: 81_000 }
          }
        ]
      }
    })

    renderSection()
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(await screen.findByText('189,900')).toBeTruthy()
    expect(screen.getByText('Generates ~17,235 5s videos*')).toBeTruthy()
    expect(screen.queryByText('147,700')).toBeNull()
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

  it('renders the three personal cards with yearly pricing by default', () => {
    renderSection()

    expect(screen.getByText('Standard')).toBeTruthy()
    expect(screen.getByText('Creator')).toBeTruthy()
    expect(screen.getByText('Pro')).toBeTruthy()

    expect(screen.getByText('$16')).toBeTruthy()
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.getByText('$80')).toBeTruthy()

    expect(screen.getByText('$192 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$336 Billed yearly')).toBeTruthy()
    expect(screen.getByText('$960 Billed yearly')).toBeTruthy()

    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getAllByText('credits a year')).toHaveLength(3)

    expect(screen.getByText('263 per dollar')).toBeTruthy()
    expect(screen.getAllByText('264 per dollar')).toHaveLength(2)

    expect(screen.getByText("What's included:")).toBeTruthy()
    expect(screen.getByText('Everything in Standard, plus:')).toBeTruthy()
    expect(screen.getByText('Everything in Creator, plus:')).toBeTruthy()
  })

  it('switches to monthly pricing without any savings copy on the cards', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('switch'))

    expect(screen.getByText('$20')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('$100')).toBeTruthy()

    expect(screen.getAllByText('Billed monthly')).toHaveLength(3)
    expect(screen.queryByText(/\$\d+ Billed yearly/)).toBeNull()

    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getAllByText('credits a month')).toHaveLength(3)

    expect(screen.getByText('210 per dollar')).toBeTruthy()
    expect(screen.getAllByText('211 per dollar')).toHaveLength(2)
  })

  it('shows the team plan with the default credit stop on the Teams tab', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(screen.queryByText('Choose Standard')).toBeNull()
    expect(screen.getByText('Team Plan')).toBeTruthy()
    expect(screen.getByText('147,700')).toBeTruthy()
    expect(screen.getByText('Generates ~13,405 5s videos*')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeTruthy()
    expect(screen.getByText('Enterprise')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contact us' })).toBeTruthy()
  })

  it('drives the team credits and video estimate from the slider selection', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    await userEvent.click(screen.getByTestId('team-slider'))

    expect(screen.getByText('42,200')).toBeTruthy()
    expect(screen.getByText('Generates ~3,830 5s videos*')).toBeTruthy()
  })

  it('labels the team subscribe button for the monthly cycle', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Monthly' })
    ).toBeTruthy()
  })

  it('passes the tier key and selected cycle to the subscribe handler', async () => {
    renderSection()

    await userEvent.click(
      screen.getByRole('button', { name: 'Choose Standard' })
    )
    expect(mockSubscribeToPersonal).toHaveBeenCalledWith('standard', 'yearly')

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: 'Choose Pro' }))
    expect(mockSubscribeToPersonal).toHaveBeenCalledWith('pro', 'monthly')
  })

  it('disables the current plan card and keeps the others actionable', async () => {
    mockCatalogPlans.value = yearlyCatalog()
    mockCurrentPlanSlug.value = 'creator-yearly'
    renderSection()

    const currentButton = screen.getByRole('button', { name: 'Current Plan' })
    expect(currentButton).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Choose Standard' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled()

    await userEvent.click(currentButton)
    expect(mockSubscribeToPersonal).not.toHaveBeenCalled()
  })

  it('marks no card current for a founder or legacy plan slug', () => {
    mockCatalogPlans.value = yearlyCatalog()
    mockCurrentPlanSlug.value = 'founders-edition-monthly'
    renderSection()

    expect(screen.queryByRole('button', { name: 'Current Plan' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Choose Standard' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choose Creator' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled()
  })

  it('passes the selected API stop and cycle to the team subscribe handler', async () => {
    useBillingPlans().teamCreditStops.value = {
      default_stop_index: 1,
      stops: [
        {
          id: 'team_300',
          credits: 63_300,
          monthly: { list_price_cents: 30_000, price_cents: 30_000 },
          yearly: { list_price_cents: 30_000, price_cents: 30_000 }
        },
        {
          id: 'team_900',
          credits: 189_900,
          monthly: { list_price_cents: 90_000, price_cents: 85_500 },
          yearly: { list_price_cents: 90_000, price_cents: 81_000 }
        }
      ]
    }
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    )

    expect(mockSubscribeToTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team_900' }),
      'yearly'
    )
  })

  it('disables the team button when the team plan for the cycle is current', async () => {
    mockCurrentPlanSlug.value = 'team_per_credit_annual'
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    const teamButton = screen.getByRole('button', { name: 'Current plan' })
    expect(teamButton).toBeDisabled()

    await userEvent.click(screen.getByRole('switch'))
    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Monthly' })
    ).toBeEnabled()
  })
})
