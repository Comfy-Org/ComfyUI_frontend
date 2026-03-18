import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TopbarSubscribeButton from './TopbarSubscribeButton.vue'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockShowPricingTable = vi.fn()

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: vi.fn(() => ({
      showPricingTable: mockShowPricingTable
    }))
  })
)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    isFreeTier: { value: true }
  }))
}))

vi.mock('pinia')

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn()
}))

function mountComponent() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return mount(TopbarSubscribeButton, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('TopbarSubscribeButton', () => {
  it('renders on cloud when isFreeTier is true', () => {
    mockIsCloud.value = true
    const wrapper = mountComponent()
    expect(
      wrapper.find('[data-testid="topbar-subscribe-button"]').exists()
    ).toBe(true)
  })

  it('hides on non-cloud distribution', () => {
    mockIsCloud.value = false
    const wrapper = mountComponent()
    expect(
      wrapper.find('[data-testid="topbar-subscribe-button"]').exists()
    ).toBe(false)
  })
})
