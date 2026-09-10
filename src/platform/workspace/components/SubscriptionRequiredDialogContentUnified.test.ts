import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionRequiredDialogContentUnified from './SubscriptionRequiredDialogContentUnified.vue'

// The complete production contract (quote identity included): the payment
// preview refuses to mount the payment element on a quote without
// `quote_id`/`quote_version`, so a partial stub could pass while production
// renders no payment element.
function makePreview(
  overrides: Partial<PreviewSubscribeResponse> = {}
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-06-19T00:00:00Z',
    is_immediate: true,
    cost_today_cents: 129_500,
    cost_next_period_cents: 129_500,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    quote_id: 'quote_123',
    quote_version: 1,
    amount_due_cents: 129_500,
    currency: 'usd',
    renewal_amount_cents: 129_500,
    renewal_at: '2027-06-19T00:00:00Z',
    new_plan: {
      slug: 'team-yearly',
      tier: 'PRO',
      duration: 'ANNUAL',
      price_cents: 129_500,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 129_500,
        total_credits_cents: 0
      },
      period_end: '2027-06-19T00:00:00Z'
    },
    ...overrides
  }
}

const mockHandleSubscribeTeamClick = vi.fn()
const mockHandleSubscribeClick = vi.fn()
const mockInvalidateQuote = vi.fn()
const mockIsInPersonalWorkspace = ref(false)
const mockCheckoutStep = ref('pricing')
const mockPreviewVariant = ref<string | null>(null)
const mockPreviewData = ref<PreviewSubscribeResponse | null>(null)
const mockSelectedTeamStop = ref<Record<string, unknown> | null>(null)
const mockSelectedSavedPaymentMethodId = ref<string | null>('pm_default')

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
    selectedSavedPaymentMethodId: mockSelectedSavedPaymentMethodId,
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
    invalidateQuote: mockInvalidateQuote,
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
          template: `<div data-testid="add-payment-preview">
            {{ previewData?.amount_due_cents ?? "no-quote" }}
            <button data-testid="saved-method-btn" @click="$emit('update:selectedSavedMethodId', 'pm_other')">Saved method</button>
            <button data-testid="new-method-btn" @click="$emit('changePaymentMethod')">New method</button>
          </div>`
        },
        SubscriptionTransitionPreviewWorkspace: { template: '<div />' },
        SubscriptionSuccessWorkspace: { template: '<div />' }
      }
    }
  })
}

describe('SubscriptionRequiredDialogContentUnified team-plan subscribe', () => {
  beforeEach(() => {
    mockIsInPersonalWorkspace.value = false
    mockCheckoutStep.value = 'pricing'
    mockPreviewVariant.value = null
    mockPreviewData.value = null
    mockSelectedTeamStop.value = null
    mockSelectedSavedPaymentMethodId.value = 'pm_default'
  })

  // The team checkout mounts the payment element against the quote's amount, so
  // omitting preview-data left the element with nothing to charge and it
  // refused to render — a served, correctly priced quote presented as
  // "Payment options are unavailable".
  it('hands the team checkout its quote so the payment element can mount', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'team-new'
    mockSelectedTeamStop.value = TEAM_PAYLOAD.stop
    mockPreviewData.value = makePreview()

    renderComponent()

    expect(screen.getByTestId('add-payment-preview')).toHaveTextContent(
      '129500'
    )
  })

  // The preview steps render their own inline back button, so a dialog-level
  // back would double the control (two `g.back` tab stops on one screen).
  it('renders no dialog-level back control on the preview step', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'personal-change'
    mockPreviewData.value = makePreview({ transition_type: 'upgrade' })

    renderComponent()

    expect(screen.queryByLabelText('Back')).toBeNull()
  })

  it('preserves the quote when the payment method changes', async () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'personal-new'
    mockPreviewData.value = makePreview({
      cost_today_cents: 1600,
      cost_next_period_cents: 1600,
      amount_due_cents: 1600
    })
    renderComponent()

    await userEvent.click(screen.getByTestId('saved-method-btn'))
    await userEvent.click(screen.getByTestId('new-method-btn'))

    expect(mockSelectedSavedPaymentMethodId.value).toBeNull()
    expect(mockInvalidateQuote).not.toHaveBeenCalled()
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
