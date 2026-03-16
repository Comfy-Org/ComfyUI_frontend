import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

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

const MockFormDropdownMenu = {
  name: 'FormDropdownMenu',
  props: [
    'items',
    'isSelected',
    'filterOptions',
    'sortOptions',
    'maxSelectable',
    'disabled',
    'showOwnershipFilter',
    'ownershipOptions',
    'showBaseModelFilter',
    'baseModelOptions'
  ],
  template: '<div class="mock-menu" />'
}

const MockFormDropdownInput = {
  name: 'FormDropdownInput',
  template:
    '<button class="mock-dropdown-trigger" @click="$emit(\'select-click\', $event)">Open</button>'
}

const MockPopover = {
  name: 'Popover',
  template: '<div><slot /></div>'
}

interface MountDropdownOptions {
  searcher?: (
    query: string,
    items: FormDropdownItem[],
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<FormDropdownItem[]>
  searchQuery?: string
}

function mountDropdown(
  items: FormDropdownItem[],
  options: MountDropdownOptions = {}
) {
  return mount(FormDropdown, {
    props: { items, ...options },
    global: {
      plugins: [PrimeVue, i18n],
      stubs: {
        FormDropdownInput: MockFormDropdownInput,
        Popover: MockPopover,
        FormDropdownMenu: MockFormDropdownMenu
      }
    }
  })
}

function getMenuItems(
  wrapper: ReturnType<typeof mountDropdown>
): FormDropdownItem[] {
  return wrapper
    .findComponent({ name: 'FormDropdownMenu' })
    .props('items') as FormDropdownItem[]
}

describe('FormDropdown', () => {
  describe('filteredItems updates when items prop changes', () => {
    it('updates displayed items when items prop changes', async () => {
      const wrapper = mountDropdown([
        createItem('input-0', 'video1.mp4'),
        createItem('input-1', 'video2.mp4')
      ])
      await flushPromises()

      expect(getMenuItems(wrapper)).toHaveLength(2)

      await wrapper.setProps({
        items: [
          createItem('output-0', 'rendered1.mp4'),
          createItem('output-1', 'rendered2.mp4')
        ]
      })
      await flushPromises()

      const menuItems = getMenuItems(wrapper)
      expect(menuItems).toHaveLength(2)
      expect(menuItems[0].name).toBe('rendered1.mp4')
    })

    it('updates when items change but IDs stay the same', async () => {
      const wrapper = mountDropdown([createItem('1', 'alpha')])
      await flushPromises()

      await wrapper.setProps({ items: [createItem('1', 'beta')] })
      await flushPromises()

      expect(getMenuItems(wrapper)[0].name).toBe('beta')
    })

    it('updates when switching between empty and non-empty items', async () => {
      const wrapper = mountDropdown([])
      await flushPromises()

      expect(getMenuItems(wrapper)).toHaveLength(0)

      await wrapper.setProps({ items: [createItem('1', 'video.mp4')] })
      await flushPromises()

      expect(getMenuItems(wrapper)).toHaveLength(1)
      expect(getMenuItems(wrapper)[0].name).toBe('video.mp4')

      await wrapper.setProps({ items: [] })
      await flushPromises()

      expect(getMenuItems(wrapper)).toHaveLength(0)
    })
  })

  it('avoids filtering work while dropdown is closed', async () => {
    const searcher = vi.fn(
      async (_query: string, sourceItems: FormDropdownItem[]) =>
        sourceItems.filter((item) => item.name.includes('video'))
    )

    const wrapper = mountDropdown(
      [createItem('1', 'video-a.mp4'), createItem('2', 'video-b.mp4')],
      { searcher }
    )
    await flushPromises()

    expect(searcher).not.toHaveBeenCalled()

    await wrapper.setProps({ searchQuery: 'video-a' })
    await wrapper.setProps({
      items: [createItem('3', 'video-c.mp4'), createItem('4', 'video-d.mp4')]
    })
    await flushPromises()

    expect(searcher).not.toHaveBeenCalled()
    expect(getMenuItems(wrapper).map((item) => item.id)).toEqual(['3', '4'])
  })

  it('runs filtering when dropdown opens', async () => {
    const searcher = vi.fn(
      async (_query: string, sourceItems: FormDropdownItem[]) =>
        sourceItems.filter((item) => item.id === 'keep')
    )

    const wrapper = mountDropdown(
      [createItem('keep', 'alpha'), createItem('drop', 'beta')],
      { searcher }
    )
    await flushPromises()

    await wrapper.find('.mock-dropdown-trigger').trigger('click')
    await flushPromises()

    expect(searcher).toHaveBeenCalled()
    expect(getMenuItems(wrapper).map((item) => item.id)).toEqual(['keep'])
  })
})
