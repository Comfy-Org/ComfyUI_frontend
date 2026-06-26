import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const mockShowSettingsDialog = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    show: mockShowSettingsDialog,
    hide: vi.fn(),
    showAbout: vi.fn()
  }))
}))

const originalWindowOpen = window.open
beforeEach(() => {
  window.open = vi.fn()
})

afterAll(() => {
  window.open = originalWindowOpen
})

const mockHandleSignOut = vi.fn()
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    userPhotoUrl: 'https://example.com/avatar.jpg',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com',
    handleSignOut: mockHandleSignOut
  }))
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  }))
}))

function makeSubscription(
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'CREATOR',
    duration: 'MONTHLY',
    planSlug: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    ...overrides
  }
}

const mockFetchStatus = vi.fn().mockResolvedValue(undefined)
const mockFetchBalance = vi.fn().mockResolvedValue(undefined)
const mockIsActiveSubscription = ref(true)
const mockIsFreeTier = ref(false)
const mockTier = ref<SubscriptionInfo['tier']>('CREATOR')
const mockSubscription = ref<SubscriptionInfo | null>(makeSubscription())
const mockBalance = ref<BalanceInfo | null>(null)
const mockIsLoading = ref(false)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    isActiveSubscription: mockIsActiveSubscription,
    isFreeTier: mockIsFreeTier,
    tier: mockTier,
    subscription: mockSubscription,
    balance: mockBalance,
    isLoading: mockIsLoading,
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance
  }))
}))

const mockShowPricingTable = vi.fn()
vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: vi.fn(() => ({
      show: vi.fn(),
      showPricingTable: mockShowPricingTable,
      hide: vi.fn()
    }))
  })
)

vi.mock('@/components/common/UserAvatar.vue', () => ({
  default: {
    name: 'UserAvatarMock',
    render() {
      return h('div', 'Avatar')
    }
  }
}))

vi.mock('@/base/credits/comfyCredits', () => ({
  formatCreditsFromCents: vi.fn(({ cents }) => (cents / 100).toString())
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: vi.fn(() => ({
    buildDocsUrl: vi.fn((path) => `https://docs.comfy.org${path}`),
    docsPaths: {
      partnerNodesPricing: '/tutorials/partner-nodes/pricing'
    }
  }))
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackAddApiCreditButtonClicked: vi.fn()
  }))
}))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeButton.vue', () => ({
  default: defineComponent({
    name: 'SubscribeButtonMock',
    emits: ['subscribed'],
    setup(_, { emit }) {
      return () =>
        h(
          'button',
          {
            'data-testid': 'subscribe-button-mock',
            onClick: () => emit('subscribed')
          },
          'Subscribe Button'
        )
    }
  })
}))

describe('CurrentUserPopoverLegacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockIsActiveSubscription.value = true
    mockIsFreeTier.value = false
    mockTier.value = 'CREATOR'
    mockSubscription.value = makeSubscription()
    mockBalance.value = {
      amountMicros: 100_000,
      effectiveBalanceMicros: 100_000,
      currency: 'usd'
    }
    mockIsLoading.value = false
  })

  function renderComponent() {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(CurrentUserPopoverLegacy, {
      global: {
        plugins: [i18n],
        stubs: {
          Divider: true
        }
      },
      props: {
        onClose
      }
    })

    return { user, onClose }
  }

  it('renders user information correctly', () => {
    renderComponent()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('fetches the balance through the billing facade on mount', () => {
    renderComponent()

    expect(mockFetchBalance).toHaveBeenCalled()
  })

  it('refreshes subscription status through the billing facade after subscribing', async () => {
    mockIsActiveSubscription.value = false
    const { user } = renderComponent()

    await user.click(screen.getByTestId('subscribe-button-mock'))

    expect(mockFetchStatus).toHaveBeenCalled()
  })

  describe('subscription tier badge', () => {
    it('renders the tier name derived from the facade tier', () => {
      renderComponent()

      expect(screen.getByText('Creator')).toBeInTheDocument()
    })

    it('renders the yearly tier name when the facade subscription is annual', () => {
      mockSubscription.value = makeSubscription({ duration: 'ANNUAL' })

      renderComponent()

      expect(screen.getByText('Creator Yearly')).toBeInTheDocument()
    })

    it('hides the badge when the facade reports no tier', () => {
      mockTier.value = null
      mockSubscription.value = null

      renderComponent()

      expect(screen.queryByText('Creator')).not.toBeInTheDocument()
    })
  })

  it('formats and displays the facade balance', () => {
    renderComponent()

    expect(formatCreditsFromCents).toHaveBeenCalledWith({
      cents: 100_000,
      locale: 'en',
      numberOptions: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    })

    expect(screen.getByText('1000')).toBeInTheDocument()
  })

  it('shows a skeleton instead of the balance while billing is loading', () => {
    mockIsLoading.value = true

    renderComponent()

    expect(screen.queryByText('1000')).not.toBeInTheDocument()
  })

  it('renders logout menu item with correct text', () => {
    renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    expect(screen.getByText('Log Out')).toBeInTheDocument()
  })

  describe('credits help icon (FE-617)', () => {
    it('renders the credits help icon as an interactive button with the unified-credits tooltip as its accessible name', () => {
      renderComponent()

      const helpButton = screen.getByTestId('credits-info-button')
      expect(helpButton).toBeInTheDocument()
      expect(helpButton.tagName).toBe('BUTTON')
      expect(helpButton).toHaveAttribute(
        'aria-label',
        enMessages.credits.unified.tooltip
      )
    })
  })

  it('opens user settings and emits close event when settings item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('user-settings-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('user-settings-menu-item'))

    expect(mockShowSettingsDialog).toHaveBeenCalledWith('user')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls logout function and emits close event when logout item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('logout-menu-item'))

    expect(mockHandleSignOut).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens API pricing docs and emits close event when partner nodes item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('partner-nodes-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('partner-nodes-menu-item'))

    expect(window.open).toHaveBeenCalledWith(
      'https://docs.comfy.org/tutorials/partner-nodes/pricing',
      '_blank'
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens top-up dialog and emits close event when top-up button is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()

    await user.click(screen.getByTestId('add-credits-button'))

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens subscription dialog and emits close event when plans & pricing item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('plans-pricing-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('plans-pricing-menu-item'))

    expect(mockShowPricingTable).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('facade balance handling', () => {
    it('uses effectiveBalanceMicros when present (positive balance)', () => {
      mockBalance.value = {
        amountMicros: 200_000,
        effectiveBalanceMicros: 150_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 150_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('1500')).toBeInTheDocument()
    })

    it('uses effectiveBalanceMicros when zero', () => {
      mockBalance.value = {
        amountMicros: 100_000,
        effectiveBalanceMicros: 0,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 0,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('uses effectiveBalanceMicros when negative', () => {
      mockBalance.value = {
        amountMicros: 0,
        effectiveBalanceMicros: -50_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: -50_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('-500')).toBeInTheDocument()
    })

    it('falls back to amountMicros when effectiveBalanceMicros is missing', () => {
      mockBalance.value = {
        amountMicros: 100_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 100_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('1000')).toBeInTheDocument()
    })

    it('falls back to 0 when the facade reports no balance', () => {
      mockBalance.value = null

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 0,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('cloud free tier', () => {
    beforeEach(() => {
      mockIsCloud.value = true
      mockIsFreeTier.value = true
    })

    it('shows upgrade-to-add-credits button and hides add-credits button', () => {
      renderComponent()
      expect(
        screen.getByTestId('upgrade-to-add-credits-button')
      ).toBeInTheDocument()
      expect(screen.queryByTestId('add-credits-button')).not.toBeInTheDocument()
    })
  })

  describe('non-cloud distribution', () => {
    beforeEach(() => {
      mockIsCloud.value = false
    })

    it('still shows credits balance', () => {
      renderComponent()
      expect(screen.getByText('1000')).toBeInTheDocument()
    })

    it('shows add-credits button and hides upgrade-to-add-credits button', () => {
      renderComponent()
      expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
      expect(
        screen.queryByTestId('upgrade-to-add-credits-button')
      ).not.toBeInTheDocument()
    })

    it('hides upgrade-to-add-credits button even when on free tier', () => {
      mockIsFreeTier.value = true
      renderComponent()
      expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
      expect(
        screen.queryByTestId('upgrade-to-add-credits-button')
      ).not.toBeInTheDocument()
    })

    it('hides subscribe button', () => {
      mockIsActiveSubscription.value = false
      renderComponent()
      expect(
        screen.queryByTestId('subscribe-button-mock')
      ).not.toBeInTheDocument()
    })

    it('still shows partner nodes menu item', () => {
      renderComponent()
      expect(screen.getByTestId('partner-nodes-menu-item')).toBeInTheDocument()
    })

    it('hides plans & pricing menu item', () => {
      renderComponent()
      expect(
        screen.queryByTestId('plans-pricing-menu-item')
      ).not.toBeInTheDocument()
    })

    it('still shows manage plan menu item', () => {
      renderComponent()
      expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()
    })

    it('still shows user settings menu item', () => {
      renderComponent()
      expect(screen.getByTestId('user-settings-menu-item')).toBeInTheDocument()
    })

    it('still shows logout menu item', () => {
      renderComponent()
      expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    })
  })
})
