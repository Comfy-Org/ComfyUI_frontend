/* eslint-disable vue/one-component-per-file */
/* eslint-disable vue/no-reserved-component-names */
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

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
  messages: {
    en: {
      g: {
        clearFilters: 'Clear Filters',
        clear: 'Clear',
        searchPlaceholder: 'Search {subject}'
      },
      assetBrowser: {
        ownership: 'Ownership',
        baseModel: 'Base model'
      }
    }
  }
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  template: '<button v-bind="$attrs" type="button"><slot /></button>'
})

const PopoverStub = defineComponent({
  name: 'Popover',
  methods: {
    toggle() {},
    hide() {}
  },
  template: '<div data-testid="popover-body"><slot /></div>'
})

const sortOptions: SortOption[] = [
  {
    id: 'default',
    name: 'Default',
    sorter: ({ items }) => [...items]
  },
  {
    id: 'name-asc',
    name: 'Name A-Z',
    sorter: ({ items }) => [...items]
  },
  {
    id: 'recent',
    name: 'Most Recent',
    sorter: ({ items }) => [...items]
  }
]

const ownershipOptions: OwnershipFilterOption[] = [
  { name: 'All', value: 'all' },
  { name: 'Mine', value: 'my-models' },
  { name: 'Public', value: 'public-models' }
]

const baseModelOptions: FilterOption[] = [
  { name: 'SDXL', value: 'sdxl' },
  { name: 'SD 1.5', value: 'sd-1.5' },
  { name: 'Flux', value: 'flux' }
]

type MenuProps = {
  showOwnershipFilter?: boolean
  showBaseModelFilter?: boolean
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

  const Harness = defineComponent({
    components: { FormDropdownMenuActions },
    setup: () => ({
      layoutMode,
      searchQuery,
      sortSelected,
      ownershipSelected,
      baseModelSelected,
      sortOptions,
      ownershipOptions,
      baseModelOptions,
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
        :sort-options="sortOptions"
        :show-ownership-filter="showOwnershipFilter"
        :ownership-options="ownershipOptions"
        :show-base-model-filter="showBaseModelFilter"
        :base-model-options="baseModelOptions"
      />
    `
  })

  const utils = render(Harness, {
    global: {
      plugins: [i18n],
      stubs: { Button: ButtonStub, Popover: PopoverStub }
    }
  })
  return {
    ...utils,
    layoutMode,
    searchQuery,
    sortSelected,
    ownershipSelected,
    baseModelSelected
  }
}

const getPopoverBy = (optionName: string) =>
  screen
    .getAllByTestId('popover-body')
    .find((body) =>
      within(body).queryByRole('button', { name: optionName })
    ) as HTMLElement

describe('FormDropdownMenuActions', () => {
  describe('Search', () => {
    it('binds search input to v-model', () => {
      renderMenu({ searchQuery: 'seed' })
      expect(screen.getByRole('textbox')).toHaveValue('seed')
    })
  })

  describe('Sort popover', () => {
    it('renders all sort options', () => {
      renderMenu()
      const body = getPopoverBy('Name A-Z')
      expect(within(body).getByText('Default')).toBeInTheDocument()
      expect(within(body).getByText('Name A-Z')).toBeInTheDocument()
      expect(within(body).getByText('Most Recent')).toBeInTheDocument()
    })

    it('updates sortSelected when a sort option is clicked', async () => {
      const { sortSelected } = renderMenu({ sortSelected: 'default' })
      const user = userEvent.setup()
      const body = getPopoverBy('Name A-Z')
      await user.click(within(body).getByRole('button', { name: 'Name A-Z' }))
      expect(sortSelected.value).toBe('name-asc')
    })
  })

  describe('Ownership popover', () => {
    it('is hidden when showOwnershipFilter is false', () => {
      renderMenu({ showOwnershipFilter: false })
      expect(screen.queryByLabelText('Ownership')).toBeNull()
    })

    it('is shown when showOwnershipFilter is true and options exist', () => {
      renderMenu({ showOwnershipFilter: true })
      expect(screen.getByLabelText('Ownership')).toBeInTheDocument()
    })

    it('updates ownershipSelected when an option is clicked', async () => {
      const { ownershipSelected } = renderMenu({
        showOwnershipFilter: true,
        ownershipSelected: 'all'
      })
      const user = userEvent.setup()
      const body = getPopoverBy('Mine')
      await user.click(within(body).getByRole('button', { name: 'Mine' }))
      expect(ownershipSelected.value).toBe('my-models')
    })
  })

  describe('Base model popover', () => {
    it('is hidden when showBaseModelFilter is false', () => {
      renderMenu({ showBaseModelFilter: false })
      expect(screen.queryByLabelText('Base model')).toBeNull()
    })

    it('is shown when showBaseModelFilter is true and options exist', () => {
      renderMenu({ showBaseModelFilter: true })
      expect(screen.getByLabelText('Base model')).toBeInTheDocument()
    })

    it('adds a value to baseModelSelected when an option is clicked', async () => {
      const { baseModelSelected } = renderMenu({ showBaseModelFilter: true })
      const user = userEvent.setup()
      const body = getPopoverBy('SDXL')
      await user.click(within(body).getByRole('button', { name: 'SDXL' }))
      expect(baseModelSelected.value.has('sdxl')).toBe(true)
      expect(baseModelSelected.value.size).toBe(1)
    })

    it('removes a value from baseModelSelected when clicked again', async () => {
      const { baseModelSelected } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['sdxl', 'flux'])
      })
      const user = userEvent.setup()
      const body = getPopoverBy('SDXL')
      await user.click(within(body).getByRole('button', { name: 'SDXL' }))
      expect(baseModelSelected.value.has('sdxl')).toBe(false)
      expect(baseModelSelected.value.has('flux')).toBe(true)
    })

    it('supports multiple selections', async () => {
      const { baseModelSelected } = renderMenu({ showBaseModelFilter: true })
      const user = userEvent.setup()
      const body = getPopoverBy('SDXL')
      await user.click(within(body).getByRole('button', { name: 'SDXL' }))
      await user.click(within(body).getByRole('button', { name: 'Flux' }))
      expect(baseModelSelected.value.size).toBe(2)
      expect(baseModelSelected.value.has('sdxl')).toBe(true)
      expect(baseModelSelected.value.has('flux')).toBe(true)
    })

    it('clears all selections when Clear Filters is clicked', async () => {
      const { baseModelSelected } = renderMenu({
        showBaseModelFilter: true,
        baseModelSelected: new Set(['sdxl', 'flux'])
      })
      const user = userEvent.setup()
      const body = getPopoverBy('Clear Filters')
      await user.click(
        within(body).getByRole('button', { name: 'Clear Filters' })
      )
      expect(baseModelSelected.value.size).toBe(0)
    })
  })

  describe('Layout switch', () => {
    it('updates layoutMode to "list" when list button is clicked', async () => {
      const { layoutMode } = renderMenu({ layoutMode: 'grid' })
      const user = userEvent.setup()
      const buttons = screen.getAllByRole('button')
      const listBtn = buttons.find(
        // eslint-disable-next-line testing-library/no-node-access
        (b) => b.querySelector('.icon-\\[lucide--list\\]')
      )
      expect(listBtn).toBeDefined()
      await user.click(listBtn!)
      expect(layoutMode.value).toBe('list')
    })

    it('updates layoutMode to "grid" when grid button is clicked', async () => {
      const { layoutMode } = renderMenu({ layoutMode: 'list' })
      const user = userEvent.setup()
      const buttons = screen.getAllByRole('button')
      const gridBtn = buttons.find(
        // eslint-disable-next-line testing-library/no-node-access
        (b) => b.querySelector('.icon-\\[lucide--layout-grid\\]')
      )
      expect(gridBtn).toBeDefined()
      await user.click(gridBtn!)
      expect(layoutMode.value).toBe('grid')
    })
  })
})
