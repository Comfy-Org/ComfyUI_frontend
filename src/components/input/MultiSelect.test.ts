import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import MultiSelect from './MultiSelect.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        multiSelectDropdown: 'Multi-select dropdown',
        noResultsFound: 'No results found',
        search: 'Search',
        clearAll: 'Clear all',
        itemsSelected: 'Items selected'
      }
    }
  }
})

describe('MultiSelect', () => {
  function createWrapper() {
    return mount(MultiSelect, {
      attachTo: document.body,
      global: {
        plugins: [i18n]
      },
      props: {
        modelValue: [],
        label: 'Category',
        options: [
          { name: 'One', value: 'one' },
          { name: 'Two', value: 'two' }
        ]
      }
    })
  }

  it('keeps open-state border styling available while the dropdown is open', async () => {
    const wrapper = createWrapper()

    const trigger = wrapper.get('button[aria-haspopup="listbox"]')

    expect(trigger.classes()).toContain(
      'data-[state=open]:border-node-component-border'
    )
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.attributes('data-state')).toBe('open')

    wrapper.unmount()
  })
})
