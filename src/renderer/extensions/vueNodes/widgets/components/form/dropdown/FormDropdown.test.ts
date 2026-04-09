import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
  template:
    '<div class="mock-menu" data-testid="dropdown-menu" :data-items="JSON.stringify(items)" />'
}

const MockFormDropdownInput = {
  name: 'FormDropdownInput',
  template:
    '<button class="mock-dropdown-trigger" @click="$emit(\'select-click\', $event)">Open</button>'
}

interface MountDropdownOptions {
  searcher?: (
    query: string,
    items: FormDropdownItem[],
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<FormDropdownItem[]>
  searchQuery?: string
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function mountDropdown(
  items: FormDropdownItem[],
  options: MountDropdownOptions = {}
) {
  const user = userEvent.setup()
  const result = render(FormDropdown, {
    props: { items, ...options },
    global: {
      plugins: [PrimeVue, i18n],
      stubs: {
        FormDropdownInput: MockFormDropdownInput,
        FormDropdownMenu: MockFormDropdownMenu
      }
    }
  })
  return { ...result, user }
}

async function openDropdown(
  container: Element,
  user: ReturnType<typeof userEvent.setup>
) {
  // eslint-disable-next-line testing-library/no-node-access
  const trigger = container.querySelector(
    '.mock-dropdown-trigger'
  ) as HTMLElement
  await user.click(trigger)
  await flushPromises()
}

function getMenuItems(): FormDropdownItem[] {
  const menuEl = screen.getByTestId('dropdown-menu')
  return JSON.parse(menuEl.getAttribute('data-items') ?? '[]')
}

describe('FormDropdown', () => {
  describe('filteredItems updates when items prop changes', () => {
    it('updates displayed items when items prop changes', async () => {
      const { rerender, container, user } = mountDropdown([
        createItem('input-0', 'video1.mp4'),
        createItem('input-1', 'video2.mp4')
      ])
      await openDropdown(container, user)

      expect(getMenuItems()).toHaveLength(2)

      await rerender({
        items: [
          createItem('output-0', 'rendered1.mp4'),
          createItem('output-1', 'rendered2.mp4')
        ]
      })
      await flushPromises()

      const menuItems = getMenuItems()
      expect(menuItems).toHaveLength(2)
      expect(menuItems[0].name).toBe('rendered1.mp4')
    })

    it('updates when items change but IDs stay the same', async () => {
      const { rerender, container, user } = mountDropdown([
        createItem('1', 'alpha')
      ])
      await openDropdown(container, user)

      await rerender({ items: [createItem('1', 'beta')] })
      await flushPromises()

      expect(getMenuItems()[0].name).toBe('beta')
    })

    it('updates when switching between empty and non-empty items', async () => {
      const { rerender, container, user } = mountDropdown([])
      await openDropdown(container, user)

      expect(getMenuItems()).toHaveLength(0)

      await rerender({ items: [createItem('1', 'video.mp4')] })
      await flushPromises()

      expect(getMenuItems()).toHaveLength(1)
      expect(getMenuItems()[0].name).toBe('video.mp4')

      await rerender({ items: [] })
      await flushPromises()

      expect(getMenuItems()).toHaveLength(0)
    })
  })

  it('avoids filtering work while dropdown is closed', async () => {
    const searcher = vi.fn(
      async (_query: string, sourceItems: FormDropdownItem[]) =>
        sourceItems.filter((item) => item.name.includes('video'))
    )

    const { rerender } = mountDropdown(
      [createItem('1', 'video-a.mp4'), createItem('2', 'video-b.mp4')],
      { searcher }
    )
    await flushPromises()

    expect(searcher).not.toHaveBeenCalled()

    await rerender({
      items: [createItem('1', 'video-a.mp4'), createItem('2', 'video-b.mp4')],
      searcher,
      searchQuery: 'video-a'
    })
    await rerender({
      items: [createItem('3', 'video-c.mp4'), createItem('4', 'video-d.mp4')],
      searcher,
      searchQuery: 'video-a'
    })
    await flushPromises()

    expect(searcher).not.toHaveBeenCalled()
  })

  it('runs filtering when dropdown opens', async () => {
    const searcher = vi.fn(
      async (_query: string, sourceItems: FormDropdownItem[]) =>
        sourceItems.filter((item) => item.id === 'keep')
    )

    const { container, user } = mountDropdown(
      [createItem('keep', 'alpha'), createItem('drop', 'beta')],
      { searcher }
    )
    await flushPromises()

    await openDropdown(container, user)

    expect(searcher).toHaveBeenCalled()
    expect(getMenuItems().map((item) => item.id)).toEqual(['keep'])
  })
})
