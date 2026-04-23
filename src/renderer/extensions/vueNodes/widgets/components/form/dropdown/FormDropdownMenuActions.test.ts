/* eslint-disable vue/one-component-per-file */
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import type { LayoutMode, SortOption } from './types'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const popoverHide = vi.fn()

const ButtonStub = defineComponent({
  inheritAttrs: false,
  template: '<button v-bind="$attrs" type="button"><slot /></button>'
})

const PopoverStub = defineComponent({
  inheritAttrs: false,
  data() {
    return { open: false }
  },
  methods: {
    toggle() {
      this.open = !this.open
    },
    hide() {
      popoverHide()
      this.open = false
    }
  },
  template: '<div data-testid="popover-body" v-if="open"><slot /></div>'
})

// Synthetic fixtures: the component is prop-driven, so we deliberately
// avoid mirroring production data (which can silently drift).
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
      showBaseModelFilter: props.showBaseModelFilter ?? false
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
      />
    `
  })

  const user = userEvent.setup()
  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: { Button: ButtonStub, Popover: PopoverStub }
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

type TestUser = ReturnType<typeof userEvent.setup>

async function openPopover(user: TestUser, triggerName: string) {
  await user.click(screen.getByRole('button', { name: triggerName }))
  return screen.getByTestId('popover-body')
}

describe('FormDropdownMenuActions', () => {
  beforeEach(() => {
    popoverHide.mockClear()
  })

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
  })

  describe('Sort popover', () => {
    it('is closed by default', () => {
      renderMenu()
      expect(screen.queryByTestId('popover-body')).toBeNull()
    })

    it('opens the options list after the sort trigger is clicked', async () => {
      const { user } = renderMenu()
      const body = await openPopover(user, 'Sort by')
      expect(
        within(body).getByRole('button', { name: 'Sort A' })
      ).toBeInTheDocument()
      expect(
        within(body).getByRole('button', { name: 'Sort B' })
      ).toBeInTheDocument()
    })

    it('updates sortSelected when a sort option is clicked', async () => {
      const { sortSelected, user } = renderMenu({ sortSelected: 'sort-a' })
      const body = await openPopover(user, 'Sort by')
      await user.click(within(body).getByRole('button', { name: 'Sort B' }))
      expect(sortSelected.value).toBe('sort-b')
    })

    it('calls popover hide() after a sort option is selected', async () => {
      const { user } = renderMenu({ sortSelected: 'sort-a' })
      const body = await openPopover(user, 'Sort by')
      await user.click(within(body).getByRole('button', { name: 'Sort B' }))
      expect(popoverHide).toHaveBeenCalled()
    })
  })

  describe('Ownership popover', () => {
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
      const body = await openPopover(user, 'Ownership')
      await user.click(within(body).getByRole('button', { name: 'Mine' }))
      expect(ownershipSelected.value).toBe('my-models')
    })

    it('calls popover hide() after an ownership option is selected', async () => {
      const { user } = renderMenu({
        showOwnershipFilter: true,
        ownershipSelected: 'all'
      })
      const body = await openPopover(user, 'Ownership')
      await user.click(within(body).getByRole('button', { name: 'Mine' }))
      expect(popoverHide).toHaveBeenCalled()
    })
  })

  describe('Base model popover', () => {
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
      const body = await openPopover(user, 'Base model')
      await user.click(within(body).getByRole('button', { name: 'Model A' }))
      expect(baseModelSelected.value).toEqual(new Set(['model-a']))
    })

    it('removes a value from baseModelSelected when clicked again', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['model-a', 'model-b'])
      })
      const body = await openPopover(user, 'Base model')
      await user.click(within(body).getByRole('button', { name: 'Model A' }))
      expect(baseModelSelected.value).toEqual(new Set(['model-b']))
    })

    it('adds additional values alongside existing selections', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['model-a'])
      })
      const body = await openPopover(user, 'Base model')
      await user.click(within(body).getByRole('button', { name: 'Model B' }))
      expect(baseModelSelected.value).toEqual(new Set(['model-a', 'model-b']))
    })

    it('clears all selections when Clear Filters is clicked', async () => {
      const { baseModelSelected, user } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['model-a', 'model-b'])
      })
      const body = await openPopover(user, 'Base model')
      await user.click(
        within(body).getByRole('button', { name: 'Clear Filters' })
      )
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
