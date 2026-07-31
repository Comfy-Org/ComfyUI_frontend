import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionRequiredDialogContentUnified from './SubscriptionRequiredDialogContentUnified.vue'

const {
  mockHandleSubscribeTeamClick,
  mockHandleSubscribeClick,
  mockIsInPersonalWorkspace,
  mockCheckoutStep,
  mockPreviewVariant,
  mockEmbeddedCheckoutEnabled
} = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    mockHandleSubscribeTeamClick: vi.fn(),
    mockHandleSubscribeClick: vi.fn(),
    mockIsInPersonalWorkspace: ref(false),
    mockCheckoutStep: ref('pricing'),
    mockPreviewVariant: ref<string | null>(null),
    mockEmbeddedCheckoutEnabled: ref(false)
  }
})

vi.mock('@/platform/workspace/composables/useSubscriptionCheckout', () => ({
  useSubscriptionCheckout: () => ({
    checkoutStep: mockCheckoutStep,
    isLoadingPreview: ref(false),
    loadingTier: ref(null),
    isSubscribing: ref(false),
    isResubscribing: ref(false),
    previewData: ref(null),
    selectedTierKey: ref(null),
    selectedTeamStop: ref(null),
    selectedBillingCycle: ref('yearly'),
    activeCheckoutActionUrl: ref(null),
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
    handleResubscribe: vi.fn()
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get embeddedCheckoutEnabled() {
        return mockEmbeddedCheckoutEnabled.value
      }
    }
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

const SubscriptionAddPaymentPreviewWorkspaceStub = {
  name: 'SubscriptionAddPaymentPreviewWorkspace',
  props: ['usePaymentElement'],
  template: `<section :aria-label="usePaymentElement ? 'Embedded checkout' : 'Legacy checkout'" />`
}

function renderComponent(props: Record<string, unknown> = {}) {
  return render(SubscriptionRequiredDialogContentUnified, {
    props: { onClose: vi.fn(), ...props },
    global: {
      plugins: [i18n],
      stubs: {
        UnifiedPricingTable: UnifiedPricingTableStub,
        SubscriptionAddPaymentPreviewWorkspace:
          SubscriptionAddPaymentPreviewWorkspaceStub,
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
    mockEmbeddedCheckoutEnabled.value = false
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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

  it('keeps the legacy checkout when the embedded checkout flag is disabled', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'personal-new'

    renderComponent()

    expect(
      screen.getByRole('region', { name: 'Legacy checkout' })
    ).toBeInTheDocument()
  })

  it('uses the embedded checkout when the flag is enabled', () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'personal-new'
    mockEmbeddedCheckoutEnabled.value = true
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test')

    renderComponent()

    expect(
      screen.getByRole('region', { name: 'Embedded checkout' })
    ).toBeInTheDocument()
  })
})
