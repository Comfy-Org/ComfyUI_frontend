import { VueWrapper, mount } from '@vue/test-utils'
import Button from 'primevue/button'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

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
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    userPhotoUrl: 'https://example.com/avatar.jpg',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com'
  }))
}))

// Mock the useFirebaseAuthActions composable
vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: vi.fn(() => ({
    fetchBalance: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock the dialog service
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showSettingsDialog: mockShowSettingsDialog,
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  }))
}))

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
          Divider: true,
          Button: true
        }
      }
    })
  }

  it('renders user information correctly', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Test User')
    expect(wrapper.text()).toContain('test@example.com')
  })

  it('opens user settings and emits close event when settings button is clicked', async () => {
    const wrapper = mountComponent()

    // Find all buttons and get the settings button (first one)
    const buttons = wrapper.findAllComponents(Button)
    const settingsButton = buttons[0]

    // Click the settings button
    await settingsButton.trigger('click')

    // Verify showSettingsDialog was called with 'user'
    expect(mockShowSettingsDialog).toHaveBeenCalledWith('user')

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })

  it('opens API pricing docs and emits close event when API pricing button is clicked', async () => {
    const wrapper = mountComponent()

    // Find all buttons and get the API pricing button (second one)
    const buttons = wrapper.findAllComponents(Button)
    const apiPricingButton = buttons[1]

    // Click the API pricing button
    await apiPricingButton.trigger('click')

    // Verify window.open was called with the correct URL
    expect(window.open).toHaveBeenCalledWith(
      'https://docs.comfy.org/tutorials/api-nodes/pricing',
      '_blank'
    )

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })

  it('opens top-up dialog and emits close event when top-up button is clicked', async () => {
    const wrapper = mountComponent()

    // Find all buttons and get the top-up button (last one)
    const buttons = wrapper.findAllComponents(Button)
    const topUpButton = buttons[buttons.length - 1]

    // Click the top-up button
    await topUpButton.trigger('click')

    // Verify showTopUpCreditsDialog was called
    expect(mockShowTopUpCreditsDialog).toHaveBeenCalled()

    // Verify close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })
})
