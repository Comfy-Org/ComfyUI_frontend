import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
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

const options = [
  { name: 'Option A', value: 'a' },
  { name: 'Option B', value: 'b' },
  { name: 'Option C', value: 'c' }
]

function mountInParent(
  multiSelectProps: Record<string, unknown> = {},
  modelValue: { name: string; value: string }[] = []
) {
  const parentEscapeCount = { value: 0 }

  const Parent = {
    template:
      '<div @keydown.escape="onEsc"><MultiSelect v-model="sel" :options="options" v-bind="extraProps" /></div>',
    components: { MultiSelect },
    setup() {
      return {
        sel: ref(modelValue),
        options,
        extraProps: multiSelectProps,
        onEsc: () => {
          parentEscapeCount.value++
        }
      }
    }
  }

  const wrapper = mount(Parent, {
    attachTo: document.body,
    global: { plugins: [i18n] }
  })

  return { wrapper, parentEscapeCount }
}

function dispatchEscape(element: Element) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true
    })
  )
}

function findContentElement(): HTMLElement | null {
  return document.querySelector('[data-dismissable-layer]')
}

describe('MultiSelect', () => {
  it('keeps open-state border styling available while the dropdown is open', async () => {
    const { wrapper } = mountInParent()

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

  describe('Escape key propagation', () => {
    it('stops Escape from propagating to parent when popover is open', async () => {
      const { wrapper, parentEscapeCount } = mountInParent()

      const trigger = wrapper.find('button[aria-haspopup="listbox"]')
      await trigger.trigger('click')
      await nextTick()

      const content = findContentElement()
      expect(content).not.toBeNull()

      dispatchEscape(content!)
      await nextTick()

      expect(parentEscapeCount.value).toBe(0)

      wrapper.unmount()
    })

    it('closes the popover when Escape is pressed', async () => {
      const { wrapper } = mountInParent()

      const trigger = wrapper.find('button[aria-haspopup="listbox"]')
      await trigger.trigger('click')
      await nextTick()
      expect(trigger.attributes('data-state')).toBe('open')

      const content = findContentElement()
      dispatchEscape(content!)
      await nextTick()

      expect(trigger.attributes('data-state')).toBe('closed')

      wrapper.unmount()
    })
  })

  describe('selected count badge', () => {
    it('shows selected count when items are selected', () => {
      const { wrapper } = mountInParent({}, [
        { name: 'Option A', value: 'a' },
        { name: 'Option B', value: 'b' }
      ])

      expect(wrapper.text()).toContain('2')

      wrapper.unmount()
    })

    it('does not show count badge when no items are selected', () => {
      const { wrapper } = mountInParent()
      const multiSelect = wrapper.findComponent(MultiSelect)
      const spans = multiSelect.findAll('span')
      const countBadge = spans.find((s) => /^\d+$/.test(s.text().trim()))

      expect(countBadge).toBeUndefined()

      wrapper.unmount()
    })
  })
})
