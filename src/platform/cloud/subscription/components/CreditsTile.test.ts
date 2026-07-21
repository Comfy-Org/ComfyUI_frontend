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
  isActiveSubscription: false,
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
    isPaused: computed(() => false),
    isActiveSubscription: computed(() => state.isActiveSubscription),
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
        yearly: 'Yearly',
        percentUsed: '{percent}% used',
        usageProgress: '{used} of {total} credits used',
        additionalCreditsInfo: 'About additional credits',
        additionalCreditsTooltip: 'Credits you add on top of your plan.',
        additionalCreditsTooltipYearly:
          'Credits you add after yearly credits run out.',
        additionalCredits: 'Additional credits',
        additionalCreditsInUse: 'In use',
        usedAfterMonthly: 'Used after monthly runs out',
        usedAfterYearly: 'Used after yearly runs out',
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
  state.isActiveSubscription = true
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
    state.isActiveSubscription = false
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
    // PRO monthly allowance = 21,100; remaining 422 -> used 20,678 -> 98%.
    expect(container.textContent).toContain('Monthly')
    expect(container.textContent).toContain('98% used')
    expect(container.textContent).toContain('Additional credits')
    expect(container.textContent).toContain('633')
    expect(container.textContent).toContain('Used after monthly runs out')
  })

  it('uses the team credit stop grant for a monthly allowance', () => {
    state.isActiveSubscription = true
    state.subscription = {
      tier: 'TEAM',
      duration: 'MONTHLY',
      renewalDate: '2026-02-20T12:00:00Z'
    }
    state.currentTeamCreditStop = {
      id: 'team_2500',
      credits_monthly: 527500,
      stop_usd: 2500
    }
    state.balance = { amountMicros: 0, cloudCreditBalanceMicros: 200 }
    renderTile()
    // Allowance is the stop's grant, not the tier fallback.
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuemax',
      '527500'
    )
  })

  it('grants the full year upfront for an annual plan', () => {
    state.isActiveSubscription = true
    state.subscription = {
      tier: 'PRO',
      duration: 'ANNUAL',
      renewalDate: '2026-02-20T12:00:00Z'
    }
    state.balance = { amountMicros: 0, cloudCreditBalanceMicros: 200 }
    renderTile()
    // Annual plans grant the whole year at once: 21,100 x 12.
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuemax',
      '253200'
    )
  })

  it('labels the allowance by billing duration (yearly for annual)', () => {
    state.isActiveSubscription = true
    state.subscription = {
      tier: 'PRO',
      duration: 'ANNUAL',
      renewalDate: '2026-02-20T12:00:00Z'
    }
    state.balance = { amountMicros: 0, cloudCreditBalanceMicros: 200 }
    renderTile()
    expect(screen.getByText('Yearly')).toBeInTheDocument()
    expect(screen.getByText('Used after yearly runs out')).toBeInTheDocument()
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Used after monthly runs out')
    ).not.toBeInTheDocument()
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
    state.isActiveSubscription = false
    state.balance = { amountMicros: 500 }
    const { container } = renderTile()
    expect(container.textContent).toContain('1,055')
    expect(container.textContent).not.toContain('left of')
    expect(container.textContent).not.toContain('Additional credits')
    expect(screen.queryByText('Add credits')).toBeNull()
  })

  it('shows no in-use badge while monthly credits remain', () => {
    activeProSubscription()
    renderTile()
    expect(screen.queryByText('In use')).toBeNull()
  })

  it('flags spending of additional credits once the monthly allowance is depleted', () => {
    activeProSubscription()
    state.balance = {
      amountMicros: 300,
      cloudCreditBalanceMicros: 0,
      prepaidBalanceMicros: 300
    }
    renderTile()
    expect(screen.getByText('In use')).toBeTruthy()
    expect(screen.getByText('Add credits').dataset.variant).toBe('tertiary')
  })

  it('emphasizes add-credits when fully out of credits, without a punch-out notice', () => {
    activeProSubscription()
    state.balance = {
      amountMicros: 0,
      cloudCreditBalanceMicros: 0,
      prepaidBalanceMicros: 0
    }
    renderTile()
    expect(screen.queryByText('In use')).toBeNull()
    expect(screen.getByText('Add credits').dataset.variant).toBe('inverted')
  })

  it('shows no in-use badge until the balance has loaded', () => {
    activeProSubscription()
    state.balance = null
    state.isLoading = true
    renderTile()
    expect(screen.queryByText('In use')).toBeNull()
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
