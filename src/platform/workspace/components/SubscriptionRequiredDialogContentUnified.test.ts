import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionRequiredDialogContentUnified from './SubscriptionRequiredDialogContentUnified.vue'

const mockHandleSubscribeTeamClick = vi.fn()
const mockHandleSubscribeClick = vi.fn()
const mockIsInPersonalWorkspace = ref(false)

vi.mock('@/platform/workspace/composables/useSubscriptionCheckout', () => ({
  useSubscriptionCheckout: () => ({
    checkoutStep: ref('pricing'),
    isLoadingPreview: ref(false),
    loadingTier: ref(null),
    isSubscribing: ref(false),
    isResubscribing: ref(false),
    previewData: ref(null),
    selectedTierKey: ref(null),
    selectedTeamStop: ref(null),
    selectedBillingCycle: ref('yearly'),
    isPolling: ref(false),
    isTeamCheckout: computed(() => false),
    previewVariant: computed(() => null),
    handleSubscribeClick: mockHandleSubscribeClick,
    handleSubscribeTeamClick: mockHandleSubscribeTeamClick,
    handleBackToPricing: vi.fn(),
    handleSuccessClose: vi.fn(),
    handleAddCreditCard: vi.fn(),
    handleConfirmTransition: vi.fn(),
    handleTeamSubscribe: vi.fn(),
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

const mockIsEduPricingActive = ref(false)
const mockNeedsEduVerification = ref(false)
const mockIsSending = ref(false)
const mockIsSent = ref(false)
const mockSendVerification = vi.fn()
const mockRefreshVerification = vi.fn()
const mockFetchStatus = vi.fn()
const mockCreateCustomer = vi.fn()

vi.mock('@/platform/cloud/subscription/composables/useEduPricing', () => ({
  useEduPricing: () => ({
    isEduPricingActive: computed(() => mockIsEduPricingActive.value),
    needsEduVerification: computed(() => mockNeedsEduVerification.value)
  })
}))

vi.mock('@/composables/auth/useEmailVerification', () => ({
  useEmailVerification: () => ({
    isSending: computed(() => mockIsSending.value),
    isSent: computed(() => mockIsSent.value),
    sendVerification: mockSendVerification,
    refreshVerification: mockRefreshVerification
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    fetchStatus: mockFetchStatus
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    createCustomer: mockCreateCustomer
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { back: 'Back', close: 'Close' },
      subscription: {
        descriptionWorkspace: 'Choose your plan',
        eduPromoHeader:
          'Education discount: up to {percent}% off for verified students and educators',
        eduVerifyHeader:
          'Verify your email to unlock up to {percent}% education pricing',
        eduVerifySend: 'Send verification email',
        eduVerifySentHint: 'Check your inbox, then come back',
        eduVerifyConfirm: "I've verified",
        eduVerifySendFailed: "Couldn't send the email. Try again.",
        eduVerifyStillUnverified:
          'Not verified yet. Click the link in your inbox first.',
        eduVerifyFailed: 'Something went wrong. Try again.'
      }
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
        SubscriptionAddPaymentPreviewWorkspace: { template: '<div />' },
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

describe('SubscriptionRequiredDialogContentUnified EDU verify nudge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInPersonalWorkspace.value = false
    mockIsEduPricingActive.value = false
    mockNeedsEduVerification.value = false
    mockIsSending.value = false
    mockIsSent.value = false
    mockSendVerification.mockResolvedValue(true)
    mockRefreshVerification.mockResolvedValue(false)
    mockCreateCustomer.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
  })

  it('renders the verify-email nudge when the email needs verification', () => {
    mockNeedsEduVerification.value = true
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Send verification email' })
    ).toBeInTheDocument()
  })

  it('surfaces a send failure', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockSendVerification.mockResolvedValue(false)
    renderComponent()

    await user.click(
      screen.getByRole('button', { name: 'Send verification email' })
    )

    expect(
      screen.getByText("Couldn't send the email. Try again.")
    ).toBeInTheDocument()
  })

  it('surfaces a still-unverified status without re-provisioning', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockIsSent.value = true
    mockRefreshVerification.mockResolvedValue(false)
    renderComponent()

    await user.click(screen.getByRole('button', { name: "I've verified" }))

    expect(
      screen.getByText('Not verified yet. Click the link in your inbox first.')
    ).toBeInTheDocument()
    expect(mockCreateCustomer).not.toHaveBeenCalled()
  })

  it('re-provisions then refetches status once verified', async () => {
    const user = userEvent.setup()
    mockNeedsEduVerification.value = true
    mockIsSent.value = true
    mockRefreshVerification.mockResolvedValue(true)
    renderComponent()

    await user.click(screen.getByRole('button', { name: "I've verified" }))

    await vi.waitFor(() => {
      expect(mockCreateCustomer).toHaveBeenCalledOnce()
      expect(mockFetchStatus).toHaveBeenCalledOnce()
    })
    expect(mockCreateCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchStatus.mock.invocationCallOrder[0]
    )
  })
})
