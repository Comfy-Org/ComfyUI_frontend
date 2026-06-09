import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'

type Balance = {
  amountMicros: number
  cloudCreditBalanceMicros?: number
  prepaidBalanceMicros?: number
}
type Subscription = {
  tier: string | null
  duration: string | null
  renewalDate: string | null
}

const state = vi.hoisted(() => ({
  balance: null as Balance | null,
  subscription: null as Subscription | null,
  isActiveSubscription: false,
  isFreeTier: false,
  isLoading: false,
  canTopUp: true,
  fetchBalance: vi.fn(),
  fetchStatus: vi.fn(),
  showPricingTable: vi.fn(),
  showTopUpCreditsDialog: vi.fn(),
  trackAddApiCreditButtonClicked: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    balance: computed(() => state.balance),
    subscription: computed(() => state.subscription),
    isActiveSubscription: computed(() => state.isActiveSubscription),
    isFreeTier: computed(() => state.isFreeTier),
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
        monthlyRefills: 'Monthly (refills {date})',
        creditsOfTotal: '{remaining} of {total}',
        monthlyRemainingSummary: '{remaining} of {total} monthly remaining',
        creditsYouveAdded: 'Additional',
        additionalCreditsTooltip: 'Credits you have added.',
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
            '<button v-bind="$attrs" :disabled="loading" @click="$emit(\'click\')"><slot/></button>',
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

  it('renders the monthly and additional breakdown against the tier allowance', () => {
    activeProSubscription()
    const { container } = renderTile()
    // PRO monthly allowance = 21,100 credits
    expect(container.textContent).toContain('422 of 21,100')
    expect(container.textContent).toMatch(/Monthly \(refills Feb/)
    expect(container.textContent).toContain('Additional')
    expect(container.textContent).toContain('633')
    expect(container.textContent).toContain('422 of 21.1K monthly remaining')
  })

  it('hides the breakdown and forces zeros in the zero state', () => {
    activeProSubscription()
    const { container } = renderTile({ zeroState: true })
    expect(container.textContent).toContain('0')
    expect(container.textContent).not.toContain('422 of 21,100')
    expect(screen.queryByText('Add credits')).toBeNull()
  })

  it('shows only the balance with no breakdown when there is no active subscription', () => {
    state.isActiveSubscription = false
    state.balance = { amountMicros: 500 }
    const { container } = renderTile()
    expect(container.textContent).toContain('1,055')
    expect(container.textContent).not.toContain('monthly remaining')
    expect(screen.queryByText('Add credits')).toBeNull()
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
})
