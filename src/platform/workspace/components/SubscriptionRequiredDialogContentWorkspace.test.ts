import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionDialogReason } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  Plan,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionRequiredDialogContentWorkspace from './SubscriptionRequiredDialogContentWorkspace.vue'

const {
  mockSubscribe,
  mockPreviewSubscribe,
  mockFetchStatus,
  mockFetchBalance,
  mockPlans,
  mockResubscribe,
  mockToastAdd
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockPreviewSubscribe: vi.fn(),
  mockFetchStatus: vi.fn(),
  mockFetchBalance: vi.fn(),
  mockPlans: {
    value: [
      {
        slug: 'standard-yearly',
        tier: 'STANDARD',
        duration: 'ANNUAL',
        price_cents: 1600,
        credits_cents: 4200,
        max_seats: 1,
        availability: { available: true },
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 1600,
          total_credits_cents: 4200
        }
      },
      {
        slug: 'creator-monthly',
        tier: 'CREATOR',
        duration: 'MONTHLY',
        price_cents: 3500,
        credits_cents: 7400,
        max_seats: 5,
        availability: { available: true },
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 3500,
          total_credits_cents: 7400
        }
      }
    ] as Plan[]
  },
  mockResubscribe: vi.fn(),
  mockToastAdd: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    plans: computed(() => mockPlans.value),
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance
  })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    resubscribe: mockResubscribe
  }
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { back: 'Back', close: 'Close' },
      subscription: {
        plansForWorkspace: 'Plans for {workspace}',
        teamWorkspace: 'Team',
        required: { pollingSuccess: 'Subscription activated!' },
        resubscribeSuccess: 'Resubscribed successfully!'
      },
      credits: {
        topUp: {
          insufficientTitle: 'Insufficient Credits',
          insufficientMessage: 'You have run out of credits.'
        }
      }
    }
  }
})

const PricingTableStub = {
  name: 'PricingTableWorkspace',
  template: `<div data-testid="pricing-table">
    <button data-testid="subscribe-standard-yearly" @click="$emit('subscribe', { tierKey: 'standard', billingCycle: 'yearly' })">Subscribe Standard</button>
    <button data-testid="subscribe-creator-monthly" @click="$emit('subscribe', { tierKey: 'creator', billingCycle: 'monthly' })">Subscribe Creator</button>
    <button data-testid="resubscribe-btn" @click="$emit('resubscribe')">Resubscribe</button>
  </div>`
}

const AddPaymentPreviewStub = {
  name: 'SubscriptionAddPaymentPreviewWorkspace',
  template: `<div data-testid="add-payment-preview">
    <button data-testid="add-card-btn" @click="$emit('addCreditCard')">Add Card</button>
  </div>`
}

const TransitionPreviewStub = {
  name: 'SubscriptionTransitionPreviewWorkspace',
  template: `<div data-testid="transition-preview">
    <button data-testid="confirm-transition-btn" @click="$emit('confirm')">Confirm</button>
  </div>`
}

function renderComponent(
  props: { onClose?: () => void; reason?: SubscriptionDialogReason } = {}
) {
  return render(SubscriptionRequiredDialogContentWorkspace, {
    props: {
      onClose: props.onClose ?? vi.fn(),
      ...(props.reason ? { reason: props.reason } : {})
    },
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn, stubActions: false }),
        i18n
      ],
      stubs: {
        PricingTableWorkspace: PricingTableStub,
        SubscriptionAddPaymentPreviewWorkspace: AddPaymentPreviewStub,
        SubscriptionTransitionPreviewWorkspace: TransitionPreviewStub
      }
    }
  })
}

function makePreviewResponse(
  overrides: Partial<PreviewSubscribeResponse> = {}
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2025-01-01',
    is_immediate: true,
    cost_today_cents: 1600,
    cost_next_period_cents: 1600,
    credits_today_cents: 4200,
    credits_next_period_cents: 4200,
    new_plan: {
      slug: 'standard-yearly',
      tier: 'STANDARD',
      duration: 'ANNUAL',
      price_cents: 1600,
      credits_cents: 4200,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 1600,
        total_credits_cents: 4200
      }
    },
    ...overrides
  }
}

async function clickSubscribeStandard() {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('subscribe-standard-yearly'))
}

async function clickSubscribeCreator() {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('subscribe-creator-monthly'))
}

describe('SubscriptionRequiredDialogContentWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial rendering', () => {
    it('shows pricing table on initial render', () => {
      renderComponent()
      expect(screen.getByTestId('pricing-table')).toBeInTheDocument()
      expect(
        screen.queryByTestId('add-payment-preview')
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('transition-preview')).not.toBeInTheDocument()
    })

    it('shows close button', () => {
      renderComponent()
      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })

    it('does not show back button on pricing step', () => {
      renderComponent()
      expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
    })

    it('shows insufficient credits message when reason is out_of_credits', () => {
      renderComponent({ reason: 'out_of_credits' })
      expect(screen.getByText('Insufficient Credits')).toBeInTheDocument()
      expect(
        screen.getByText('You have run out of credits.')
      ).toBeInTheDocument()
    })

    it('does not show insufficient credits message without reason', () => {
      renderComponent()
      expect(screen.queryByText('Insufficient Credits')).not.toBeInTheDocument()
    })
  })

  describe('close button', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderComponent({ onClose })

      await user.click(screen.getByLabelText('Close'))

      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('handleSubscribeClick — pricing to preview transition', () => {
    it('transitions to new subscription preview on successful preview', async () => {
      const preview = makePreviewResponse()
      mockPreviewSubscribe.mockResolvedValueOnce(preview)

      renderComponent()
      await clickSubscribeStandard()

      expect(mockPreviewSubscribe).toHaveBeenCalledWith('standard-yearly')
      await waitFor(() => {
        expect(screen.getByTestId('add-payment-preview')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('pricing-table')).not.toBeInTheDocument()
    })

    it('transitions to transition preview for upgrades', async () => {
      const preview = makePreviewResponse({ transition_type: 'upgrade' })
      mockPreviewSubscribe.mockResolvedValueOnce(preview)

      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(screen.getByTestId('transition-preview')).toBeInTheDocument()
      })
      expect(
        screen.queryByTestId('add-payment-preview')
      ).not.toBeInTheDocument()
    })

    it('shows toast and stays on pricing when preview is not allowed', async () => {
      mockPreviewSubscribe.mockResolvedValueOnce({
        allowed: false,
        reason: 'exceeds_max_seats'
      })

      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'exceeds_max_seats'
          })
        )
      })
      expect(screen.getByTestId('pricing-table')).toBeInTheDocument()
    })

    it('shows toast when plan slug is not found', async () => {
      const saved = mockPlans.value
      mockPlans.value = []

      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'This plan is not available'
          })
        )
      })

      mockPlans.value = saved
    })

    it('shows toast on previewSubscribe error', async () => {
      mockPreviewSubscribe.mockRejectedValueOnce(new Error('Network error'))

      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'Network error'
          })
        )
      })
    })

    it('uses monthly billing cycle when selected', async () => {
      const preview = makePreviewResponse()
      mockPreviewSubscribe.mockResolvedValueOnce(preview)

      renderComponent()
      await clickSubscribeCreator()

      await waitFor(() => {
        expect(mockPreviewSubscribe).toHaveBeenCalledWith('creator-monthly')
      })
    })
  })

  describe('back button on preview step', () => {
    it('shows back button and returns to pricing when clicked', async () => {
      const user = userEvent.setup()
      mockPreviewSubscribe.mockResolvedValueOnce(makePreviewResponse())

      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(screen.getByLabelText('Back')).toBeInTheDocument()
      })

      await user.click(screen.getByLabelText('Back'))

      await waitFor(() => {
        expect(screen.getByTestId('pricing-table')).toBeInTheDocument()
      })
      expect(
        screen.queryByTestId('add-payment-preview')
      ).not.toBeInTheDocument()
    })
  })

  describe('handleAddCreditCard — new subscription', () => {
    it('emits close with true when subscribe returns subscribed status', async () => {
      const user = userEvent.setup()
      mockPreviewSubscribe.mockResolvedValueOnce(makePreviewResponse())
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-1'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      const { emitted } = renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(screen.getByTestId('add-card-btn')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('add-card-btn'))

      await waitFor(() => {
        expect(mockSubscribe).toHaveBeenCalledWith(
          'standard-yearly',
          'https://platform.comfy.org/payment/success',
          'https://platform.comfy.org/payment/failed'
        )
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'success' })
        )
        expect(emitted().close?.[0]).toEqual([true])
      })
    })

    it('opens payment URL when subscribe returns needs_payment_method', async () => {
      const user = userEvent.setup()
      mockPreviewSubscribe.mockResolvedValueOnce(makePreviewResponse())
      mockSubscribe.mockResolvedValueOnce({
        status: 'needs_payment_method',
        billing_op_id: 'op-2',
        payment_method_url: 'https://stripe.com/pay'
      })

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(screen.getByTestId('add-card-btn')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('add-card-btn'))

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith('https://stripe.com/pay', '_blank')
      })
      openSpy.mockRestore()
    })

    it('shows error toast when subscribe throws', async () => {
      const user = userEvent.setup()
      mockPreviewSubscribe.mockResolvedValueOnce(makePreviewResponse())
      mockSubscribe.mockRejectedValueOnce(new Error('Payment failed'))

      renderComponent()
      await clickSubscribeStandard()

      await waitFor(() => {
        expect(screen.getByTestId('add-card-btn')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('add-card-btn'))

      await waitFor(() => {
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'Payment failed'
          })
        )
      })
    })
  })

  describe('handleConfirmTransition — plan change', () => {
    async function navigateToTransitionPreview() {
      mockPreviewSubscribe.mockResolvedValueOnce(
        makePreviewResponse({ transition_type: 'upgrade' })
      )
      await clickSubscribeStandard()
      await waitFor(() => {
        expect(screen.getByTestId('transition-preview')).toBeInTheDocument()
      })
    }

    it('emits close with true when transition succeeds', async () => {
      const user = userEvent.setup()
      mockSubscribe.mockResolvedValueOnce({
        status: 'subscribed',
        billing_op_id: 'op-3'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      const { emitted } = renderComponent()
      await navigateToTransitionPreview()

      await user.click(screen.getByTestId('confirm-transition-btn'))

      await waitFor(() => {
        expect(mockSubscribe).toHaveBeenCalledWith(
          'standard-yearly',
          'https://platform.comfy.org/payment/success',
          'https://platform.comfy.org/payment/failed'
        )
        expect(emitted().close?.[0]).toEqual([true])
      })
    })

    it('shows error toast when transition throws', async () => {
      const user = userEvent.setup()
      mockSubscribe.mockRejectedValueOnce(new Error('Transition error'))

      renderComponent()
      await navigateToTransitionPreview()

      await user.click(screen.getByTestId('confirm-transition-btn'))

      await waitFor(() => {
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'Transition error'
          })
        )
      })
    })
  })

  describe('handleResubscribe', () => {
    it('emits close with true on successful resubscribe', async () => {
      const user = userEvent.setup()
      mockResubscribe.mockResolvedValueOnce({
        billing_op_id: 'op-4',
        status: 'active'
      })
      mockFetchStatus.mockResolvedValueOnce(undefined)
      mockFetchBalance.mockResolvedValueOnce(undefined)

      const { emitted } = renderComponent()
      await user.click(screen.getByTestId('resubscribe-btn'))

      await waitFor(() => {
        expect(mockResubscribe).toHaveBeenCalled()
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'success' })
        )
        expect(emitted().close?.[0]).toEqual([true])
      })
    })

    it('shows error toast on resubscribe failure', async () => {
      const user = userEvent.setup()
      mockResubscribe.mockRejectedValueOnce(new Error('Resubscribe failed'))

      renderComponent()
      await user.click(screen.getByTestId('resubscribe-btn'))

      await waitFor(() => {
        expect(mockToastAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            detail: 'Resubscribe failed'
          })
        )
      })
    })
  })
})
