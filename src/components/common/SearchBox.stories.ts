import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import SearchBox from './SearchBox.vue'

const meta: Meta = {
  title: 'Components/Common/SearchBox',
  component: SearchBox as any,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'SearchBox provides a comprehensive search interface with debounced input, active filter chips, and optional filter button. Features automatic clear functionality and sophisticated event handling for search workflows.'
      }
    }
  },
  argTypes: {
    modelValue: {
      control: 'text',
      description: 'Current search query text (v-model)'
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the search input'
    },
    icon: {
      control: 'text',
      description: 'PrimeIcons icon class for the search icon'
    },
    debounceTime: {
      control: { type: 'number', min: 0, max: 1000, step: 50 },
      description: 'Debounce delay in milliseconds for search events'
    },
    filterIcon: {
      control: 'text',
      description: 'Optional filter button icon (button hidden if not provided)'
    },
    filters: {
      control: 'object',
      description: 'Array of active filter chips to display'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj

const createSearchBoxRender =
  (initialFilters: any[] = []) =>
  (args: any) => ({
    components: { SearchBox },
    setup() {
      const searchQuery = ref(args.modelValue || '')
      const filters = ref(args.filters || initialFilters)
      const actions = ref<string[]>([])

      const logAction = (action: string, data?: any) => {
        const timestamp = new Date().toLocaleTimeString()
        const message = data
          ? `${action}: "${data}" (${timestamp})`
          : `${action} (${timestamp})`
        actions.value.unshift(message)
        if (actions.value.length > 5) actions.value.pop()
        console.log(action, data)
      }

      const handleUpdate = (value: string) => {
        searchQuery.value = value
        logAction('Search text updated', value)
      }

      const handleSearch = (value: string, searchFilters: any[]) => {
        logAction(
          'Debounced search',
          `"${value}" with ${searchFilters.length} filters`
        )
      }

      const handleShowFilter = () => {
        logAction('Filter button clicked')
      }

      const handleRemoveFilter = (filter: any) => {
        const index = filters.value.findIndex((f: any) => f === filter)
        if (index > -1) {
          filters.value.splice(index, 1)
          logAction('Filter removed', filter.label || filter)
        }
      }

      return {
        args,
        searchQuery,
        filters,
        actions,
        handleUpdate,
        handleSearch,
        handleShowFilter,
        handleRemoveFilter
      }
    },
    template: `
    <div style="width: 400px; padding: 20px;">
      <SearchBox
        :modelValue="searchQuery"
        v-bind="args"
        :filters="filters"
        @update:modelValue="handleUpdate"
        @search="handleSearch"
        @showFilter="handleShowFilter"
        @removeFilter="handleRemoveFilter"
      />
      <div v-if="actions.length > 0" style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px;">Actions Log:</div>
        <div v-for="action in actions" :key="action" style="margin: 2px 0;">{{ action }}</div>
      </div>
    </div>
  `
  })

export const Default: Story = {
  render: createSearchBoxRender(),
  args: {
    modelValue: '',
    placeholder: 'Search nodes...',
    icon: 'pi pi-search',
    debounceTime: 300,
    filters: []
  }
}

export const WithFilters: Story = {
  render: createSearchBoxRender([
    { label: 'Image', type: 'category' },
    { label: 'Sampling', type: 'category' },
    { label: 'Recent', type: 'sort' }
  ]),
  args: {
    modelValue: 'stable diffusion',
    placeholder: 'Search models...',
    icon: 'pi pi-search',
    debounceTime: 300,
    filterIcon: 'pi pi-filter'
  }
}

export const WithFilterButton: Story = {
  render: createSearchBoxRender(),
  args: {
    modelValue: '',
    placeholder: 'Search workflows...',
    icon: 'pi pi-search',
    debounceTime: 300,
    filterIcon: 'pi pi-filter',
    filters: []
  }
}

export const FastDebounce: Story = {
  render: createSearchBoxRender(),
  args: {
    modelValue: '',
    placeholder: 'Fast search (50ms debounce)...',
    icon: 'pi pi-search',
    debounceTime: 50,
    filters: []
  }
}

export const SlowDebounce: Story = {
  render: createSearchBoxRender(),
  args: {
    modelValue: '',
    placeholder: 'Slow search (1000ms debounce)...',
    icon: 'pi pi-search',
    debounceTime: 1000,
    filters: []
  }
}

// ComfyUI examples
export const NodeSearch: Story = {
  render: () => ({
    components: { SearchBox },
    setup() {
      const searchQuery = ref('')
      const nodeFilters = ref([
        { label: 'Sampling', type: 'category' },
        { label: 'Popular', type: 'sort' }
      ])

      const handleSearch = (value: string, filters: any[]) => {
        console.log('Searching nodes:', { value, filters })
      }

      const handleRemoveFilter = (filter: any) => {
        const index = nodeFilters.value.findIndex((f) => f === filter)
        if (index > -1) {
          nodeFilters.value.splice(index, 1)
        }
      }

      return {
        searchQuery,
        nodeFilters,
        handleSearch,
        handleRemoveFilter
      }
    },
    template: `
      <div style="width: 300px;">
        <div style="margin-bottom: 8px; font-weight: 600;">Node Library</div>
        <SearchBox
          v-model="searchQuery"
          placeholder="Search nodes..."
          icon="pi pi-box"
          :debounceTime="300"
          filterIcon="pi pi-filter"
          :filters="nodeFilters"
          @search="handleSearch"
          @removeFilter="handleRemoveFilter"
        />
      </div>
    `
  })
}

export const ModelSearch: Story = {
  render: () => ({
    components: { SearchBox },
    setup() {
      const searchQuery = ref('stable-diffusion')
      const modelFilters = ref([
        { label: 'SDXL', type: 'version' },
        { label: 'Checkpoints', type: 'type' }
      ])

      const handleSearch = (value: string, filters: any[]) => {
        console.log('Searching models:', { value, filters })
      }

      return {
        searchQuery,
        modelFilters,
        handleSearch
      }
    },
    template: `
      <div style="width: 350px;">
        <div style="margin-bottom: 8px; font-weight: 600;">Model Manager</div>
        <SearchBox
          v-model="searchQuery"
          placeholder="Search models..."
          icon="pi pi-database"
          :debounceTime="400"
          filterIcon="pi pi-sliders-h"
          :filters="modelFilters"
          @search="handleSearch"
        />
      </div>
    `
  })
}
