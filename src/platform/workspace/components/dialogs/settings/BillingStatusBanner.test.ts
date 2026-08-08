import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  BillingStatus,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'

const mockV1PaymentRecovery = ref(true)
const mockBillingStatus = ref<BillingStatus | null>('paid')
const mockCanManageSubscription = ref(true)

interface Subscription {
  hasFunds: boolean
  isCancelled: boolean
  endDate: string | null
}

const state = vi.hoisted(() => ({
  billingControlEnabled: true,
  isActiveSubscription: true,
  isTeamPlan: true,
  subscription: {
    hasFunds: true,
    isCancelled: false,
    endDate: null
  } as Subscription | null,
  renewalDate: null as string | null,
  workspaceType: 'team' as string,
  canManageSubscriptionLifecycle: true,
  canTopUp: true,
  showTopUpCreditsDialog: vi.fn(),
  manageSubscription: vi.fn().mockResolvedValue(undefined),
  toastErrorHandler: vi.fn(),
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
        return mockV1PaymentRecovery.value
      }
    }
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: computed(() => state.isActiveSubscription),
    isTeamPlan: computed(() => state.isTeamPlan),
    billingStatus: computed(() => mockBillingStatus.value),
    subscription: computed(() => state.subscription),
    renewalDate: computed(() => state.renewalDate),
    manageSubscription: state.manageSubscription,
    fetchStatus: vi.fn(),
    fetchBalance: vi.fn()
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: state.toastErrorHandler })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: mockCanManageSubscription.value,
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
          recoveryWarning: {
            title: 'Payment failed',
            bodyNoDate:
              'Your payment failed to process. Update payment to avoid a pause.'
          },
          recoveryPaused: {
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

// The spend gate folds billing_status into is_active, so the backend never emits
// paused alongside an active subscription.
function pausedState() {
  mockBillingStatus.value = 'paused'
  state.isActiveSubscription = false
}

function paymentFailedState() {
  mockBillingStatus.value = 'payment_failed'
  state.isActiveSubscription = false
}

describe('BillingStatusBanner', () => {
  beforeEach(() => {
    state.billingControlEnabled = true
    mockV1PaymentRecovery.value = true
    mockCanManageSubscription.value = true
    state.isActiveSubscription = true
    state.isTeamPlan = true
    mockBillingStatus.value = 'paid'
    state.subscription = { hasFunds: true, isCancelled: false, endDate: null }
    state.renewalDate = null
    state.workspaceType = 'team'
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
    mockCanManageSubscription.value = false
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
    mockCanManageSubscription.value = false
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
    mockCanManageSubscription.value = false
    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Update payment' })
    ).not.toBeInTheDocument()
    expect(state.manageSubscription).not.toHaveBeenCalled()
  })

  it('blocks stale payment controls immediately after permission loss', async () => {
    paymentFailedState()
    renderBanner()
    const updatePayment = screen.getByRole('button', {
      name: 'Update payment'
    })

    mockCanManageSubscription.value = false
    updatePayment.click()

    expect(state.manageSubscription).not.toHaveBeenCalled()
    await nextTick()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('hides recovery banners when payment recovery is off', () => {
    mockV1PaymentRecovery.value = false
    paymentFailedState()
    const { unmount } = renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()

    pausedState()
    renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps non-recovery banners when payment recovery is off', () => {
    mockV1PaymentRecovery.value = false
    mockBillingStatus.value = 'paid'
    exhausted()

    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Out of credits')
  })

  it('surfaces a rejected recovery portal request', async () => {
    const error = new Error('portal failed')
    state.manageSubscription.mockRejectedValueOnce(error)
    pausedState()
    renderBanner()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )

    await waitFor(() =>
      expect(state.toastErrorHandler).toHaveBeenCalledWith(error)
    )
  })

  it.for([
    {
      reason: 'its flag is rolled back',
      invalidate: () => {
        mockV1PaymentRecovery.value = false
      },
      assertInvalidated: () =>
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    },
    {
      reason: 'the owner loses permission',
      invalidate: () => {
        mockCanManageSubscription.value = false
      },
      assertInvalidated: () =>
        expect(
          screen.queryByRole('button', { name: 'Update payment' })
        ).not.toBeInTheDocument()
    },
    {
      reason: 'billing recovers',
      invalidate: () => {
        mockBillingStatus.value = 'paid'
        state.isActiveSubscription = true
      },
      assertInvalidated: () =>
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    }
  ])(
    'aborts a recovery portal request when $reason',
    async ({ invalidate, assertInvalidated }) => {
      state.manageSubscription.mockReturnValueOnce(new Promise(() => {}))
      pausedState()
      renderBanner()

      await userEvent.click(
        screen.getByRole('button', { name: 'Update payment' })
      )
      const signal = state.manageSubscription.mock.calls[0][0]
      expect(signal).toBeInstanceOf(AbortSignal)

      invalidate()
      await nextTick()

      expect(signal.aborted).toBe(true)
      assertInvalidated()
    }
  )

  it('aborts a recovery banner portal request on unmount', async () => {
    state.manageSubscription.mockReturnValueOnce(new Promise(() => {}))
    pausedState()
    const { unmount } = renderBanner()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )
    const signal = state.manageSubscription.mock.calls[0][0]
    expect(signal).toBeInstanceOf(AbortSignal)

    unmount()

    expect(signal.aborted).toBe(true)
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

  it('does not expose reactivation controls to a member', () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z'
    }
    mockCanManageSubscription.value = false
    state.canManageSubscriptionLifecycle = false
    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reactivate plan' })
    ).not.toBeInTheDocument()
  })
})
