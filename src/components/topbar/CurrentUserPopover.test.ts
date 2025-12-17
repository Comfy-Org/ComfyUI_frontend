import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CurrentUserPopover from './CurrentUserPopover.vue'

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

// Mock the useFirebaseAuthActions composable
const mockLogout = vi.fn()
vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: vi.fn(() => ({
    fetchBalance: vi.fn().mockResolvedValue(undefined),
    logout: mockLogout
  }))
}))

// Mock the dialog service
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showSettingsDialog: mockShowSettingsDialog,
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  }))
}))

// Mock the firebaseAuthStore
vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    getAuthHeader: vi
      .fn()
      .mockResolvedValue({ Authorization: 'Bearer mock-token' }),
    balance: { amount_micros: 100_000 }, // 100,000 cents = ~211,000 credits
    isFetchingBalance: false
  }))
}))

// Mock the useSubscription composable
const mockFetchStatus = vi.fn().mockResolvedValue(undefined)
vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: vi.fn(() => ({
    isActiveSubscription: { value: true },
    subscriptionTierName: { value: 'Creator' },
    subscriptionTier: { value: 'CREATOR' },
    fetchStatus: mockFetchStatus
  }))
}))

// Mock the useSubscriptionDialog composable
const mockSubscriptionDialogShow = vi.fn()
vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: vi.fn(() => ({
      show: mockSubscriptionDialogShow,
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
    buildDocsUrl: vi.fn((path) => `https://docs.comfy.org${path}`)
  }))
}))

// Mock useFeatureFlags
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: {
      subscriptionTiersEnabled: true
    }
  }))
}))

// Mock useTelemetry
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackAddApiCreditButtonClicked: vi.fn()
  }))
}))

// Mock isCloud
vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeButton.vue', () => ({
  default: {
    name: 'SubscribeButtonMock',
    render() {
      return h('div', 'Subscribe Button')
    }
  }
}))

describe('CurrentUserPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mountComponent = (): VueWrapper => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return mount(CurrentUserPopover, {
      global: {
        plugins: [i18n],
        stubs: {
          Divider: true
        }
      }
    })
  }

  it('renders user information correctly', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Test User')
    expect(wrapper.text()).toContain('test@example.com')
  })

  it('calls formatCreditsFromCents with correct parameters and displays formatted credits', () => {
    const wrapper = mountComponent()

    expect(formatCreditsFromCents).toHaveBeenCalledWith({
      cents: 100_000,
      locale: 'en',
      numberOptions: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    })

    // Verify the formatted credit string (1000) is rendered in the DOM
    expect(wrapper.text()).toContain('1000')
  })

  it('renders logout menu item with correct text', () => {
    const wrapper = mountComponent()

    const logoutItem = wrapper.find('[data-testid="logout-menu-item"]')
    expect(logoutItem.exists()).toBe(true)
    expect(wrapper.text()).toContain('Log Out')
  })

  it('opens user settings and emits close event when settings item is clicked', async () => {
    const wrapper = mountComponent()

    const settingsItem = wrapper.find('[data-testid="user-settings-menu-item"]')
    expect(settingsItem.exists()).toBe(true)

    await settingsItem.trigger('click')

    // Verify showSettingsDialog was called with 'user'
    expect(mockShowSettingsDialog).toHaveBeenCalledWith('user')

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })

  it('calls logout function and emits close event when logout item is clicked', async () => {
    const wrapper = mountComponent()

    const logoutItem = wrapper.find('[data-testid="logout-menu-item"]')
    expect(logoutItem.exists()).toBe(true)

    await logoutItem.trigger('click')

    // Verify handleSignOut was called
    expect(mockHandleSignOut).toHaveBeenCalled()

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })

  it('opens API pricing docs and emits close event when partner nodes item is clicked', async () => {
    const wrapper = mountComponent()

    const partnerNodesItem = wrapper.find(
      '[data-testid="partner-nodes-menu-item"]'
    )
    expect(partnerNodesItem.exists()).toBe(true)

    await partnerNodesItem.trigger('click')

    // Verify window.open was called with the correct URL
    expect(window.open).toHaveBeenCalledWith(
      'https://docs.comfy.org/tutorials/partner-nodes/pricing',
      '_blank'
    )

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })

  it('opens top-up dialog and emits close event when top-up button is clicked', async () => {
    const wrapper = mountComponent()

    const topUpButton = wrapper.find('[data-testid="add-credits-button"]')
    expect(topUpButton.exists()).toBe(true)

    await topUpButton.trigger('click')

    // Verify showTopUpCreditsDialog was called
    expect(mockShowTopUpCreditsDialog).toHaveBeenCalled()

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })
})
