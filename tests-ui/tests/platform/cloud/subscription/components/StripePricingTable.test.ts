import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import StripePricingTable from '@/platform/cloud/subscription/components/StripePricingTable.vue'

const mockLoadStripeScript = vi.fn()
let currentConfig = {
  publishableKey: 'pk_test_123',
  pricingTableId: 'prctbl_123'
}
let hasConfig = true

vi.mock('@/config/stripePricingTableConfig', () => ({
  getStripePricingTableConfig: () => currentConfig,
  hasStripePricingTableConfig: () => hasConfig
}))

const mockIsLoaded = ref(false)
const mockIsLoading = ref(false)
const mockError = ref(null)

vi.mock(
  '@/platform/cloud/subscription/composables/useStripePricingTableLoader',
  () => ({
    useStripePricingTableLoader: () => ({
      loadScript: mockLoadStripeScript,
      isLoaded: mockIsLoaded,
      isLoading: mockIsLoading,
      error: mockError
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const mountComponent = () =>
  mount(StripePricingTable, {
    global: {
      plugins: [i18n]
    }
  })

describe('StripePricingTable', () => {
  beforeEach(() => {
    currentConfig = {
      publishableKey: 'pk_test_123',
      pricingTableId: 'prctbl_123'
    }
    hasConfig = true
    mockLoadStripeScript.mockReset().mockResolvedValue(undefined)
    mockIsLoaded.value = false
    mockIsLoading.value = false
    mockError.value = null
  })

  it('renders the Stripe pricing table when config is available', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    expect(mockLoadStripeScript).toHaveBeenCalled()

    const stripePricingTable = wrapper.find('stripe-pricing-table')
    expect(stripePricingTable.exists()).toBe(true)
    expect(stripePricingTable.attributes('publishable-key')).toBe('pk_test_123')
    expect(stripePricingTable.attributes('pricing-table-id')).toBe('prctbl_123')
  })

  it('shows missing config message when credentials are absent', () => {
    hasConfig = false
    currentConfig = { publishableKey: '', pricingTableId: '' }

    const wrapper = mountComponent()

    expect(
      wrapper.find('[data-testid="stripe-table-missing-config"]').exists()
    ).toBe(true)
    expect(mockLoadStripeScript).not.toHaveBeenCalled()
  })
})
