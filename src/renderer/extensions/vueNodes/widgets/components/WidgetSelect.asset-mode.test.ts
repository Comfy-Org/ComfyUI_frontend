import { getActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { assetService } from '@/platform/assets/services/assetService'
import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

vi.mock(import('@/platform/assets/services/assetService'), { spy: true })

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
    vi.mocked(assetService.isAssetBrowserEligible).mockReturnValue(true)
    vi.mocked(assetService.shouldUseWidgetAssetPicker).mockReturnValue(true)
    vi.mocked(assetService.isWidgetAssetPickerEnabled).mockReturnValue(true)
  })

  const renderWidget = () => {
    return render(WidgetSelect, {
      props: {
        widget: createWidget(),
        modelValue: undefined,
        nodeType: 'CheckpointLoaderSimple'
      },
      global: {
        plugins: [getActivePinia()!, i18n],
        stubs
      }
    })
  }

  it('uses dropdown when isCloud && isEligible', async () => {
    renderWidget()
    await flushPromises()

    expect(screen.getByTestId('widget-select-dropdown')).toBeInTheDocument()
  })

  it('uses default widget when shouldUseWidgetAssetPicker returns false', () => {
    vi.mocked(assetService.shouldUseWidgetAssetPicker).mockReturnValue(false)
    renderWidget()

    expect(screen.getByTestId('widget-select-default')).toBeInTheDocument()
  })

  it('does not fabricate a selection for a null model value', async () => {
    const widget = createMockWidget<string | undefined>({
      value: undefined,
      name: 'image',
      type: 'combo',
      options: { values: ['first.png', 'second.png'] },
      spec: {
        type: 'COMBO',
        name: 'image',
        image_upload: true
      }
    })
    render(WidgetSelect, {
      props: {
        widget,
        modelValue: null,
        nodeType: 'ImageLoader'
      },
      global: {
        plugins: [getActivePinia()!, i18n],
        stubs: {
          WidgetSelectDefault: stubs.WidgetSelectDefault,
          WidgetWithControl: stubs.WidgetWithControl
        }
      }
    })
    await flushPromises()

    expect(screen.queryByText('first.png')).not.toBeInTheDocument()
  })
})
