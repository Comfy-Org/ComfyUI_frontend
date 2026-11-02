import { render, screen } from '@testing-library/vue'
import { it, expect, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { assetService } from '@/platform/assets/services/assetService'
import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'

it.for([
  {
    name: 'model',
    unifiedRows: true,
    value: 'studio/model.safetensors',
    expected: 'model.safetensors'
  },
  {
    name: 'schedule',
    unifiedRows: true,
    value: 'schedule/custom',
    expected: 'schedule/custom'
  },
  {
    name: 'model',
    unifiedRows: false,
    value: 'studio/model.safetensors',
    expected: 'studio/model.safetensors'
  }
])(
  'summarizes $name with node rows $unifiedRows',
  ({ name, unifiedRows, value, expected }) => {
    vi.spyOn(assetService, 'isAssetBrowserEligible').mockImplementation(
      (nodeType, widgetName) =>
        nodeType === 'ModelLoader' && widgetName === 'model'
    )
    render(WidgetSelect, {
      props: {
        widget: { name, type: 'combo', value, options: { values: [value] } },
        nodeType: 'ModelLoader',
        modelValue: value
      },
      global: {
        plugins: [
          createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
        ],
        provide: { [UnifiedWidgetRowsKey]: unifiedRows }
      }
    })
    expect(screen.getByRole('combobox').textContent.trim()).toBe(expected)
  }
)
