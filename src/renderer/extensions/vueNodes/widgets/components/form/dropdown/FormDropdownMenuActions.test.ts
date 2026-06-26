import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slots } from 'vue'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import type { LayoutMode, SortOption } from './types'

vi.mock('@/components/ui/dropdown-menu/DropdownMenu.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', { 'data-testid': 'dropdown-menu' }, slots.default?.())
}))

vi.mock('@/components/ui/dropdown-menu/DropdownMenuTrigger.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', { 'data-testid': 'dropdown-menu-trigger' }, slots.default?.())
}))

vi.mock('@/components/ui/dropdown-menu/DropdownMenuContent.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', { 'data-testid': 'dropdown-menu-content' }, slots.default?.())
}))

vi.mock('@/components/ui/dropdown-menu/DropdownMenuItem.vue', () => ({
  default: (
    _: unknown,
    { slots, emit }: { slots: Slots; emit: (e: string, ev: Event) => void }
  ) =>
    h(
      'button',
      {
        type: 'button',
        onClick: (event: Event) => emit('select', event)
      },
      [slots.icon?.(), slots.default?.()]
    )
}))

vi.mock('@/components/ui/dropdown-menu/DropdownMenuSeparator.vue', () => ({
  default: () => h('hr')
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const ButtonStub = defineComponent({
  inheritAttrs: false,
  template: '<button v-bind="$attrs" type="button"><slot /></button>'
})

const sortOptions: SortOption[] = [
  { id: 'sort-a', name: 'Sort A', sorter: ({ items }) => [...items] },
  { id: 'sort-b', name: 'Sort B', sorter: ({ items }) => [...items] }
]

const ownershipOptions: OwnershipFilterOption[] = [
  { name: 'All', value: 'all' },
  { name: 'Mine', value: 'my-models' }
]

const baseModelOptions: FilterOption[] = [
  { name: 'Model A', value: 'model-a' },
  { name: 'Model B', value: 'model-b' }
]

type MenuProps = {
  showOwnershipFilter?: boolean
  showBaseModelFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  baseModelOptions?: FilterOption[]
  layoutMode?: LayoutMode
  searchQuery?: string
  sortSelected?: string
  ownershipSelected?: OwnershipOption
  baseModelSelected?: Set<string>
  candidateLabel?: string
  onSearchEnter?: () => void
}

function renderMenu(props: MenuProps = {}) {
  const layoutMode = ref<LayoutMode>(props.layoutMode ?? 'list')
  const searchQuery = ref<string>(props.searchQuery ?? '')
  const sortSelected = ref<string>(props.sortSelected ?? 'default')
  const ownershipSelected = ref<OwnershipOption>(
    props.ownershipSelected ?? 'all'
  )
  const baseModelSelected = ref<Set<string>>(
    props.baseModelSelected ?? new Set()
  )
  const ownershipOptionsProp = props.ownershipOptions ?? ownershipOptions
  const baseModelOptionsProp = props.baseModelOptions ?? baseModelOptions

  const Harness = defineComponent({
    components: { FormDropdownMenuActions },
    setup: () => ({
      layoutMode,
      searchQuery,
      sortSelected,
      ownershipSelected,
      baseModelSelected,
      sortOptions,
      ownershipOptions: ownershipOptionsProp,
      baseModelOptions: baseModelOptionsProp,
      showOwnershipFilter: props.showOwnershipFilter ?? false,
      showBaseModelFilter: props.showBaseModelFilter ?? false,
      candidateLabel: props.candidateLabel,
      onSearchEnter: () => props.onSearchEnter?.()
    }),
    template: `
      <FormDropdownMenuActions
        v-model:layout-mode="layoutMode"
        v-model:search-query="searchQuery"
        v-model:sort-selected="sortSelected"
        v-model:ownership-selected="ownershipSelected"
        v-model:base-model-selected="baseModelSelected"
        :sort-options
        :show-ownership-filter
        :ownership-options
        :show-base-model-filter
        :base-model-options
        :candidate-label
        @search-enter="onSearchEnter"
      />
    `
  })

  const user = userEvent.setup()
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: { Button: ButtonStub }
    }
  })
  return {
    ...utils,
    user,
    layoutMode,
    searchQuery,
    sortSelected,
    ownershipSelected,
    baseModelSelected
  }
}

describe('FormDropdownMenuActions', () => {
  describe('Search', () => {
    it('binds search input to v-model on initial render', () => {
      renderMenu({ searchQuery: 'seed' })
      expect(screen.getByRole('textbox')).toHaveValue('seed')
    })

    it('propagates typed input up to searchQuery v-model', async () => {
      const { searchQuery, user } = renderMenu({ searchQuery: '' })
      await user.type(screen.getByRole('textbox'), 'abc')
      expect(searchQuery.value).toBe('abc')
    })

    it('clears searchQuery when the user clears the textbox', async () => {
      const { searchQuery, user } = renderMenu({ searchQuery: 'seed' })
      await user.clear(screen.getByRole('textbox'))
      expect(searchQuery.value).toBe('')
    })

    it('emits search-enter when Enter is pressed in the textbox', async () => {
      const onSearchEnter = vi.fn()
      const { user } = renderMenu({ onSearchEnter })
      await user.type(screen.getByRole('textbox'), '{Enter}')
      expect(onSearchEnter).toHaveBeenCalledTimes(1)
    })

    it('announces the current top result to screen readers', () => {
      renderMenu({ candidateLabel: 'alpha.ckpt' })
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(status).toHaveTextContent('Top result: alpha.ckpt')
    })
  })

  describe('Sort menu', () => {
    it('renders sort options', () => {
      renderMenu()
      expect(screen.getByRole('button', { name: 'Sort A' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sort B' })).toBeInTheDocument()
    })

    it('updates sortSelected when a sort option is clicked', async () => {
      const { sortSelected, user } = renderMenu({ sortSelected: 'sort-a' })
      await user.click(screen.getByRole('button', { name: 'Sort B' }))
      expect(sortSelected.value).toBe('sort-b')
    })
  })

  describe('Ownership menu', () => {
    it('is hidden when showOwnershipFilter is false', () => {
      renderMenu({ showOwnershipFilter: false })
      expect(screen.queryByLabelText('Ownership')).toBeNull()
    })

    it('is hidden when showOwnershipFilter is true but options are empty', () => {
      renderMenu({ showOwnershipFilter: true, ownershipOptions: [] })
      expect(screen.queryByLabelText('Ownership')).toBeNull()
    })

    it('is shown when showOwnershipFilter is true and options exist', () => {
      renderMenu({ showOwnershipFilter: true })
      expect(screen.getByLabelText('Ownership')).toBeInTheDocument()
    })

    it('updates ownershipSelected when an option is clicked', async () => {
      const { ownershipSelected, user } = renderMenu({
        showOwnershipFilter: true,
        ownershipSelected: 'all'
      })
      await user.click(screen.getByRole('button', { name: 'Mine' }))
      expect(ownershipSelected.value).toBe('my-models')
    })
  })

  describe('Base model menu', () => {
    it('is hidden when showBaseModelFilter is false', () => {
      renderMenu({ showBaseModelFilter: false })
      expect(screen.queryByLabelText('Base model')).toBeNull()
    })

    it('is hidden when showBaseModelFilter is true but options are empty', () => {
      renderMenu({ showBaseModelFilter: true, baseModelOptions: [] })
      expect(screen.queryByLabelText('Base model')).toBeNull()
    })

    it('is shown when showBaseModelFilter is true and options exist', () => {
      renderMenu({ showBaseModelFilter: true })
      expect(screen.getByLabelText('Base model')).toBeInTheDocument()
    })

    it('adds a value to baseModelSelected when an option is clicked', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true
      })
      await user.click(screen.getByRole('button', { name: 'Model A' }))
      expect(baseModelSelected.value).toEqual(new Set(['model-a']))
    })

    it('removes a value from baseModelSelected when clicked again', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['model-a', 'model-b'])
      })
      await user.click(screen.getByRole('button', { name: 'Model A' }))
      expect(baseModelSelected.value).toEqual(new Set(['model-b']))
    })

    it('adds additional values alongside existing selections', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['model-a'])
      })
      await user.click(screen.getByRole('button', { name: 'Model B' }))
      expect(baseModelSelected.value).toEqual(new Set(['model-a', 'model-b']))
    })

    it('clears all selections when Clear Filters is clicked', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['model-a', 'model-b'])
      })
      await user.click(screen.getByRole('button', { name: 'Clear Filters' }))
      expect(baseModelSelected.value.size).toBe(0)
    })
  })

  describe('Layout switch', () => {
    it('updates layoutMode to "list" when list view is clicked', async () => {
      const { layoutMode, user } = renderMenu({ layoutMode: 'grid' })
      await user.click(screen.getByRole('button', { name: 'List view' }))
      expect(layoutMode.value).toBe('list')
    })

    it('updates layoutMode to "grid" when grid view is clicked', async () => {
      const { layoutMode, user } = renderMenu({ layoutMode: 'list' })
      await user.click(screen.getByRole('button', { name: 'Grid view' }))
      expect(layoutMode.value).toBe('grid')
    })
  })
})
