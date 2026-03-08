import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import FormDropdown from './FormDropdown.vue'
import type { FormDropdownItem } from './types'

function createItem(id: string, name: string): FormDropdownItem {
  return { id, preview_url: '', name, label: name }
}

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    addAlert: vi.fn()
  })
}))

const MockFormDropdownMenu = defineComponent({
  name: 'FormDropdownMenu',
  props: {
    items: { type: Array as () => FormDropdownItem[], default: () => [] },
    updateKey: { type: null, default: undefined },
    searcher: { type: Function, default: undefined },
    isSelected: { type: Function, default: undefined },
    filterOptions: { type: Array, default: () => [] },
    sortOptions: { type: Array, default: () => [] },
    maxSelectable: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    showOwnershipFilter: { type: Boolean, default: false },
    ownershipOptions: { type: Array, default: () => [] },
    showBaseModelFilter: { type: Boolean, default: false },
    baseModelOptions: { type: Array, default: () => [] }
  },
  setup() {
    return () => h('div', { class: 'mock-menu' })
  }
})

function mountDropdown(items: FormDropdownItem[]) {
  return mount(FormDropdown, {
    props: { items },
    global: {
      plugins: [PrimeVue, i18n],
      stubs: {
        FormDropdownInput: true,
        Popover: { template: '<div><slot /></div>' },
        FormDropdownMenu: MockFormDropdownMenu
      }
    }
  })
}

function getMenuItems(
  wrapper: ReturnType<typeof mountDropdown>
): FormDropdownItem[] {
  return wrapper
    .findComponent(MockFormDropdownMenu)
    .props('items') as FormDropdownItem[]
}

describe('FormDropdown', () => {
  describe('filteredItems updates when items prop changes', () => {
    it('updates displayed items when items prop changes', async () => {
      const wrapper = mountDropdown([
        createItem('input-0', 'video1.mp4'),
        createItem('input-1', 'video2.mp4')
      ])
      await nextTick()
      await nextTick()

      expect(getMenuItems(wrapper)).toHaveLength(2)

      await wrapper.setProps({
        items: [
          createItem('output-0', 'rendered1.mp4'),
          createItem('output-1', 'rendered2.mp4')
        ]
      })
      await nextTick()
      await nextTick()

      const menuItems = getMenuItems(wrapper)
      expect(menuItems).toHaveLength(2)
      expect(menuItems[0].name).toBe('rendered1.mp4')
    })

    it('updates when items change but IDs stay the same', async () => {
      const wrapper = mountDropdown([createItem('1', 'alpha')])
      await nextTick()
      await nextTick()

      await wrapper.setProps({ items: [createItem('1', 'beta')] })
      await nextTick()
      await nextTick()

      expect(getMenuItems(wrapper)[0].name).toBe('beta')
    })

    it('updates when switching between empty and non-empty items', async () => {
      const wrapper = mountDropdown([])
      await nextTick()
      await nextTick()

      expect(getMenuItems(wrapper)).toHaveLength(0)

      await wrapper.setProps({ items: [createItem('1', 'video.mp4')] })
      await nextTick()
      await nextTick()

      expect(getMenuItems(wrapper)).toHaveLength(1)
      expect(getMenuItems(wrapper)[0].name).toBe('video.mp4')

      await wrapper.setProps({ items: [] })
      await nextTick()
      await nextTick()

      expect(getMenuItems(wrapper)).toHaveLength(0)
    })
  })
})
