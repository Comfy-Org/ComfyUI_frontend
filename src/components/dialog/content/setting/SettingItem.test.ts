/* eslint-disable testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tag from 'primevue/tag'
import Tooltip from 'primevue/tooltip'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SettingItem from '@/platform/settings/components/SettingItem.vue'
import type { SettingParams } from '@/platform/settings/types'

const i18n = createI18n({
  legacy: false,
  locale: 'en'
})

vi.mock('@/utils/formatUtil', () => ({
  normalizeI18nKey: vi.fn()
}))

const FormItemStub = defineComponent({
  name: 'FormItem',
  props: {
    item: { type: Object, default: () => ({}) },
    id: { type: String, default: undefined },
    formValue: { type: null, default: undefined }
  },
  setup(props) {
    return () =>
      h('div', { 'data-testid': 'form-item-data' }, JSON.stringify(props.item))
  }
})

describe('SettingItem', () => {
  function renderComponent(setting: SettingParams) {
    return render(SettingItem, {
      global: {
        plugins: [PrimeVue, i18n, createPinia()],
        components: { Tag },
        stubs: {
          FormItem: FormItemStub,
          'i-material-symbols:experiment-outline': true
        },
        directives: { tooltip: Tooltip }
      },
      props: { setting }
    })
  }

  function getFormItemData(container: Element) {
    const el = container.querySelector('[data-testid="form-item-data"]')
    return JSON.parse(el!.textContent!)
  }

  it('translates options that use legacy type', () => {
    const { container } = renderComponent(
      fromAny({
        id: 'Comfy.NodeInputConversionSubmenus',
        name: 'Node Input Conversion Submenus',
        type: 'combo',
        defaultValue: 'Top',
        options: () => ['Correctly Translated']
      })
    )

    const data = getFormItemData(container)
    expect(data.options).toEqual([
      { text: 'Correctly Translated', value: 'Correctly Translated' }
    ])
  })

  it('handles tooltips with @ symbols without errors', () => {
    const { container } = renderComponent(
      fromAny({
        id: 'Comfy.NodeInputConversionSubmenus',
        name: 'Test Setting',
        type: 'boolean',
        defaultValue: false,
        tooltip:
          'This will load a larger version of @mtb/markdown-parser that bundles shiki'
      })
    )

    const data = getFormItemData(container)
    expect(data.tooltip).toBe(
      'This will load a larger version of @mtb/markdown-parser that bundles shiki'
    )
  })
})
