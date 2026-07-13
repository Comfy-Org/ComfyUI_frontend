import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  BillingStatus,
  BillingSubscriptionStatus,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import BillingStatusBanner from '@/platform/workspace/components/BillingStatusBanner.vue'

interface Subscription {
  hasFunds: boolean
  isCancelled: boolean
  endDate: string | null
}

const state = vi.hoisted(() => ({
  isActiveSubscription: true,
  billingStatus: 'paid' as string | null,
  subscriptionStatus: 'active' as string | null,
  subscription: {
    hasFunds: true,
    isCancelled: false,
    endDate: null
  } as Subscription | null,
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

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: computed(() => state.isActiveSubscription),
    billingStatus: computed(() => state.billingStatus as BillingStatus | null),
    subscriptionStatus: computed(
      () => state.subscriptionStatus as BillingSubscriptionStatus | null
    ),
    subscription: computed(() => state.subscription),
    renewalDate: computed(() => state.renewalDate),
    manageSubscription: state.manageSubscription
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
            title: 'Payment declined',
            body: "Your last payment didn't go through. Your subscription will pause on {date} unless payment is updated.",
            bodyNoDate:
              "Your last payment didn't go through. Update payment to avoid a pause."
          },
          paused: {
            title: 'Subscription paused',
            body: "This workspace's subscription is paused. Update payment to resume.",
            memberBody:
              "This workspace's subscription is paused. Your workspace admins need to update the payment method."
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
          updatePayment: 'Update payment'
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

describe('BillingStatusBanner', () => {
  beforeEach(() => {
    state.isActiveSubscription = true
    state.billingStatus = 'paid'
    state.subscriptionStatus = 'active'
    state.subscription = { hasFunds: true, isCancelled: false, endDate: null }
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

  it('shares one dismiss across every mount (graph + linear shells)', async () => {
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
    state.subscriptionStatus = 'paused'
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
    state.subscriptionStatus = 'paused'
    state.canManageSubscription = false
    state.canTopUp = false
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your workspace admins need to update the payment method'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the payment-declined banner with Update payment for owners', () => {
    state.billingStatus = 'payment_failed'
    state.renewalDate = '2026-08-01T00:00:00Z'
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Payment declined')
    expect(screen.getByRole('status')).toHaveTextContent(/will pause on \S+/)
    expect(screen.getByRole('status')).not.toHaveTextContent('{date}')
    expect(
      screen.getByRole('button', { name: 'Update payment' })
    ).toBeInTheDocument()
  })

  it('falls back to the no-date payment-declined copy when there is no renewal date', () => {
    state.billingStatus = 'payment_failed'
    state.renewalDate = null
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Update payment to avoid a pause'
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('will pause on')
    expect(screen.getByRole('status')).not.toHaveTextContent('{date}')
  })

  it('shows the ending banner with a Reactivate action', async () => {
    state.subscriptionStatus = 'canceled'
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

  it('shows the ending banner read-only to a non-original owner (Reactivate is lifecycle-gated)', () => {
    state.subscriptionStatus = 'canceled'
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z'
    }
    state.canManageSubscriptionLifecycle = false
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your team plan ends on'
    )
    expect(
      screen.queryByRole('button', { name: 'Reactivate plan' })
    ).not.toBeInTheDocument()
  })
})
