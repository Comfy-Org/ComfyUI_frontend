import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

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

const mockState = vi.hoisted(() => ({
  holder: null as null | { isFreeTier: boolean; promptMounted: boolean }
}))

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { computed, reactive } = await import('vue')
  mockState.holder ??= reactive({ isFreeTier: true, promptMounted: false })
  return {
    useBillingContext: vi.fn(() => ({
      isFreeTier: computed(() => mockState.holder!.isFreeTier)
    }))
  }
})

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscribeCtaPresence',
  async () => {
    const { computed, reactive } = await import('vue')
    mockState.holder ??= reactive({ isFreeTier: true, promptMounted: false })
    return {
      useSubscribeToRunPromptPresence: () =>
        computed(() => mockState.holder!.promptMounted)
    }
  }
)

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

function renderComponent() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(TopbarSubscribeButton, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('TopbarSubscribeButton', () => {
  beforeEach(() => {
    mockState.holder!.isFreeTier = true
    mockState.holder!.promptMounted = false
  })

  it('renders on cloud when isFreeTier is true', () => {
    mockIsCloud.value = true
    renderComponent()
    expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
  })

  it('yields while a Run-slot subscribe prompt is mounted, and returns when it unmounts', async () => {
    mockIsCloud.value = true
    mockState.holder!.promptMounted = true
    renderComponent()
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()

    mockState.holder!.promptMounted = false
    await nextTick()
    expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
  })

  it('hides on non-cloud distribution', () => {
    mockIsCloud.value = false
    renderComponent()
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()
  })
})
