import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import enMessages from '@/locales/en/main.json'
import UnifiedPricingTable from '@/platform/workspace/components/UnifiedPricingTable.vue'

interface MockSubscription {
  tier: string
  isCancelled?: boolean
  duration?: string
}

interface MockTeamStop {
  id: string
  credits_monthly: number
  stop_usd: number
}

interface MockPlan {
  tier: string
  duration: 'MONTHLY' | 'ANNUAL'
  price_cents: number
  slug: string
}

const mockSubscription = ref<MockSubscription | null>(null)
const mockCurrentPlanSlug = ref<string | null>(null)
const mockCurrentTeamCreditStop = ref<MockTeamStop | null>(null)
const mockTeamFlag = ref(false)
const mockIsTeamPlan = ref(false)
const mockCanManageSubscription = ref(true)
const mockCanDowngradeToPersonal = ref(true)
const mockPlans = ref<MockPlan[]>([])
const mockIsEduPricingActive = ref(false)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    plans: mockPlans,
    currentPlanSlug: computed(() => mockCurrentPlanSlug.value),
    fetchPlans: vi.fn(),
    isTeamPlan: computed(() => mockIsTeamPlan.value),
    subscription: computed(() => mockSubscription.value),
    currentTeamCreditStop: computed(() => mockCurrentTeamCreditStop.value)
  })
}))

vi.mock('@/composables/auth/useEmailVerification', () => ({
  useEmailVerification: () => ({
    isSending: computed(() => false),
    isSent: computed(() => false),
    sendVerification: vi.fn(),
    refreshVerification: vi.fn()
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    fetchStatus: vi.fn()
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    createCustomer: vi.fn()
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useEduPricing', () => ({
  useEduPricing: () => ({
    isEduPricingActive: computed(() => mockIsEduPricingActive.value),
    needsEduVerification: computed(() => false)
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: mockCanManageSubscription.value,
      canDowngradeToPersonal: mockCanDowngradeToPersonal.value
    }))
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { teamWorkspacesEnabled: mockTeamFlag.value }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Interactive toggle stub: renders a button per option so EDU tests can flip
// the billing cycle. The default `<div />` stub keeps existing tests inert.
const InteractiveSelectButton = {
  template:
    '<div><button v-for="option in options" :key="option.value" type="button" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></div>',
  props: ['modelValue', 'options'],
  emits: ['update:modelValue']
}

function renderComponent(
  props: Record<string, unknown> = {},
  stubOverrides: Record<string, unknown> = {}
) {
  return render(UnifiedPricingTable, {
    props,
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: {
        SelectButton: { template: '<div />' },
        // Clicking moves the v-model selection to a different stop ($200) so
        // tests can move off the current stop.
        CreditSlider: {
          template:
            '<button data-testid="team-slider" @click="$emit(\'update:modelValue\', 200)" />',
          emits: ['update:modelValue']
        },
        ...stubOverrides
      }
    }
  })
}

describe('UnifiedPricingTable plan CTA labels', () => {
  beforeEach(() => {
    mockSubscription.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockTeamFlag.value = false
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
  })

  it('prompts free-tier users to subscribe, never to "change"', () => {
    mockSubscription.value = { tier: 'FREE', duration: 'ANNUAL' }

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Subscribe to Standard Yearly' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Subscribe to Creator Yearly' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Subscribe to Pro Yearly' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Change to/ })).toBeNull()
  })

  it('offers a plan change to users already on a paid plan', () => {
    mockSubscription.value = { tier: 'STANDARD', duration: 'ANNUAL' }

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change to Creator Yearly' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Change to Pro Yearly' })
    ).toBeTruthy()
  })

  it('keeps personal tier cards actionable for the original owner of a team plan', () => {
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }
    mockIsTeamPlan.value = true

    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeEnabled()
  })

  it('normalizes a promoted owner on a team plan away from personal plans', () => {
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }
    mockTeamFlag.value = true
    mockIsTeamPlan.value = true
    mockCanDowngradeToPersonal.value = false

    renderComponent({ initialPlanMode: 'personal' })

    expect(
      screen.queryByRole('button', { name: 'Change to Standard Yearly' })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled()
  })
})

describe('UnifiedPricingTable team plan CTA', () => {
  const TEAM_STOP = {
    id: 'team_2500',
    credits_monthly: 527_500,
    stop_usd: 2_500
  }

  beforeEach(() => {
    mockSubscription.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockTeamFlag.value = true
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
  })

  it('disables the CTA while sitting on the active current plan', () => {
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Current plan' })
    expect(cta).toBeDisabled()
  })

  it('lets an active sub change to a different stop', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    const [teamPayload] = emitted().subscribeTeam![0] as [{ isChange: boolean }]
    expect(teamPayload).toMatchObject({ isChange: true })
  })

  it('lets an active sub change billing cycle at the current stop', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'MONTHLY',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    // The subscription is monthly; the default view is yearly, so the same stop
    // on the other cycle is a change, not the current plan.
    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    const [teamPayload] = emitted().subscribeTeam![0] as [{ isChange: boolean }]
    expect(teamPayload).toMatchObject({ isChange: true })
    expect(emitted().resubscribe).toBeFalsy()
  })

  it('re-subscribes (not change) for a cancelled team subscription', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Resubscribe' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().resubscribe).toBeTruthy()
  })

  it('lets a cancelled sub change to a different stop (not re-subscribe)', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', { name: 'Change plan' })
    expect(cta).toBeEnabled()
    await user.click(cta)
    expect(emitted().subscribeTeam).toBeTruthy()
    expect(emitted().resubscribe).toBeFalsy()
  })

  it('prompts a fresh subscribe when on no team plan', () => {
    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeTruthy()
  })
})

describe('UnifiedPricingTable EDU pricing', () => {
  const withToggle = { SelectButton: InteractiveSelectButton }

  beforeEach(() => {
    mockSubscription.value = null
    mockCurrentPlanSlug.value = null
    mockCurrentTeamCreditStop.value = null
    mockTeamFlag.value = false
    mockIsTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockCanDowngradeToPersonal.value = true
    mockPlans.value = []
    mockIsEduPricingActive.value = false
  })

  // Display must match the coupon charge: monthly 10% off list, yearly 6.25% off
  // the yearly price (= 25% off the monthly list). Yearly strikes the monthly list.
  it.for([
    ['standard', 'monthly', '$18', '$20'],
    ['creator', 'monthly', '$31.5', '$35'],
    ['pro', 'monthly', '$90', '$100'],
    ['standard', 'yearly', '$15', '$20'],
    ['creator', 'yearly', '$26.25', '$35'],
    ['pro', 'yearly', '$75', '$100']
  ] as const)(
    'discounts %s %s against the struck monthly list',
    async ([tierKey, cycle, price, struck]) => {
      mockIsEduPricingActive.value = true
      renderComponent({}, withToggle)

      if (cycle === 'monthly') {
        await userEvent.click(screen.getByRole('button', { name: 'Monthly' }))
      }

      const card = screen.getByTestId(`pricing-tier-${tierKey}`)
      expect(card.textContent).toContain(price)
      expect(card.textContent).toContain(struck)
    }
  )

  it('keeps list prices when EDU is inactive', () => {
    renderComponent()

    // Yearly default: monthly-equivalent list price, struck monthly list, full total.
    const card = screen.getByTestId('pricing-tier-standard')
    expect(card.textContent).toContain('$16')
    expect(card.textContent).toContain('$20')
    expect(card.textContent).toContain('$192 Billed yearly')
    expect(card.textContent).not.toContain('$15')
    expect(card.textContent).not.toContain('$180')
  })

  it('applies the discount to the API-derived price, not just the static fallback', () => {
    mockIsEduPricingActive.value = true
    mockPlans.value = [
      {
        tier: 'STANDARD',
        duration: 'MONTHLY',
        price_cents: 3000,
        slug: 'standard-monthly'
      },
      {
        tier: 'STANDARD',
        duration: 'ANNUAL',
        price_cents: 24000,
        slug: 'standard-annual'
      }
    ]
    renderComponent()

    // API monthly-equiv $20 -> EDU $18.75, struck API monthly $30, annual total
    // $240 -> EDU $225. All distinct from the static-fallback figures.
    const card = screen.getByTestId('pricing-tier-standard')
    expect(card.textContent).toContain('$18.75')
    expect(card.textContent).toContain('$30')
    expect(card.textContent).toContain('$225 Billed yearly')
  })
})
