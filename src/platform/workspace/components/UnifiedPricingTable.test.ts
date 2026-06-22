import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  BillingPlanType,
  SubscriptionLock
} from '@/composables/billing/types'
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

const mockSubscription = ref<MockSubscription | null>(null)
const mockCurrentPlanSlug = ref<string | null>(null)
const mockCurrentTeamCreditStop = ref<MockTeamStop | null>(null)
const mockTeamFlag = ref(false)
const mockPlanType = ref<BillingPlanType>('none')
const mockSubscriptionLock = ref<SubscriptionLock>({
  allowPersonalTiers: true,
  allowTeamPlan: true,
  resubscribeOnly: false
})
const mockIsInPersonalWorkspace = ref(false)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    plans: ref([]),
    currentPlanSlug: computed(() => mockCurrentPlanSlug.value),
    fetchPlans: vi.fn(),
    subscription: computed(() => mockSubscription.value),
    currentTeamCreditStop: computed(() => mockCurrentTeamCreditStop.value),
    planType: computed(() => mockPlanType.value),
    subscriptionLock: computed(() => mockSubscriptionLock.value)
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get isInPersonalWorkspace() {
      return mockIsInPersonalWorkspace.value
    }
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

function renderComponent(props: Record<string, unknown> = {}) {
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
        }
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
    mockPlanType.value = 'none'
    mockSubscriptionLock.value = {
      allowPersonalTiers: true,
      allowTeamPlan: true,
      resubscribeOnly: false
    }
    mockIsInPersonalWorkspace.value = false
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

  it('locks every personal tier card for a new-team subscriber', () => {
    mockPlanType.value = 'new-team'
    mockSubscriptionLock.value = {
      allowPersonalTiers: false,
      allowTeamPlan: false,
      resubscribeOnly: true
    }
    mockSubscription.value = { tier: 'TEAM', duration: 'ANNUAL' }
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147_700,
      stop_usd: 700
    }

    renderComponent()

    const locked = screen.getAllByRole('button', {
      name: 'Not available while on a team plan'
    })
    expect(locked).toHaveLength(3)
    locked.forEach((button) => expect(button).toBeDisabled())
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
    mockPlanType.value = 'none'
    mockSubscriptionLock.value = {
      allowPersonalTiers: true,
      allowTeamPlan: true,
      resubscribeOnly: false
    }
    mockIsInPersonalWorkspace.value = false
  })

  it('disables the CTA while sitting on the active current stop', () => {
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

  it('locks the CTA when an active sub picks a different stop', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: false
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', {
      name: "Credits currently can't be changed"
    })
    expect(cta).toBeDisabled()
    expect(emitted().subscribeTeam).toBeFalsy()
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

  it('locks the CTA when a cancelled sub picks a different stop', async () => {
    const user = userEvent.setup()
    mockSubscription.value = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      isCancelled: true
    }
    mockCurrentTeamCreditStop.value = TEAM_STOP

    const { emitted } = renderComponent({ initialPlanMode: 'team' })

    await user.click(screen.getByTestId('team-slider'))

    const cta = screen.getByRole('button', {
      name: "Credits currently can't be changed"
    })
    expect(cta).toBeDisabled()
    expect(emitted().subscribeTeam).toBeFalsy()
  })

  it('prompts a fresh subscribe when on no team plan', () => {
    renderComponent({ initialPlanMode: 'team' })

    expect(
      screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    ).toBeTruthy()
  })

  it('locks the team CTA for a team workspace holding a personal subscription', () => {
    mockPlanType.value = 'personal'
    mockSubscription.value = { tier: 'STANDARD', duration: 'ANNUAL' }
    mockIsInPersonalWorkspace.value = false

    renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', {
      name: 'Not available while on a personal plan'
    })
    expect(cta).toBeDisabled()
  })

  it('keeps the team CTA actionable from a personal workspace', () => {
    mockPlanType.value = 'personal'
    mockSubscription.value = { tier: 'STANDARD', duration: 'ANNUAL' }
    mockIsInPersonalWorkspace.value = true

    renderComponent({ initialPlanMode: 'team' })

    const cta = screen.getByRole('button', { name: 'Subscribe to Team Yearly' })
    expect(cta).toBeEnabled()
  })
})
