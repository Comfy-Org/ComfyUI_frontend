import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import type { CurrentTeamCreditStop } from '@/platform/workspace/api/workspaceApi'

type Balance = Pick<
  BalanceInfo,
  'amountMicros' | 'cloudCreditBalanceMicros' | 'prepaidBalanceMicros'
>
type Subscription = Pick<SubscriptionInfo, 'duration' | 'renewalDate'> & {
  tier: SubscriptionInfo['tier'] | 'TEAM'
}
type TeamStop = CurrentTeamCreditStop

const state = vi.hoisted(() => ({
  balance: null as Balance | null,
  subscription: null as Subscription | null,
  canAccessSubscriptionFeatures: false,
  isFreeTier: false,
  currentTeamCreditStop: null as TeamStop | null,
  isLoading: false,
  canTopUp: true,
  fetchBalance: vi.fn(),
  fetchStatus: vi.fn(),
  showPricingTable: vi.fn(),
  showTopUpCreditsDialog: vi.fn(),
  trackAddApiCreditButtonClicked: vi.fn(),
  toastErrorHandler: vi.fn()
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync:
      <TArgs extends unknown[], TReturn>(
        action: (...args: TArgs) => Promise<TReturn> | TReturn
      ) =>
      async (...args: TArgs): Promise<TReturn | undefined> => {
        try {
          return await action(...args)
        } catch (e) {
          state.toastErrorHandler(e)
        }
      }
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    balance: computed(() => state.balance),
    subscription: computed(() => state.subscription),
    canAccessSubscriptionFeatures: computed(
      () => state.canAccessSubscriptionFeatures
    ),
    isFreeTier: computed(() => state.isFreeTier),
    currentTeamCreditStop: computed(() => state.currentTeamCreditStop),
    isLoading: computed(() => state.isLoading),
    fetchBalance: state.fetchBalance,
    fetchStatus: state.fetchStatus
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({ canTopUp: state.canTopUp }))
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ showPricingTable: state.showPricingTable })
  })
)

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: state.showTopUpCreditsDialog
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAddApiCreditButtonClicked: state.trackAddApiCreditButtonClicked
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        totalCredits: 'Total credits',
        remaining: 'remaining',
        refreshCredits: 'Refresh credits',
        monthly: 'Monthly',
        refillsDate: 'Refills {date}',
        refillsNextCycle: 'Refills next cycle',
        creditsUsed: '{used} used',
        creditsLeftOfTotal: '{remaining} left of {total}',
        monthlyUsageProgress: '{used} of {total} monthly credits used',
        additionalCreditsInfo: 'About additional credits',
        additionalCreditsTooltip: 'Credits you add on top of your plan.',
        additionalCredits: 'Additional credits',
        additionalCreditsInUse: 'In use',
        usedAfterMonthly: 'Used after monthly runs out',
        monthlyCreditsUsedUpTitle:
          'Monthly credits are used up. Refills {date}',
        monthlyCreditsUsedUpTitleNoDate: 'Monthly credits are used up',
        monthlyCreditsUsedUpDescription:
          "You're now spending additional credits.",
        outOfCreditsTitle: "You're out of credits. Credits refill {date}",
        outOfCreditsTitleNoDate: "You're out of credits",
        outOfCreditsDescription: 'Add more credits to continue generating.',
        addCredits: 'Add credits',
        upgradeToAddCredits: 'Upgrade to add credits'
      }
    }
  }
})

function renderTile(props: Record<string, unknown> = {}) {
  return render(CreditsTile, {
    props,
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} },
      stubs: {
        Button: {
          template:
            '<button v-bind="$attrs" :data-variant="variant" :disabled="loading" @click="$emit(\'click\')"><slot/></button>',
          props: ['variant', 'size', 'loading'],
          emits: ['click']
        },
        Skeleton: { template: '<div role="status" aria-label="Loading"></div>' }
      }
    }
  })
}

function activeProSubscription() {
  state.canAccessSubscriptionFeatures = true
  state.subscription = {
    tier: 'PRO',
    duration: 'MONTHLY',
    renewalDate: '2026-02-20T12:00:00Z'
  }
  // amountMicros are cents; centsToCredits multiplies by 2.11.
  state.balance = {
    amountMicros: 500, // -> 1,055 total
    cloudCreditBalanceMicros: 200, // -> 422 monthly remaining
    prepaidBalanceMicros: 300 // -> 633 additional
  }
}

describe('CreditsTile', () => {
  beforeEach(() => {
    state.balance = null
    state.subscription = null
    state.canAccessSubscriptionFeatures = false
    state.isFreeTier = false
    state.currentTeamCreditStop = null
    state.isLoading = false
    state.canTopUp = true
    vi.clearAllMocks()
  })

  it('renders the total balance (cents converted to credits) with the remaining suffix', () => {
    activeProSubscription()
    const { container } = renderTile()
    expect(container.textContent).toContain('1,055')
    expect(container.textContent).toContain('remaining')
  })

  it('renders the monthly usage bar and additional breakdown', () => {
    activeProSubscription()
    const { container } = renderTile()
    // PRO monthly allowance = 21,100; remaining 422 -> used 20,678.
    expect(container.textContent).toContain('Monthly')
    expect(container.textContent).toMatch(/Refills Feb/)
    expect(container.textContent).toContain('20,678 used')
    expect(container.textContent).toContain('422 left of 21,100')
    expect(container.textContent).toContain('Additional credits')
    expect(container.textContent).toContain('633')
    expect(container.textContent).toContain('Used after monthly runs out')
  })

  it('renders a compact monthly summary for narrow containers', () => {
    activeProSubscription()
    const { container } = renderTile()
    expect(container.textContent).toContain('422 left of 21K')
  })

  it('uses the full annual Team grant for the credit pool total', () => {
    state.canAccessSubscriptionFeatures = true
    state.subscription = {
      tier: 'TEAM',
      duration: 'ANNUAL',
      renewalDate: '2026-02-20T12:00:00Z'
    }
    state.currentTeamCreditStop = {
      id: 'team_700',
      credits_monthly: 147700,
      stop_usd: 700
    }
    state.balance = {
      amountMicros: 840000,
      cloudCreditBalanceMicros: 840000
    }
    const { container } = renderTile()
    expect(container.textContent).toContain('1,772,400 left of 1,772,400')
  })

  it('keeps the monthly Team grant as the monthly credit pool total', () => {
    state.canAccessSubscriptionFeatures = true
    state.subscription = {
      tier: 'TEAM',
      duration: 'MONTHLY',
      renewalDate: '2026-02-20T12:00:00Z'
    }
    state.currentTeamCreditStop = {
      id: 'team_700',
      credits_monthly: 147700,
      stop_usd: 700
    }
    state.balance = {
      amountMicros: 70000,
      cloudCreditBalanceMicros: 70000
    }
    const { container } = renderTile()
    expect(container.textContent).toContain('147,700 left of 147,700')
  })

  it('uses the full annual grant for a personal tier credit pool', () => {
    state.canAccessSubscriptionFeatures = true
    state.subscription = {
      tier: 'PRO',
      duration: 'ANNUAL',
      renewalDate: '2026-02-20T12:00:00Z'
    }
    state.balance = {
      amountMicros: 120000,
      cloudCreditBalanceMicros: 120000
    }
    const { container } = renderTile()
    expect(container.textContent).toContain('253,200 left of 253,200')
  })

  it('falls back to a dateless refills label when renewal date is missing', () => {
    activeProSubscription()
    state.subscription = { tier: 'PRO', duration: 'MONTHLY', renewalDate: null }
    const { container } = renderTile()
    expect(container.textContent).toContain('Refills next cycle')
    expect(container.textContent).not.toContain('Refills Feb')
  })

  it('uses a dateless out-of-credits notice when renewal date is invalid', () => {
    activeProSubscription()
    state.subscription = {
      tier: 'PRO',
      duration: 'MONTHLY',
      renewalDate: 'not-a-date'
    }
    state.balance = {
      amountMicros: 0,
      cloudCreditBalanceMicros: 0,
      prepaidBalanceMicros: 0
    }
    const { container } = renderTile()
    expect(container.textContent).toContain("You're out of credits")
    expect(container.textContent).not.toContain('Credits refill')
  })

  it('hides the breakdown and forces zeros in the zero state', () => {
    activeProSubscription()
    const { container } = renderTile({ zeroState: true })
    expect(container.textContent).toContain('0')
    expect(container.textContent).not.toContain('left of')
    expect(container.textContent).not.toContain('Additional credits')
    expect(screen.queryByText('Add credits')).toBeNull()
  })

  it('shows only the balance with no breakdown when there is no active subscription', () => {
    state.canAccessSubscriptionFeatures = false
    state.balance = { amountMicros: 500 }
    const { container } = renderTile()
    expect(container.textContent).toContain('1,055')
    expect(container.textContent).not.toContain('left of')
    expect(container.textContent).not.toContain('Additional credits')
    expect(screen.queryByText('Add credits')).toBeNull()
  })

  it('shows no depletion notice or in-use badge while monthly credits remain', () => {
    activeProSubscription()
    const { container } = renderTile()
    expect(container.textContent).not.toContain('Monthly credits are used up')
    expect(container.textContent).not.toContain("You're out of credits")
    expect(screen.queryByText('In use')).toBeNull()
  })

  it('flags spending of additional credits once the monthly allowance is depleted', () => {
    activeProSubscription()
    state.balance = {
      amountMicros: 300,
      cloudCreditBalanceMicros: 0,
      prepaidBalanceMicros: 300
    }
    const { container } = renderTile()
    expect(container.textContent).toContain(
      'Monthly credits are used up. Refills Feb 20'
    )
    expect(container.textContent).toContain(
      "You're now spending additional credits."
    )
    expect(screen.getByText('In use')).toBeTruthy()
    expect(screen.getByText('Add credits').dataset.variant).toBe('secondary')
  })

  it('emphasizes add-credits when fully out of credits', () => {
    activeProSubscription()
    state.balance = {
      amountMicros: 0,
      cloudCreditBalanceMicros: 0,
      prepaidBalanceMicros: 0
    }
    const { container } = renderTile()
    expect(container.textContent).toContain(
      "You're out of credits. Credits refill Feb 20"
    )
    expect(container.textContent).toContain(
      'Add more credits to continue generating.'
    )
    expect(screen.queryByText('In use')).toBeNull()
    expect(screen.getByText('Add credits').dataset.variant).toBe('inverted')
  })

  it('suppresses the depletion notice until the balance has loaded', () => {
    activeProSubscription()
    state.balance = null
    state.isLoading = true
    const { container } = renderTile()
    expect(container.textContent).not.toContain('Monthly credits are used up')
    expect(container.textContent).not.toContain("You're out of credits")
  })

  it('routes add-credits through telemetry + the top-up dialog', async () => {
    activeProSubscription()
    renderTile()
    await userEvent.click(screen.getByText('Add credits'))
    expect(state.trackAddApiCreditButtonClicked).toHaveBeenCalledOnce()
    expect(state.showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('offers the upgrade path instead of add-credits on the free tier', async () => {
    activeProSubscription()
    state.isFreeTier = true
    renderTile()
    expect(screen.queryByText('Add credits')).toBeNull()
    await userEvent.click(screen.getByText('Upgrade to add credits'))
    expect(state.showPricingTable).toHaveBeenCalledOnce()
  })

  it('hides the action button when the user lacks the top-up permission', () => {
    activeProSubscription()
    state.canTopUp = false
    renderTile()
    expect(screen.queryByText('Add credits')).toBeNull()
    expect(screen.queryByText('Upgrade to add credits')).toBeNull()
  })

  it('refreshes balance and status from the facade on mount and on demand', async () => {
    activeProSubscription()
    renderTile()
    expect(state.fetchBalance).toHaveBeenCalledOnce()
    expect(state.fetchStatus).toHaveBeenCalledOnce()
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh credits' })
    )
    expect(state.fetchBalance).toHaveBeenCalledTimes(2)
    expect(state.fetchStatus).toHaveBeenCalledTimes(2)
  })

  it('surfaces a failure toast when a refresh rejects', async () => {
    activeProSubscription()
    const failure = new Error('network down')
    state.fetchBalance.mockRejectedValueOnce(failure)
    renderTile()
    await waitFor(() =>
      expect(state.toastErrorHandler).toHaveBeenCalledWith(failure)
    )
  })
})
