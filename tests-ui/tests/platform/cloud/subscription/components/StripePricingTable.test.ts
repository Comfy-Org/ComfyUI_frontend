import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import StripePricingTable from '@/platform/cloud/subscription/components/StripePricingTable.vue'

const mockLoadScript = vi.fn()
let currentConfig = {
  publishableKey: 'pk_test_123',
  pricingTableId: 'prctbl_123'
}
let hasConfig = true

vi.mock('@/config/stripePricingTableConfig', () => ({
  getStripePricingTableConfig: () => currentConfig,
  hasStripePricingTableConfig: () => hasConfig
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useStripePricingTableLoader',
  () => ({
    useStripePricingTableLoader: () => ({
      loadScript: mockLoadScript,
      isLoaded: { value: false },
      isLoading: { value: false },
      error: { value: null }
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
    mockLoadScript.mockReset().mockResolvedValue(undefined)
  })

  it('renders the Stripe pricing table when config is available', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    expect(mockLoadScript).toHaveBeenCalled()
    expect(wrapper.find('stripe-pricing-table').exists()).toBe(true)
  })

  it('shows missing config message when credentials are absent', () => {
    hasConfig = false
    currentConfig = { publishableKey: '', pricingTableId: '' }

    const wrapper = mountComponent()

    expect(
      wrapper.find('[data-testid="stripe-table-missing-config"]').exists()
    ).toBe(true)
    expect(mockLoadScript).not.toHaveBeenCalled()
  })
})
