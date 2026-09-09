import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import TopbarSubscribeButton from './TopbarSubscribeButton.vue'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockShowPricingTable = vi.fn()

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog'),
  () => ({
    useSubscriptionDialog: vi.fn(() => ({
      showPricingTable: mockShowPricingTable
    }))
  })
)

const mockBilling = vi.hoisted(() => ({
  isFreeTier: true,
  canRunWorkflows: true,
  isBuilderMode: false
}))

vi.mock<unknown>(import('@/composables/useAppMode'), () => ({
  useAppMode: () => ({
    isBuilderMode: {
      get value() {
        return mockBilling.isBuilderMode
      }
    }
  })
}))

vi.mock<unknown>(
  import('@/composables/billing/useBillingContext'),
  async () => {
    const { computed } = await import('vue')
    return {
      useBillingContext: vi.fn(() => ({
        isFreeTier: computed(() => mockBilling.isFreeTier),
        canRunWorkflows: computed(() => mockBilling.canRunWorkflows)
      }))
    }
  }
)

vi.mock(import('pinia'))

vi.mock<unknown>(import('firebase/app'), () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock<unknown>(import('firebase/auth'), () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn()
}))

function renderComponent() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(TopbarSubscribeButton, {
    global: {
      plugins: [i18n, createPinia()]
    }
  })
}

describe('TopbarSubscribeButton', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockBilling.isFreeTier = true
    mockBilling.canRunWorkflows = true
    mockBilling.isBuilderMode = false
  })

  it('renders for a free-tier user who can still run', () => {
    renderComponent()
    expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
  })

  it('hides on non-cloud distribution', () => {
    mockIsCloud.value = false
    renderComponent()
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()
  })

  it('hides for a paid tier', () => {
    mockBilling.isFreeTier = false
    renderComponent()
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()
  })

  it('hides whenever the user cannot run, whatever closed it', () => {
    mockBilling.canRunWorkflows = false
    renderComponent()
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()
  })

  it('stays visible in builder mode even when the user cannot run', () => {
    mockBilling.canRunWorkflows = false
    mockBilling.isBuilderMode = true
    renderComponent()
    expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
  })

  it('hides in builder mode for a paid tier', () => {
    mockBilling.isFreeTier = false
    mockBilling.isBuilderMode = true
    renderComponent()
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()
  })
})
