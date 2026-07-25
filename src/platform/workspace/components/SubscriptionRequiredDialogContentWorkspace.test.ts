import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { PaymentIntentSource } from '@/platform/telemetry/types'

import SubscriptionRequiredDialogContentWorkspace from './SubscriptionRequiredDialogContentWorkspace.vue'

const mockHandleSubscribeClick = vi.fn()
const mockHandleBackToPricing = vi.fn()
const mockHandleAddCreditCard = vi.fn()
const mockHandleConfirmTransition = vi.fn()
const mockHandleResubscribe = vi.fn()
const mockHandleSuccessClose = vi.fn()
const mockCheckoutStep = ref<'pricing' | 'preview' | 'success'>('pricing')
const mockPreviewData = ref<{ transition_type: string } | null>(null)
const mockUseSubscriptionCheckout = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workspace/composables/useSubscriptionCheckout', () => ({
  useSubscriptionCheckout: mockUseSubscriptionCheckout
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { back: 'Back', close: 'Close' },
      subscription: {
        plansForWorkspace: 'Plans for {workspace}',
        teamWorkspace: 'Team Workspace',
        personalWorkspace: 'Personal Workspace'
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
    <button data-testid="subscribe-btn" @click="$emit('subscribe', { tierKey: 'standard', billingCycle: 'yearly' })">Subscribe</button>
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
    <button data-testid="confirm-btn" @click="$emit('confirm')">Confirm</button>
  </div>`
}

const SuccessStub = {
  name: 'SubscriptionSuccessWorkspace',
  template: `<div data-testid="success">
    <button data-testid="success-close-btn" @click="$emit('close')">Done</button>
  </div>`
}

function renderComponent(
  props: {
    onClose?: () => void
    reason?: PaymentIntentSource
    isPersonal?: boolean
  } = {}
) {
  return render(SubscriptionRequiredDialogContentWorkspace, {
    props: {
      onClose: props.onClose ?? vi.fn(),
      ...(props.reason ? { reason: props.reason } : {}),
      ...(props.isPersonal !== undefined
        ? { isPersonal: props.isPersonal }
        : {})
    },
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn, stubActions: false }),
        i18n
      ],
      stubs: {
        PricingTableWorkspace: PricingTableStub,
        SubscriptionAddPaymentPreviewWorkspace: AddPaymentPreviewStub,
        SubscriptionTransitionPreviewWorkspace: TransitionPreviewStub,
        SubscriptionSuccessWorkspace: SuccessStub
      }
    }
  })
}

describe('SubscriptionRequiredDialogContentWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSubscriptionCheckout.mockReturnValue({
      checkoutStep: mockCheckoutStep,
      isLoadingPreview: ref(false),
      loadingTier: ref(null),
      isSubscribing: ref(false),
      isResubscribing: ref(false),
      previewData: mockPreviewData,
      selectedTierKey: ref('standard'),
      selectedBillingCycle: ref('yearly'),
      isPolling: ref(false),
      handleSubscribeClick: mockHandleSubscribeClick,
      handleBackToPricing: mockHandleBackToPricing,
      handleAddCreditCard: mockHandleAddCreditCard,
      handleConfirmTransition: mockHandleConfirmTransition,
      handleResubscribe: mockHandleResubscribe,
      handleSuccessClose: mockHandleSuccessClose
    })
    mockCheckoutStep.value = 'pricing'
    mockPreviewData.value = null
  })

  it('shows pricing table on pricing step', () => {
    renderComponent()
    expect(screen.getByTestId('pricing-table')).toBeInTheDocument()
    expect(screen.queryByTestId('add-payment-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transition-preview')).not.toBeInTheDocument()
  })

  it('passes the reason into subscription checkout', () => {
    renderComponent({ reason: 'out_of_credits' })

    expect(mockUseSubscriptionCheckout).toHaveBeenCalledWith(
      expect.any(Function),
      'out_of_credits',
      { tierPlanType: 'team' }
    )
  })

  it('marks the legacy Personal table as a personal-plan target', () => {
    renderComponent({ isPersonal: true })

    expect(mockUseSubscriptionCheckout).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      { tierPlanType: 'personal' }
    )
  })

  it('shows the team workspace header by default', () => {
    renderComponent()
    expect(screen.getByText('Team Workspace')).toBeInTheDocument()
    expect(screen.queryByText('Personal Workspace')).not.toBeInTheDocument()
  })

  it('shows the personal workspace header for a single-seat context', () => {
    renderComponent({ isPersonal: true })
    expect(screen.getByText('Personal Workspace')).toBeInTheDocument()
    expect(screen.queryByText('Team Workspace')).not.toBeInTheDocument()
  })

  it('shows close button and hides back button on pricing step', () => {
    renderComponent()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
    expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderComponent({ onClose })

    await user.click(screen.getByLabelText('Close'))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows back button on preview step', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewData.value = { transition_type: 'new_subscription' }
    renderComponent()
    expect(screen.getByLabelText('Back')).toBeInTheDocument()
  })

  it('shows insufficient credits message when reason is out_of_credits', () => {
    renderComponent({ reason: 'out_of_credits' })
    expect(screen.getByText('Insufficient Credits')).toBeInTheDocument()
    expect(screen.getByText('You have run out of credits.')).toBeInTheDocument()
  })

  it('does not show insufficient credits message without reason', () => {
    renderComponent()
    expect(screen.queryByText('Insufficient Credits')).not.toBeInTheDocument()
  })

  it('shows new subscription preview when transition_type is new_subscription', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewData.value = { transition_type: 'new_subscription' }
    renderComponent()
    expect(screen.getByTestId('add-payment-preview')).toBeInTheDocument()
    expect(screen.queryByTestId('transition-preview')).not.toBeInTheDocument()
  })

  it('shows transition preview when transition_type is upgrade', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewData.value = { transition_type: 'upgrade' }
    renderComponent()
    expect(screen.getByTestId('transition-preview')).toBeInTheDocument()
    expect(screen.queryByTestId('add-payment-preview')).not.toBeInTheDocument()
  })

  it('wires subscribe event to handleSubscribeClick', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('subscribe-btn'))

    expect(mockHandleSubscribeClick).toHaveBeenCalledWith({
      tierKey: 'standard',
      billingCycle: 'yearly'
    })
  })

  it('wires resubscribe event to handleResubscribe', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('resubscribe-btn'))

    expect(mockHandleResubscribe).toHaveBeenCalled()
  })

  it('wires back button to handleBackToPricing', async () => {
    const user = userEvent.setup()
    mockCheckoutStep.value = 'preview'
    mockPreviewData.value = { transition_type: 'new_subscription' }
    renderComponent()

    await user.click(screen.getByLabelText('Back'))

    expect(mockHandleBackToPricing).toHaveBeenCalled()
  })

  it('shows the success screen on the success step', () => {
    mockCheckoutStep.value = 'success'
    renderComponent()
    expect(screen.getByTestId('success')).toBeInTheDocument()
    expect(screen.queryByTestId('pricing-table')).not.toBeInTheDocument()
  })

  it('wires the success close event to handleSuccessClose', async () => {
    const user = userEvent.setup()
    mockCheckoutStep.value = 'success'
    renderComponent()

    await user.click(screen.getByTestId('success-close-btn'))

    expect(mockHandleSuccessClose).toHaveBeenCalled()
  })
})
