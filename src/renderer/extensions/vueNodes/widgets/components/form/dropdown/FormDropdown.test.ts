import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FormDropdown from './FormDropdown.vue'
import { DROPDOWN_PANEL_CLASS } from './shared'
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

const transformState = vi.hoisted(() => ({ camera: { x: 0, y: 0, z: 1 } }))

vi.mock('@/renderer/core/layout/transform/useTransformState', async () => {
  const { reactive } = await import('vue')
  transformState.camera = reactive(transformState.camera)
  return { useTransformState: () => ({ camera: transformState.camera }) }
})

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
    'baseModelOptions',
    'candidateIndex',
    'candidateLabel'
  ],
  template: `<div class="mock-menu" data-testid="dropdown-menu" :data-candidate-index="candidateIndex" :data-candidate-label="candidateLabel ?? ''" :data-items="JSON.stringify(items)">
      <button type="button" @click="$emit('search-enter')">Search enter</button>
    </div>`
}

const MockFormDropdownInput = {
  name: 'FormDropdownInput',
  setup(
    _: unknown,
    { expose }: { expose: (exposed: { focus: () => void }) => void }
  ) {
    const triggerButton = ref<HTMLButtonElement>()
    expose({
      focus: () => triggerButton.value?.focus()
    })
    return { triggerButton }
  },
  template:
    '<button ref="triggerButton" class="mock-dropdown-trigger" @click="$emit(\'select-click\', $event)">Open</button>'
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
  multiple?: boolean | number
  searchQuery?: string
  onUpdateSelected?: (selected: Set<string>) => void
  onUpdateIsOpen?: (isOpen: boolean) => void
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
    props: {
      items,
      multiple: options.multiple,
      searcher: options.searcher,
      searchQuery: options.searchQuery,
      'onUpdate:selected': options.onUpdateSelected,
      'onUpdate:isOpen': options.onUpdateIsOpen
    },
    global: {
      plugins: [PrimeVue, i18n, createPinia()],
      stubs: {
        FormDropdownInput: MockFormDropdownInput,
        Popover: MockPopover,
        FormDropdownMenu: MockFormDropdownMenu
      }
    }
  })
  return { ...result, user }
}

function getMenuItems(): FormDropdownItem[] {
  const menuEl = screen.getByTestId('dropdown-menu')
  return JSON.parse(menuEl.getAttribute('data-items') ?? '[]')
}

function getCandidateIndex(): number {
  const menuEl = screen.getByTestId('dropdown-menu')
  return Number(menuEl.getAttribute('data-candidate-index'))
}

function getCandidateLabel(): string {
  const menuEl = screen.getByTestId('dropdown-menu')
  return menuEl.getAttribute('data-candidate-label') ?? ''
}

async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open' }))
  await flushPromises()
}

describe('FormDropdown', () => {
  beforeEach(() => {
    transformState.camera.x = 0
    transformState.camera.y = 0
    transformState.camera.z = 1
  })

  describe('filteredItems updates when items prop changes', () => {
    it('updates displayed items when items prop changes', async () => {
      const { rerender } = mountDropdown([
        createItem('input-0', 'video1.mp4'),
        createItem('input-1', 'video2.mp4')
      ])
      await flushPromises()

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
      const { rerender } = mountDropdown([createItem('1', 'alpha')])
      await flushPromises()

      await rerender({ items: [createItem('1', 'beta')] })
      await flushPromises()

      expect(getMenuItems()[0].name).toBe('beta')
    })

    it('updates when switching between empty and non-empty items', async () => {
      const { rerender } = mountDropdown([])
      await flushPromises()

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
    expect(getMenuItems().map((item) => item.id)).toEqual(['3', '4'])
  })

  it('runs filtering when dropdown opens', async () => {
    const searcher = vi.fn(
      async (_query: string, sourceItems: FormDropdownItem[]) =>
        sourceItems.filter((item) => item.id === 'keep')
    )

    const { user } = mountDropdown(
      [createItem('keep', 'alpha'), createItem('drop', 'beta')],
      { searcher }
    )
    await flushPromises()

    await openDropdown(user)

    expect(searcher).toHaveBeenCalled()
    expect(getMenuItems().map((item) => item.id)).toEqual(['keep'])
  })

  it('selects the top matching item when Enter is pressed in search', async () => {
    const onUpdateSelected = vi.fn()
    const { user } = mountDropdown(
      [createItem('beta', 'beta.ckpt'), createItem('alpha', 'alpha.ckpt')],
      { searchQuery: 'alp', onUpdateSelected }
    )
    await openDropdown(user)

    await user.click(screen.getByRole('button', { name: 'Search enter' }))
    await flushPromises()

    expect(onUpdateSelected).toHaveBeenCalledWith(new Set(['alpha']))
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('does not select when Enter is pressed with an empty search query', async () => {
    const onUpdateSelected = vi.fn()
    const { user } = mountDropdown(
      [createItem('beta', 'beta.ckpt'), createItem('alpha', 'alpha.ckpt')],
      { onUpdateSelected }
    )
    await openDropdown(user)

    await user.click(screen.getByRole('button', { name: 'Search enter' }))
    await flushPromises()

    expect(onUpdateSelected).not.toHaveBeenCalled()
  })

  it('does not treat closed full-list items as current search results', async () => {
    const onUpdateSelected = vi.fn()
    const { user } = mountDropdown(
      [createItem('beta', 'beta.ckpt'), createItem('alpha', 'alpha.ckpt')],
      { searchQuery: 'alp', onUpdateSelected }
    )
    await flushPromises()

    expect(getCandidateIndex()).toBe(-1)

    await user.click(screen.getByRole('button', { name: 'Search enter' }))
    await flushPromises()

    expect(onUpdateSelected).not.toHaveBeenCalled()
  })

  it('searches the latest query before selecting the top search result', async () => {
    const onUpdateSelected = vi.fn()
    const searcher = vi.fn(
      async (query: string, sourceItems: FormDropdownItem[]) => {
        if (query.trim() === '') return sourceItems
        return sourceItems.filter((item) => item.name.includes(query))
      }
    )

    const items = [
      createItem('beta', 'beta.ckpt'),
      createItem('alpha', 'alpha.ckpt')
    ]
    const { rerender, user } = mountDropdown(items, {
      searcher,
      onUpdateSelected
    })
    await openDropdown(user)

    await rerender({
      items,
      searcher,
      searchQuery: 'alp',
      'onUpdate:selected': onUpdateSelected
    })

    expect(getCandidateIndex()).toBe(-1)

    await user.click(screen.getByRole('button', { name: 'Search enter' }))
    await flushPromises()

    expect(onUpdateSelected).toHaveBeenCalledWith(new Set(['alpha']))
    expect(searcher).toHaveBeenCalledWith('alp', items, expect.any(Function))
  })

  it('provides the candidate label for screen reader announcement', async () => {
    const { user } = mountDropdown(
      [createItem('beta', 'beta.ckpt'), createItem('alpha', 'alpha.ckpt')],
      { searchQuery: 'alp' }
    )
    await openDropdown(user)

    expect(getCandidateIndex()).toBe(0)
    expect(getCandidateLabel()).toBe('alpha.ckpt')
  })

  it('does not select a stale result if the query changes before Enter search resolves', async () => {
    const onUpdateSelected = vi.fn()
    let resolveAlphaSearch: () => void = () => {}
    const searcher = vi.fn((query: string, sourceItems: FormDropdownItem[]) => {
      if (query === 'alp') {
        return new Promise<FormDropdownItem[]>((resolve) => {
          resolveAlphaSearch = () =>
            resolve(sourceItems.filter((item) => item.name.includes(query)))
        })
      }

      if (query.trim() === '') return Promise.resolve(sourceItems)
      return Promise.resolve(
        sourceItems.filter((item) => item.name.includes(query))
      )
    })

    const items = [
      createItem('beta', 'beta.ckpt'),
      createItem('alpha', 'alpha.ckpt')
    ]
    const { rerender, user } = mountDropdown(items, {
      searcher,
      onUpdateSelected
    })
    await openDropdown(user)

    await rerender({
      items,
      searcher,
      searchQuery: 'alp',
      'onUpdate:selected': onUpdateSelected
    })
    await user.click(screen.getByRole('button', { name: 'Search enter' }))

    await rerender({
      items,
      searcher,
      searchQuery: 'bet',
      'onUpdate:selected': onUpdateSelected
    })
    resolveAlphaSearch()
    await flushPromises()

    expect(searcher).toHaveBeenCalledWith('alp', items, expect.any(Function))
    expect(onUpdateSelected).not.toHaveBeenCalled()
  })

  it('closes on a pointerdown outside the menu and trigger', async () => {
    const onUpdateIsOpen = vi.fn()
    const { user } = mountDropdown([createItem('1', 'alpha')], {
      onUpdateIsOpen
    })
    await openDropdown(user)

    expect(onUpdateIsOpen).toHaveBeenLastCalledWith(true)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(onUpdateIsOpen).toHaveBeenLastCalledWith(false)
    outside.remove()
  })

  it('closes when the canvas viewport moves', async () => {
    const onUpdateIsOpen = vi.fn()
    const { user } = mountDropdown([createItem('1', 'alpha')], {
      onUpdateIsOpen
    })
    await openDropdown(user)

    expect(onUpdateIsOpen).toHaveBeenLastCalledWith(true)

    transformState.camera.x += 77
    await flushPromises()

    expect(onUpdateIsOpen).toHaveBeenLastCalledWith(false)
  })

  it('stays open on a pointerdown inside the menu', async () => {
    const onUpdateIsOpen = vi.fn()
    const { user } = mountDropdown([createItem('1', 'alpha')], {
      onUpdateIsOpen
    })
    await openDropdown(user)

    screen
      .getByTestId('dropdown-menu')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(onUpdateIsOpen).toHaveBeenLastCalledWith(true)
  })

  it('stays open on a pointerdown inside a body-teleported sub-popover panel', async () => {
    const onUpdateIsOpen = vi.fn()
    const { user } = mountDropdown([createItem('1', 'alpha')], {
      onUpdateIsOpen
    })
    await openDropdown(user)

    const panel = document.createElement('div')
    panel.classList.add(DROPDOWN_PANEL_CLASS)
    const option = document.createElement('button')
    panel.appendChild(option)
    document.body.appendChild(panel)

    option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(onUpdateIsOpen).toHaveBeenLastCalledWith(true)
    panel.remove()
  })

  it('does not select a search result from multi-select dropdowns', async () => {
    const onUpdateSelected = vi.fn()
    const { user } = mountDropdown(
      [createItem('beta', 'beta.ckpt'), createItem('alpha', 'alpha.ckpt')],
      { multiple: true, searchQuery: 'alp', onUpdateSelected }
    )
    await openDropdown(user)

    expect(getCandidateIndex()).toBe(-1)

    await user.click(screen.getByRole('button', { name: 'Search enter' }))
    await flushPromises()

    expect(onUpdateSelected).not.toHaveBeenCalled()
  })
})
