import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'

import SettingsPlanCheckoutDialogContent from './SettingsPlanCheckoutDialogContent.vue'

const {
  mockUseSubscriptionCheckout,
  mockHandleSubscribeClick,
  mockHandleSubscribeTeamClick,
  mockHandleConfirmTransition,
  mockHandleTeamSubscribe,
  mockHandleSuccessClose,
  mockHandleBackToPricing,
  state
} = vi.hoisted(() => ({
  mockUseSubscriptionCheckout: vi.fn(),
  mockHandleSubscribeClick: vi.fn(),
  mockHandleSubscribeTeamClick: vi.fn(),
  mockHandleConfirmTransition: vi.fn(),
  mockHandleTeamSubscribe: vi.fn(),
  mockHandleSuccessClose: vi.fn(),
  mockHandleBackToPricing: vi.fn(),
  state: {
    checkoutStep: null as ReturnType<typeof ref<string>> | null,
    previewVariant: null as ReturnType<typeof ref<string | null>> | null,
    reactivationRequired: null as ReturnType<typeof ref<boolean>> | null,
    emit: null as ((event: 'close', subscribed: boolean) => void) | null
  }
}))

vi.mock('@/platform/workspace/composables/useSubscriptionCheckout', () => ({
  useSubscriptionCheckout: mockUseSubscriptionCheckout
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const PREVIEW = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-09-01T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 1234,
  cost_next_period_cents: 3500,
  credits_today_cents: 0,
  credits_next_period_cents: 7400,
  new_plan: {
    slug: 'creator-monthly',
    tier: 'CREATOR',
    duration: 'MONTHLY',
    price_cents: 3500,
    credits_cents: 7400,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 3500,
      total_credits_cents: 7400
    }
  }
}

const PERSONAL_SELECTION = {
  planMode: 'personal' as const,
  tierKey: 'creator' as const,
  billingCycle: 'monthly' as const,
  planSlug: 'creator-monthly'
}

const TEAM_SELECTION = {
  planMode: 'team' as const,
  stop: { id: 'team_900', usd: 900, credits: 189_900, discountedUsd: 810 },
  billingCycle: 'yearly' as const,
  planSlug: 'team-annual-catalog',
  isChange: true
}

const stubs = {
  SubscriptionTransitionPreviewWorkspace: {
    props: ['previewData', 'teamPlan', 'forceReactivation', 'isLoading'],
    emits: ['confirm', 'back'],
    template: `<div data-testid="transition" :data-force-reactivation="String(forceReactivation)">
      <button data-testid="confirm" @click="$emit('confirm', true)">confirm</button>
      <button data-testid="back" @click="$emit('back')">back</button>
    </div>`
  },
  SubscriptionAddPaymentPreviewWorkspace: {
    props: ['previewData', 'teamPlan', 'tierKey'],
    emits: ['addCreditCard', 'back'],
    template: '<div data-testid="add-payment" />'
  },
  SubscriptionSuccessWorkspace: {
    emits: ['close'],
    template:
      '<div data-testid="success"><button data-testid="success-close" @click="$emit(\'close\')">close</button></div>'
  }
}

function renderDialog(
  initialCheckout: SubscriptionCheckoutSelection = PERSONAL_SELECTION
) {
  const onClose = vi.fn()
  const utils = render(SettingsPlanCheckoutDialogContent, {
    props: { onClose, initialCheckout },
    global: { plugins: [i18n], stubs }
  })
  return { ...utils, onClose }
}

describe('SettingsPlanCheckoutDialogContent', () => {
  beforeEach(() => {
    state.checkoutStep = ref('pricing')
    state.previewVariant = ref<string | null>(null)
    state.reactivationRequired = ref(false)
    mockHandleSubscribeClick.mockReset().mockResolvedValue(undefined)
    mockHandleSubscribeTeamClick.mockReset().mockResolvedValue(undefined)
    mockHandleConfirmTransition.mockReset()
    mockHandleTeamSubscribe.mockReset()
    mockHandleSuccessClose.mockReset()
    mockHandleBackToPricing.mockReset()
    mockUseSubscriptionCheckout.mockReset()
    mockUseSubscriptionCheckout.mockImplementation(
      (emit: (event: 'close', subscribed: boolean) => void) => {
        state.emit = emit
        return {
          checkoutStep: state.checkoutStep,
          isLoadingPreview: ref(false),
          isSubscribing: ref(false),
          previewData: ref(PREVIEW),
          reactivationRequired: state.reactivationRequired,
          selectedTierKey: ref('creator'),
          selectedTeamStop: ref(TEAM_SELECTION.stop),
          selectedBillingCycle: ref('monthly'),
          activeCheckoutActionUrl: ref(null),
          isPolling: ref(false),
          isTeamCheckout: computed(() => false),
          previewVariant: state.previewVariant,
          handleSubscribeClick: mockHandleSubscribeClick,
          handleSubscribeTeamClick: mockHandleSubscribeTeamClick,
          handleBackToPricing: mockHandleBackToPricing,
          handleSuccessClose: mockHandleSuccessClose,
          handleAddCreditCard: vi.fn(),
          handleConfirmTransition: mockHandleConfirmTransition,
          handleTeamSubscribe: mockHandleTeamSubscribe
        }
      }
    )
  })

  it('attributes the checkout to the local plans section', () => {
    renderDialog()

    expect(mockUseSubscriptionCheckout).toHaveBeenCalledWith(
      expect.any(Function),
      'local_settings_plans'
    )
  })

  it('shows the loading row while the preview is in flight', () => {
    mockHandleSubscribeClick.mockReturnValue(new Promise(() => {}))
    renderDialog()

    expect(screen.getByText('Loading')).toBeTruthy()
    expect(screen.queryByTestId('transition')).toBeNull()
  })

  it('closes when the dispatched preview settles without leaving the pricing step', async () => {
    const { onClose } = renderDialog()

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('closes when the flow returns to pricing after the preview step', async () => {
    mockHandleSubscribeClick.mockImplementation(async () => {
      state.checkoutStep!.value = 'preview'
      state.previewVariant!.value = 'personal-change'
    })
    const { onClose } = renderDialog()
    await screen.findByTestId('transition')
    expect(onClose).not.toHaveBeenCalled()

    state.checkoutStep!.value = 'pricing'

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('forwards the reactivation consent and forces the banner on the personal transition step', async () => {
    mockHandleSubscribeClick.mockImplementation(async () => {
      state.checkoutStep!.value = 'preview'
      state.previewVariant!.value = 'personal-change'
      state.reactivationRequired!.value = true
    })
    renderDialog()
    const transition = await screen.findByTestId('transition')

    expect(transition.dataset.forceReactivation).toBe('true')
    await userEvent.click(screen.getByTestId('confirm'))
    expect(mockHandleConfirmTransition).toHaveBeenCalledWith(true)
    expect(mockHandleTeamSubscribe).not.toHaveBeenCalled()
  })

  it('forwards a team transition confirm to the team subscribe', async () => {
    mockHandleSubscribeTeamClick.mockImplementation(async () => {
      state.checkoutStep!.value = 'preview'
      state.previewVariant!.value = 'team-change'
    })
    renderDialog(TEAM_SELECTION)
    await screen.findByTestId('transition')

    await userEvent.click(screen.getByTestId('confirm'))
    expect(mockHandleTeamSubscribe).toHaveBeenCalledWith(true)
  })

  it('routes back to pricing through the composable so its guards apply', async () => {
    mockHandleSubscribeClick.mockImplementation(async () => {
      state.checkoutStep!.value = 'preview'
      state.previewVariant!.value = 'personal-change'
    })
    renderDialog()
    await screen.findByTestId('transition')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockHandleBackToPricing).toHaveBeenCalled()
  })

  it('closes from the success screen through the composable emit', async () => {
    mockHandleSubscribeClick.mockImplementation(async () => {
      state.checkoutStep!.value = 'success'
    })
    mockHandleSuccessClose.mockImplementation(() => state.emit?.('close', true))
    const { onClose } = renderDialog()
    await screen.findByTestId('success')

    await userEvent.click(screen.getByTestId('success-close'))
    expect(mockHandleSuccessClose).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('closes from the close button', async () => {
    mockHandleSubscribeClick.mockReturnValue(new Promise(() => {}))
    const { onClose } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
