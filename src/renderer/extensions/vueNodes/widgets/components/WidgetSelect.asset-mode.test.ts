import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    shouldUseAssetBrowser: vi.fn(() => true),
    isAssetAPIEnabled: vi.fn(() => true)
  }
}))

import { assetService } from '@/platform/assets/services/assetService'
const mockShouldUseAssetBrowser = vi.mocked(assetService.shouldUseAssetBrowser)

const stubs = {
  WidgetSelectDropdown: {
    template: '<div data-testid="widget-select-dropdown" />'
  },
  WidgetSelectDefault: {
    template: '<div data-testid="widget-select-default" />'
  },
  WidgetWithControl: {
    template: '<div data-testid="widget-with-control" />'
  }
}

describe('WidgetSelect asset mode', () => {
  const createWidget = () =>
    createMockWidget<string | undefined>({
      value: undefined,
      name: 'ckpt_name',
      type: 'combo',
      options: { values: [] }
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockShouldUseAssetBrowser.mockReturnValue(true)
  })

  const renderWidget = () => {
    return render(WidgetSelect, {
      props: {
        widget: createWidget(),
        modelValue: undefined,
        nodeType: 'CheckpointLoaderSimple'
      },
      global: {
        plugins: [PrimeVue, createTestingPinia(), i18n],
        stubs
      }
    })
  }

  it('uses dropdown when isCloud && UseAssetAPI && isEligible', async () => {
    renderWidget()
    await flushPromises()

    expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
  })

  it('uses default widget when shouldUseAssetBrowser returns false', () => {
    mockShouldUseAssetBrowser.mockReturnValue(false)
    renderWidget()

    expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
  })
})
