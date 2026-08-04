import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  BillingStatus,
  Plan,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'

interface Subscription {
  hasFunds: boolean
  isCancelled: boolean
  endDate: string | null
  scheduledPlanSlug?: string | null
  changeAt?: string | null
}

const creatorAnnualPlan: Plan = {
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 33600,
  credits_cents: 12000,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 33600,
    total_credits_cents: 12000
  }
}

const state = vi.hoisted(() => ({
  billingControlEnabled: true,
  v1PaymentRecovery: true,
  isActiveSubscription: true,
  isTeamPlan: true,
  billingStatus: 'paid' as string | null,
  subscription: {
    hasFunds: true,
    isCancelled: false,
    endDate: null
  } as Subscription | null,
  plans: [] as Plan[],
  renewalDate: null as string | null,
  workspaceType: 'team' as string,
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canTopUp: true,
  showTopUpCreditsDialog: vi.fn(),
  manageSubscription: vi.fn(),
  handleResubscribe: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingControlEnabled() {
        return state.billingControlEnabled
      },
      get v1PaymentRecovery() {
        return state.v1PaymentRecovery
      }
    }
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: computed(() => state.isActiveSubscription),
    isTeamPlan: computed(() => state.isTeamPlan),
    billingStatus: computed(() => state.billingStatus as BillingStatus | null),
    subscription: computed(() => state.subscription),
    plans: computed(() => state.plans),
    renewalDate: computed(() => state.renewalDate),
    manageSubscription: state.manageSubscription,
    fetchStatus: vi.fn(),
    fetchBalance: vi.fn()
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: state.canManageSubscription,
      canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle,
      canTopUp: state.canTopUp
    })),
    workspaceType: computed(() => state.workspaceType as WorkspaceType)
  })
}))

vi.mock('@/platform/workspace/composables/useResubscribe', () => ({
  useResubscribe: () => ({
    isResubscribing: computed(() => false),
    handleResubscribe: state.handleResubscribe
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: state.showTopUpCreditsDialog
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspacePanel: {
        billingStatus: {
          warning: {
            title: 'Payment failed',
            bodyNoDate:
              'Your payment failed to process. Update payment to avoid a pause.'
          },
          paused: {
            title: 'Subscription paused',
            body: "This workspace's subscription is paused. Update payment to resume.",
            memberBody:
              "Ask your workspace owner to restore the workspace's subscription."
          },
          outOfCredits: {
            title: 'Out of credits',
            body: 'Your team has used all its credits. Add more credits to continue generating or wait until credits refill on {date}.',
            bodyNoDate:
              'Your team has used all its credits. Add more credits to continue generating.',
            memberBody:
              'Your team has used all its credits. Your workspace admins need to add more credits to continue generating.',
            addCredits: 'Add credits',
            dismiss: 'Dismiss'
          },
          ending: {
            title: 'Your team plan ends on {date}',
            body: 'Members keep full access until then. Reactivate to keep your shared credits and seats.',
            reactivate: 'Reactivate plan'
          },
          planChange: {
            title: 'Your plan changes to {plan} on {date}.',
            body: "We'll automatically charge {amount} to your card on file."
          },
          updatePayment: 'Update payment'
        }
      },
      subscription: {
        tierNameYearly: '{name} Yearly',
        tiers: {
          creator: { name: 'Creator' }
        }
      }
    }
  }
})

const globalOptions = {
  plugins: [i18n],
  stubs: {
    Button: {
      template:
        '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>',
      props: ['variant', 'size', 'loading'],
      emits: ['click']
    }
  }
}

function renderBanner() {
  return render(BillingStatusBanner, { global: globalOptions })
}

function exhausted() {
  state.subscription = { hasFunds: false, isCancelled: false, endDate: null }
}

// The spend gate folds billing_status into is_active, so the backend never emits
// paused alongside an active subscription.
function pausedState() {
  state.billingStatus = 'paused'
  state.isActiveSubscription = false
}

function paymentFailedState() {
  state.billingStatus = 'payment_failed'
  state.isActiveSubscription = false
}

describe('BillingStatusBanner', () => {
  beforeEach(() => {
    state.billingControlEnabled = true
    state.v1PaymentRecovery = true
    state.isActiveSubscription = true
    state.isTeamPlan = true
    state.billingStatus = 'paid'
    state.subscription = { hasFunds: true, isCancelled: false, endDate: null }
    state.plans = [creatorAnnualPlan]
    state.renewalDate = null
    state.workspaceType = 'team'
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    state.canTopUp = true
    vi.clearAllMocks()
  })

  it('renders nothing for a healthy funded team', () => {
    renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders nothing when billing control is rolled back, even out of credits', () => {
    state.billingControlEnabled = false
    state.subscription = { hasFunds: false, isCancelled: false, endDate: null }
    renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows out-of-credits with an Add credits action for owners', async () => {
    state.subscription = { hasFunds: false, isCancelled: false, endDate: null }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Out of credits')
    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))
    expect(state.showTopUpCreditsDialog).toHaveBeenCalledTimes(1)
  })

  it('shows out-of-credits contact-admin copy without an Add credits action for members', () => {
    state.subscription = { hasFunds: false, isCancelled: false, endDate: null }
    state.canManageSubscription = false
    state.canTopUp = false
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your workspace admins need to add more credits'
    )
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('dismisses the out-of-credits banner for the session', async () => {
    exhausted()
    renderBanner()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shares one dismiss across instances rather than tracking it per mount', async () => {
    exhausted()
    render(
      {
        components: { BillingStatusBanner },
        template: '<div><BillingStatusBanner /><BillingStatusBanner /></div>'
      },
      { global: globalOptions }
    )

    expect(screen.getAllByRole('status')).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the paused banner with Update payment for owners', async () => {
    pausedState()
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Subscription paused')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Update payment to resume'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )
    expect(state.manageSubscription).toHaveBeenCalledTimes(1)
  })

  it('shows the paused member notice without an action', () => {
    pausedState()
    state.canManageSubscription = false
    state.canTopUp = false
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      "Ask your workspace owner to restore the workspace's subscription"
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows immediate payment-failed copy with Update payment for owners', () => {
    paymentFailedState()
    state.renewalDate = '2026-08-01T00:00:00Z'
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Payment failed')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Update payment to avoid a pause'
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('will pause on')
    expect(
      screen.getByRole('button', { name: 'Update payment' })
    ).toBeInTheDocument()
  })

  it('does not expose payment controls to members', () => {
    paymentFailedState()
    state.canManageSubscription = false
    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Update payment' })
    ).not.toBeInTheDocument()
    expect(state.manageSubscription).not.toHaveBeenCalled()
  })

  it('hides payment recovery states while preserving existing notices when the new flag is off', () => {
    state.v1PaymentRecovery = false
    paymentFailedState()
    const { unmount } = renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()

    state.isActiveSubscription = true
    state.billingStatus = 'paid'
    exhausted()
    renderBanner()
    expect(screen.getByRole('status')).toHaveTextContent('Out of credits')
  })

  it('lets a promoted owner reactivate an ending plan', async () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z'
    }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your team plan ends on'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reactivate plan' })
    )
    expect(state.handleResubscribe).toHaveBeenCalledTimes(1)
  })

  it('shows the scheduled plan, effective date, and automatic charge', () => {
    state.isTeamPlan = false
    state.subscription = {
      hasFunds: true,
      isCancelled: false,
      endDate: null,
      scheduledPlanSlug: 'creator-annual',
      changeAt: '2026-08-03T00:00:00Z'
    }

    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your plan changes to Creator Yearly on August 3, 2026.'
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      "We'll automatically charge $336.00 to your card on file."
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides a scheduled change whose destination plan cannot be resolved', () => {
    state.isTeamPlan = false
    state.subscription = {
      hasFunds: true,
      isCancelled: false,
      endDate: null,
      scheduledPlanSlug: 'missing-plan',
      changeAt: '2026-08-03T00:00:00Z'
    }

    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not expose reactivation controls to a member', () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z'
    }
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reactivate plan' })
    ).not.toBeInTheDocument()
  })
})
