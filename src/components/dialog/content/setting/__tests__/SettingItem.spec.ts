// @ts-strict-ignore
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SettingItem from '../SettingItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en'
})

vi.mock('@/utils/formatUtil', () => ({
  normalizeI18nKey: vi.fn()
}))

describe('SettingItem', () => {
  const mountComponent = (props: any, options = {}): any => {
    return mount(SettingItem, {
      global: {
        plugins: [PrimeVue, i18n, createPinia()]
      },
      props,
      ...options
    })
  }

  it('translates options that use legacy type', () => {
    const wrapper = mountComponent({
      setting: {
        id: 'Comfy.NodeInputConversionSubmenus',
        name: 'Node Input Conversion Submenus',
        type: 'combo',
        value: 'Top',
        options: (value: string) => ['Correctly Translated']
      }
    })

    // Get the options property of the FormItem
    const options = wrapper.vm.formItem.options
    expect(options).toEqual([
      { text: 'Correctly Translated', value: 'Correctly Translated' }
    ])
  })
})
