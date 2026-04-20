import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

// Mock all firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn()
}))

// Mock pinia
vi.mock('pinia')

// Mock showSettingsDialog and showTopUpCreditsDialog
const mockShowSettingsDialog = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()

// Mock the settings dialog composable
vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    show: mockShowSettingsDialog,
    hide: vi.fn(),
    showAbout: vi.fn()
  }))
}))

// Mock window.open
const originalWindowOpen = window.open
beforeEach(() => {
  window.open = vi.fn()
})

afterAll(() => {
  window.open = originalWindowOpen
})

// Mock the useCurrentUser composable
const mockHandleSignOut = vi.fn()
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    userPhotoUrl: 'https://example.com/avatar.jpg',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com',
    handleSignOut: mockHandleSignOut
  }))
}))

// Mock the useAuthActions composable
const mockLogout = vi.fn()
vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: vi.fn(() => ({
    fetchBalance: vi.fn().mockResolvedValue(undefined),
    logout: mockLogout
  }))
}))

// Mock the dialog service
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  }))
}))

// Mock the authStore with hoisted state for per-test manipulation
const mockAuthStoreState = vi.hoisted(() => ({
  balance: {
    amount_micros: 100_000,
    effective_balance_micros: 100_000,
    currency: 'usd'
  } as {
    amount_micros?: number
    effective_balance_micros?: number
    currency: string
  },
  isFetchingBalance: false
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    getAuthHeader: vi
      .fn()
      .mockResolvedValue({ Authorization: 'Bearer mock-token' }),
    balance: mockAuthStoreState.balance,
    isFetchingBalance: mockAuthStoreState.isFetchingBalance
  }))
}))

// Mock the useSubscription composable
const mockFetchStatus = vi.fn().mockResolvedValue(undefined)
const mockIsFreeTier = ref(false)
vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: vi.fn(() => ({
    isActiveSubscription: ref(true),
    isFreeTier: mockIsFreeTier,
    subscriptionTierName: ref('Creator'),
    subscriptionTier: ref('CREATOR'),
    fetchStatus: mockFetchStatus
  }))
}))

// Mock the useSubscriptionDialog composable
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

// Mock UserAvatar component
vi.mock('@/components/common/UserAvatar.vue', () => ({
  default: {
    name: 'UserAvatarMock',
    render() {
      return h('div', 'Avatar')
    }
  }
}))

// Mock UserCredit component
vi.mock('@/components/common/UserCredit.vue', () => ({
  default: {
    name: 'UserCreditMock',
    render() {
      return h('div', 'Credit: 100')
    }
  }
}))

// Mock formatCreditsFromCents
vi.mock('@/base/credits/comfyCredits', () => ({
  formatCreditsFromCents: vi.fn(({ cents }) => (cents / 100).toString())
}))

// Mock useExternalLink
vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: vi.fn(() => ({
    buildDocsUrl: vi.fn((path) => `https://docs.comfy.org${path}`),
    docsPaths: {
      partnerNodesPricing: '/tutorials/partner-nodes/pricing'
    }
  }))
}))

// Mock useTelemetry
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackAddApiCreditButtonClicked: vi.fn()
  }))
}))

// Mock isCloud with hoisted state for per-test toggling
const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeButton.vue', () => ({
  default: {
    name: 'SubscribeButtonMock',
    render() {
      return h('div', 'Subscribe Button')
    }
  }
}))

describe('CurrentUserPopoverLegacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockIsFreeTier.value = false
    mockAuthStoreState.balance = {
      amount_micros: 100_000,
      effective_balance_micros: 100_000,
      currency: 'usd'
    }
    mockAuthStoreState.isFetchingBalance = false
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

  it('calls formatCreditsFromCents with correct parameters and displays formatted credits', () => {
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

  it('renders logout menu item with correct text', () => {
    renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    expect(screen.getByText('Log Out')).toBeInTheDocument()
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

  describe('effective_balance_micros handling', () => {
    it('uses effective_balance_micros when present (positive balance)', () => {
      mockAuthStoreState.balance = {
        amount_micros: 200_000,
        effective_balance_micros: 150_000,
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

    it('uses effective_balance_micros when zero', () => {
      mockAuthStoreState.balance = {
        amount_micros: 100_000,
        effective_balance_micros: 0,
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

    it('uses effective_balance_micros when negative', () => {
      mockAuthStoreState.balance = {
        amount_micros: 0,
        effective_balance_micros: -50_000,
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

    it('falls back to amount_micros when effective_balance_micros is missing', () => {
      mockAuthStoreState.balance = {
        amount_micros: 100_000,
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

    it('falls back to 0 when both effective_balance_micros and amount_micros are missing', () => {
      mockAuthStoreState.balance = {
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
      renderComponent()
      expect(screen.queryByText('Subscribe Button')).not.toBeInTheDocument()
    })

    it('hides partner nodes menu item', () => {
      renderComponent()
      expect(
        screen.queryByTestId('partner-nodes-menu-item')
      ).not.toBeInTheDocument()
    })

    it('hides plans & pricing menu item', () => {
      renderComponent()
      expect(
        screen.queryByTestId('plans-pricing-menu-item')
      ).not.toBeInTheDocument()
    })

    it('hides manage plan menu item', () => {
      renderComponent()
      expect(
        screen.queryByTestId('manage-plan-menu-item')
      ).not.toBeInTheDocument()
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
