import { render, screen } from '@testing-library/vue'
import { it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'

import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import WidgetSelect from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
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
    useModelToNodeStore().registerNodeProvider('checkpoints', {
      nodeDef: new ComfyNodeDefImpl({
        name: 'ModelLoader',
        display_name: 'ModelLoader',
        category: 'loaders',
        python_module: 'nodes',
        description: '',
        input: { required: {} },
        output: [],
        output_node: false
      }),
      key: 'model'
    })
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
