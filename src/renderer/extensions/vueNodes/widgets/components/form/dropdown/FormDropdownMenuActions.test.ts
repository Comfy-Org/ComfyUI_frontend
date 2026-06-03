import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { OwnershipFilterOption } from '@/platform/assets/types/filterTypes'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import type { SortOption } from './types'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// The async search input pulls in network-y deps; stub it down to an input
// that re-emits the Enter key the way the real component does.
const AsyncSearchInputStub = defineComponent({
  emits: ['enter', 'update:modelValue'],
  template:
    '<input data-testid="search" @keydown.enter="$emit(\'enter\', $event)" />'
})

const sortOptions: SortOption[] = [
  { id: 'sort-a', name: 'Sort A', sorter: ({ items }) => [...items] },
  { id: 'sort-b', name: 'Sort B', sorter: ({ items }) => [...items] }
]

const ownershipOptions: OwnershipFilterOption[] = [
  { name: 'All', value: 'all' },
  { name: 'Mine', value: 'my-models' }
]

function renderActions(
  props: Record<string, unknown> = {},
  handlers: Record<string, unknown> = {}
) {
  return render(FormDropdownMenuActions, {
    global: {
      plugins: [i18n],
      stubs: { AsyncSearchInput: AsyncSearchInputStub }
    },
    props: {
      sortOptions,
      sortSelected: 'sort-a',
      ...props
    },
    attrs: handlers
  })
}

describe('FormDropdownMenuActions', () => {
  it('opens the settings menu with sort options and no view modes', async () => {
    renderActions()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('Sort A')).toBeInTheDocument()
    expect(screen.getByText('Sort B')).toBeInTheDocument()
    expect(screen.queryByText('List view')).toBeNull()
    expect(screen.queryByText('Grid view')).toBeNull()
  })

  it('updates sortSelected when a sort option is clicked', async () => {
    const onUpdate = vi.fn()
    renderActions({}, { 'onUpdate:sortSelected': onUpdate })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByText('Sort B'))
    expect(onUpdate).toHaveBeenCalledWith('sort-b')
  })

  it('updates ownershipSelected when an ownership option is clicked', async () => {
    const onUpdate = vi.fn()
    renderActions(
      { showOwnershipFilter: true, ownershipOptions },
      { 'onUpdate:ownershipSelected': onUpdate }
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ownership' }))
    await user.click(screen.getByText('Mine'))
    expect(onUpdate).toHaveBeenCalledWith('my-models')
  })

  it('emits search-enter when the search input fires Enter', async () => {
    const onSearchEnter = vi.fn()
    renderActions({}, { onSearchEnter })
    await userEvent.setup().type(screen.getByTestId('search'), '{enter}')
    expect(onSearchEnter).toHaveBeenCalled()
  })
})
