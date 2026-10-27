import type { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionRequiredDialogContentUnified from './SubscriptionRequiredDialogContentUnified.vue'

const mockHandleSubscribeTeamClick = vi.fn()
const mockHandleBackToPricing = vi.fn()
const mockHandleSubscribeClick = vi.fn()

const mockCheckoutStep = ref('pricing')
const mockPreviewVariant = ref<string | null>(null)
const mockPreviewData = ref<Record<string, unknown> | null>(null)
const mockSelectedTeamStop = ref<Record<string, unknown> | null>(null)

const mockUseSubscriptionCheckout = vi.hoisted(() => vi.fn())
const mockPaymentRecoveryLock = ref<'owner' | 'member' | null>(null)
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(
  import('@/platform/billing/composables/usePaymentRecoveryDialog'),
  () => ({
    isTopUpDeniedPastDue: vi.fn(),
    usePaymentRecoveryDialog: (): ReturnType<
      typeof usePaymentRecoveryDialog
    > => ({
      showPaymentRecoveryDialog: vi.fn(),
      updatePayment: vi.fn(),
      isUpdatingPayment: computed(() => false),
      paymentRecoveryLock: computed(() => mockPaymentRecoveryLock.value),
      refreshCapabilities: vi.fn()
    })
  })
)

vi.mock<unknown>(
  import('@/platform/billing/composables/useSubscriptionCheckout'),
  () => ({
    useSubscriptionCheckout: (...args: unknown[]) => {
      mockUseSubscriptionCheckout(...args)
      return {
        checkoutStep: mockCheckoutStep,
        isLoadingPreview: ref(false),
        loadingTier: ref(null),
        isSubscribing: ref(false),
        isResubscribing: ref(false),
        previewData: mockPreviewData,
        selectedTierKey: ref(null),
        selectedTeamStop: mockSelectedTeamStop,
        selectedBillingCycle: ref('yearly'),
        activeCheckoutActionUrl: ref(null),
        authenticationState: ref(null),
        isPolling: ref(false),
        isTeamCheckout: computed(() => false),
        previewVariant: computed(() => mockPreviewVariant.value),
        handleSubscribeClick: mockHandleSubscribeClick,
        handleSubscribeTeamClick: mockHandleSubscribeTeamClick,
        handleBackToPricing: mockHandleBackToPricing,
        handleSuccessClose: vi.fn(),
        handleAddCreditCard: vi.fn(),
        handleConfirmTransition: vi.fn(),
        handleTeamSubscribe: vi.fn(),
        handleResubscribe: vi.fn()
      }
    }
  })
)

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
    props: {
      onClose: vi.fn(),
      paymentIntentSource: undefined,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        UnifiedPricingTable: UnifiedPricingTableStub,
        SubscriptionAddPaymentPreviewWorkspace: {
          name: 'SubscriptionAddPaymentPreviewWorkspace',
          props: ['previewData', 'teamPlan'],
          template: `<div data-testid="add-payment-preview">
            {{ previewData?.amount_due_cents ?? "no-quote" }}
            <button aria-label="Back" @click="$emit('back')">Back</button>
          </div>`
        },
        SubscriptionTransitionPreviewWorkspace: {
          template: '<div data-testid="transition-preview" />'
        },
        SubscriptionSuccessWorkspace: { template: '<div />' }
      }
    }
  })
}

describe('SubscriptionRequiredDialogContentUnified team-plan subscribe', () => {
  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
    mockCheckoutStep.value = 'pricing'
    mockPreviewVariant.value = null
    mockPreviewData.value = null
    mockSelectedTeamStop.value = null
    mockPaymentRecoveryLock.value = null
    mockDistributionTypes.isCloud = true
  })

  it('hands the team checkout its preview', () => {
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
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
    renderComponent()

    await user.click(screen.getByTestId('subscribe-team-btn'))

    await vi.waitFor(() => {
      expect(mockHandleSubscribeTeamClick).toHaveBeenCalledWith(TEAM_PAYLOAD)
    })
  })

  it('advances to team checkout from a personal workspace (no reroute)', async () => {
    const user = userEvent.setup()
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
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

  it.for(['team-change', 'personal-change'])(
    'withholds the transition confirm until its preview arrives (%s)',
    async (previewVariant) => {
      mockCheckoutStep.value = 'preview'
      mockPreviewVariant.value = previewVariant
      mockSelectedTeamStop.value = TEAM_PAYLOAD.stop
      mockPreviewData.value = null

      renderComponent()

      expect(screen.queryByTestId('transition-preview')).toBeNull()

      mockPreviewData.value = { amount_due_cents: 1600, currency: 'usd' }
      await nextTick()

      expect(screen.getByTestId('transition-preview')).toBeTruthy()
    }
  )

  it('leaves the confirm step its own header and back action', async () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'team-new'
    mockSelectedTeamStop.value = TEAM_PAYLOAD.stop

    renderComponent()

    expect(screen.queryByText('Choose your plan')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockHandleBackToPricing).toHaveBeenCalled()
  })

  it('returns to pricing on Backspace from the confirm step', async () => {
    mockCheckoutStep.value = 'preview'
    mockPreviewVariant.value = 'team-new'
    mockSelectedTeamStop.value = TEAM_PAYLOAD.stop

    renderComponent()
    await userEvent.keyboard('{Backspace}')

    expect(mockHandleBackToPricing).toHaveBeenCalledOnce()
  })

  it('gives checkout the surface, not the copy reason', () => {
    renderComponent({
      reason: 'out_of_credits',
      paymentIntentSource: 'agent_paywall'
    })

    expect(mockUseSubscriptionCheckout.mock.calls[0][1]).toBe('agent_paywall')
  })

  it('only lets checkout suppress toasts for an owner on Cloud', () => {
    renderComponent()
    const { rendersPastDueNotice } =
      mockUseSubscriptionCheckout.mock.calls[0][2]

    expect(rendersPastDueNotice()).toBe(false)
    mockPaymentRecoveryLock.value = 'member'
    expect(rendersPastDueNotice()).toBe(false)
    mockPaymentRecoveryLock.value = 'owner'
    expect(rendersPastDueNotice()).toBe(true)
    mockDistributionTypes.isCloud = false
    expect(rendersPastDueNotice()).toBe(false)
  })
})
