import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionRequiredDialogContentUnified from './SubscriptionRequiredDialogContentUnified.vue'

const mockHandleSubscribeTeamClick = vi.fn()
const mockHandleSubscribeClick = vi.fn()
const mockIsInPersonalWorkspace = ref(false)
const mockCheckoutStep = ref('pricing')
const mockPreviewVariant = ref<string | null>(null)
const mockPreviewData = ref<Record<string, unknown> | null>(null)
const mockSelectedTeamStop = ref<Record<string, unknown> | null>(null)

vi.mock('@/platform/workspace/composables/useSubscriptionCheckout', () => ({
  useSubscriptionCheckout: () => ({
    checkoutStep: mockCheckoutStep,
    isLoadingPreview: ref(false),
    loadingTier: ref(null),
    isSubscribing: ref(false),
    isResubscribing: ref(false),
    previewData: mockPreviewData,
    quoteIsCurrent: ref(false),
    savedPaymentMethods: ref([]),
    selectedSavedPaymentMethodId: ref(null),
    selectedTierKey: ref(null),
    selectedTeamStop: mockSelectedTeamStop,
    selectedBillingCycle: ref('yearly'),
    activeCheckoutActionUrl: ref(null),
    authenticationState: ref(null),
    authenticationError: ref(null),
    canRetryAuthentication: ref(false),
    isAuthenticating: ref(false),
    reconciliationOperationId: ref(null),
    isPolling: ref(false),
    isTeamCheckout: computed(() => false),
    previewVariant: computed(() => mockPreviewVariant.value),
    handleSubscribeClick: mockHandleSubscribeClick,
    handleSubscribeTeamClick: mockHandleSubscribeTeamClick,
    handleBackToPricing: vi.fn(),
    handleSuccessClose: vi.fn(),
    handleAddCreditCard: vi.fn(),
    handleConfirmTransition: vi.fn(),
    handleTeamSubscribe: vi.fn(),
    handleSubscriptionPayment: vi.fn(),
    handleTeamSubscriptionPayment: vi.fn(),
    retryPaymentAuthentication: vi.fn(),
    applyPromotionCode: vi.fn(),
    invalidateQuote: vi.fn(),
    handleResubscribe: vi.fn()
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get isInPersonalWorkspace() {
      return mockIsInPersonalWorkspace.value
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { back: 'Back', close: 'Close' },
      subscription: { descriptionWorkspace: 'Choose your plan' }
    }
  }
})

const TEAM_PAYLOAD = {
  stop: { id: 'stop_1', usd: 700, credits: 70000, discountedUsd: 560 },
  billingCycle: 'yearly'
}

const UnifiedPricingTableStub = {
  name: 'UnifiedPricingTable',
  emits: ['subscribeTeam'],
  template: `<div>
    <button data-testid="subscribe-team-btn" @click="$emit('subscribeTeam', payload)">Team</button>
  </div>`,
  setup() {
    return { payload: TEAM_PAYLOAD }
  }
}

function renderComponent(props: Record<string, unknown> = {}) {
  return render(SubscriptionRequiredDialogContentUnified, {
    props: { onClose: vi.fn(), ...props },
    global: {
      plugins: [i18n],
      stubs: {
        UnifiedPricingTable: UnifiedPricingTableStub,
        SubscriptionAddPaymentPreviewWorkspace: {
          name: 'SubscriptionAddPaymentPreviewWorkspace',
          props: ['previewData', 'teamPlan'],
          template:
            '<div data-testid="add-payment-preview">{{ previewData?.amount_due_cents ?? "no-quote" }}</div>'
        },
        SubscriptionTransitionPreviewWorkspace: { template: '<div />' },
        SubscriptionSuccessWorkspace: { template: '<div />' }
      }
    }
  })
}

describe('SubscriptionRequiredDialogContentUnified team-plan subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInPersonalWorkspace.value = false
    mockCheckoutStep.value = 'pricing'
    mockPreviewVariant.value = null
    mockPreviewData.value = null
    mockSelectedTeamStop.value = null
  })

  // The team checkout mounts the payment element against the quote's amount, so
  // omitting preview-data left the element with nothing to charge and it
  // refused to render — a served, correctly priced quote presented as
  // "Payment options are unavailable".
  it('hands the team checkout its quote so the payment element can mount', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'team-new'
    mockSelectedTeamStop.value = TEAM_PAYLOAD.stop
    mockPreviewData.value = { amount_due_cents: 129_500, currency: 'usd' }

    renderComponent()

    expect(screen.getByTestId('add-payment-preview')).toHaveTextContent(
      '129500'
    )
  })

  it('advances to team checkout from a team workspace', async () => {
    const user = userEvent.setup()
    mockIsInPersonalWorkspace.value = false
    renderComponent()

    await user.click(screen.getByTestId('subscribe-team-btn'))

    await vi.waitFor(() => {
      expect(mockHandleSubscribeTeamClick).toHaveBeenCalledWith(TEAM_PAYLOAD)
    })
  })

  it('advances to team checkout from a personal workspace (no reroute)', async () => {
    const user = userEvent.setup()
    mockIsInPersonalWorkspace.value = true
    renderComponent()

    await user.click(screen.getByTestId('subscribe-team-btn'))

    await vi.waitFor(() => {
      expect(mockHandleSubscribeTeamClick).toHaveBeenCalledWith(TEAM_PAYLOAD)
    })
  })

  it('opens the selected personal plan confirmation on mount', async () => {
    renderComponent({
      initialCheckout: {
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      }
    })

    await vi.waitFor(() => {
      expect(mockHandleSubscribeClick).toHaveBeenCalledWith({
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      })
    })
  })

  it('opens a resolved Team stop confirmation on mount', async () => {
    renderComponent({
      initialCheckout: {
        planMode: 'team',
        stop: TEAM_PAYLOAD.stop,
        billingCycle: TEAM_PAYLOAD.billingCycle
      }
    })

    await vi.waitFor(() => {
      expect(mockHandleSubscribeTeamClick).toHaveBeenCalledWith({
        planMode: 'team',
        stop: TEAM_PAYLOAD.stop,
        billingCycle: TEAM_PAYLOAD.billingCycle
      })
    })
    expect(mockHandleSubscribeClick).not.toHaveBeenCalled()
  })
})
