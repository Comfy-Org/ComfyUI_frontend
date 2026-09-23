import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useSubscribeToRunPromptPresence } from '@/platform/cloud/subscription/composables/useSubscribeCtaPresence'

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

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscribeCtaPresence')
)

function renderComponent(promptMounted = computed(() => false)) {
  const billing = useBillingContext()
  billing.isFreeTier = computed(() => true)
  vi.mocked(useBillingContext).mockReturnValue(billing)
  vi.mocked(useSubscribeToRunPromptPresence).mockReturnValue(promptMounted)
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(TopbarSubscribeButton, {
    global: {
      plugins: [i18n, getActivePinia()!]
    }
  })
}

describe('TopbarSubscribeButton', () => {
  it('renders on cloud when isFreeTier is true', () => {
    mockIsCloud.value = true
    renderComponent()
    expect(screen.getByTestId('topbar-subscribe-button')).toBeInTheDocument()
  })

  it('yields while a Run-slot subscribe prompt is mounted, and returns when it unmounts', async () => {
    mockIsCloud.value = true
    const promptMounted = ref(true)
    renderComponent(computed(() => promptMounted.value))
    expect(
      screen.queryByTestId('topbar-subscribe-button')
    ).not.toBeInTheDocument()

    promptMounted.value = false
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
