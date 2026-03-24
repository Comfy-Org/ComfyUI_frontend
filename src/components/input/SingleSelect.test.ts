import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SingleSelect from './SingleSelect.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        singleSelectDropdown: 'Single-select dropdown'
      }
    }
  }
})

const options = [
  { name: 'Option A', value: 'a' },
  { name: 'Option B', value: 'b' },
  { name: 'Option C', value: 'c' }
]

function dispatchEscape(element: Element) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true
    })
  )
}

function mountInParent(modelValue?: string) {
  let parentEscapeCalled = false

  const Parent = {
    template:
      '<div @keydown.escape="onEsc"><SingleSelect v-model="sel" :options="options" label="Pick" /></div>',
    components: { SingleSelect },
    setup() {
      return {
        sel: ref(modelValue),
        options,
        onEsc: () => {
          parentEscapeCalled = true
        }
      }
    }
  }

  const wrapper = mount(Parent, {
    attachTo: document.body,
    global: { plugins: [i18n] }
  })

  return { wrapper, wasParentEscapeCalled: () => parentEscapeCalled }
}

describe('SingleSelect', () => {
  describe('Escape key propagation', () => {
    it('stops Escape from propagating to parent elements', () => {
      const { wrapper, wasParentEscapeCalled } = mountInParent()

      const trigger = wrapper.find('button[role="combobox"]')
      dispatchEscape(trigger.element)

      expect(wasParentEscapeCalled()).toBe(false)

      wrapper.unmount()
    })
  })
})
