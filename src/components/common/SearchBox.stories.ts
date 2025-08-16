import type { Meta, StoryObj } from '@storybook/vue3-vite'

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
      description: 'Current search query text (v-model)',
      defaultValue: ''
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the search input',
      defaultValue: 'Search...'
    },
    icon: {
      control: 'text',
      description: 'PrimeIcons icon class for the search icon',
      defaultValue: 'pi pi-search'
    },
    debounceTime: {
      control: { type: 'number', min: 0, max: 1000, step: 50 },
      description: 'Debounce delay in milliseconds for search events',
      defaultValue: 300
    },
    filterIcon: {
      control: 'text',
      description:
        'Optional filter button icon (button hidden if not provided)',
      defaultValue: undefined
    },
    filters: {
      control: 'object',
      description: 'Array of active filter chips to display',
      defaultValue: []
    },
    onSearch: {
      description: 'Debounced event emitted with search text and filters'
    },
    onShowFilter: {
      description: 'Event emitted when filter button is clicked'
    },
    onRemoveFilter: {
      description: 'Event emitted when a filter chip is removed'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: (args: any) => ({
    components: { SearchBox },
    setup() {
      return { args }
    },
    data() {
      return {
        searchQuery: args.modelValue || '',
        log: []
      }
    },
    methods: {
      handleUpdate(value: string) {
        console.log('Search text updated:', value)
        this.searchQuery = value
      },
      handleSearch(value: string, filters: any) {
        console.log('Debounced search:', value, 'with filters:', filters)
        this.log.unshift(
          `Search: "${value}" (${new Date().toLocaleTimeString()})`
        )
        if (this.log.length > 5) this.log.pop()
      }
    },
    template: `
      <div style="width: 400px; padding: 20px;">
        <SearchBox
          :modelValue="searchQuery"
          :placeholder="args.placeholder"
          :icon="args.icon"
          :debounceTime="args.debounceTime"
          :filterIcon="args.filterIcon"
          :filters="args.filters"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
        />
        <div v-if="log.length" style="margin-top: 16px; font-size: 12px; color: #6b7280;">
          <strong>Search Log:</strong>
          <div v-for="(entry, index) in log" :key="index" style="margin-top: 2px;">
            {{ entry }}
          </div>
        </div>
      </div>
    `
  }),
  args: {
    modelValue: '',
    placeholder: 'Search nodes...',
    icon: 'pi pi-search',
    debounceTime: 300,
    filters: []
  },
  parameters: {
    docs: {
      description: {
        story:
          'Basic search box with debounced search functionality. Type to see search events in the log.'
      }
    }
  }
}

export const WithFilters: Story = {
  render: (args: any) => ({
    components: { SearchBox },
    setup() {
      return { args }
    },
    data() {
      return {
        searchQuery: args.modelValue || '',
        activeFilters: args.filters || [
          { id: 1, text: 'Sampling', badge: '5', badgeClass: 'i-badge' },
          { id: 2, text: 'Image', badge: '3', badgeClass: 'o-badge' },
          { id: 3, text: 'Advanced', badge: '12', badgeClass: 'c-badge' }
        ]
      }
    },
    methods: {
      handleUpdate(value: string) {
        console.log('Search updated:', value)
        this.searchQuery = value
      },
      handleSearch(value: string, filters: any) {
        console.log('Search with filters:', value, filters)
      },
      removeFilter(filter: any) {
        console.log('Removing filter:', filter)
        this.activeFilters = this.activeFilters.filter(
          (f: any) => f.id !== filter.id
        )
      },
      showFilterDialog(event: Event) {
        console.log('Show filter dialog:', event)
      }
    },
    template: `
      <div style="width: 500px; padding: 20px;">
        <SearchBox
          :modelValue="searchQuery"
          :placeholder="args.placeholder"
          :icon="args.icon"
          :debounceTime="args.debounceTime"
          :filterIcon="args.filterIcon"
          :filters="activeFilters"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
          @removeFilter="removeFilter"
          @showFilter="showFilterDialog"
        />
      </div>
    `
  }),
  args: {
    modelValue: '',
    placeholder: 'Search nodes and models...',
    icon: 'pi pi-search',
    debounceTime: 300,
    filterIcon: 'pi pi-filter'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Search box with active filter chips and filter button. Remove filters by clicking the X.'
      }
    }
  }
}

export const CustomPlaceholder: Story = {
  render: (args: any) => ({
    components: { SearchBox },
    setup() {
      return { args }
    },
    data() {
      return {
        searchQuery: args.modelValue || ''
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, _filters: any) {
        console.log('Custom search:', value)
      }
    },
    template: `
      <div style="width: 400px; padding: 20px;">
        <SearchBox
          :modelValue="searchQuery"
          :placeholder="args.placeholder"
          :icon="args.icon"
          :debounceTime="args.debounceTime"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
        />
      </div>
    `
  }),
  args: {
    modelValue: '',
    placeholder: 'Find workflows, nodes, or models...',
    icon: 'pi pi-search',
    debounceTime: 300
  },
  parameters: {
    docs: {
      description: {
        story: 'Search box with custom placeholder text for specific use cases.'
      }
    }
  }
}

export const FastDebounce: Story = {
  render: (args: any) => ({
    components: { SearchBox },
    setup() {
      return { args }
    },
    data() {
      return {
        searchQuery: args.modelValue || '',
        searchCount: 0
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, _filters: any) {
        this.searchCount++
        console.log(`Fast search #${this.searchCount}:`, value)
      }
    },
    template: `
      <div style="width: 400px; padding: 20px;">
        <div style="margin-bottom: 12px; font-size: 14px; color: #6b7280;">
          Fast debounce (100ms) - Search count: {{ searchCount }}
        </div>
        <SearchBox
          :modelValue="searchQuery"
          :placeholder="args.placeholder"
          :icon="args.icon"
          :debounceTime="args.debounceTime"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
        />
      </div>
    `
  }),
  args: {
    modelValue: '',
    placeholder: 'Type quickly to test debounce...',
    icon: 'pi pi-search',
    debounceTime: 100
  },
  parameters: {
    docs: {
      description: {
        story:
          'Search box with fast debounce (100ms) for responsive searching. Counter shows search event frequency.'
      }
    }
  }
}

export const ComfyUINodeSearch: Story = {
  render: () => ({
    components: { SearchBox },
    data() {
      return {
        searchQuery: '',
        nodeFilters: [
          { id: 1, text: 'Sampling', badge: '15', badgeClass: 'i-badge' },
          { id: 2, text: 'ControlNet', badge: '8', badgeClass: 'o-badge' },
          { id: 3, text: 'SDXL', badge: '24', badgeClass: 'c-badge' }
        ],
        searchResults: []
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, filters: any) {
        console.log(
          'Node search:',
          value,
          'filters:',
          filters.map((f: any) => f.text)
        )
        // Simulate search results
        this.searchResults = [
          `Found nodes matching "${value}"`,
          `Active filters: ${filters.map((f: any) => f.text).join(', ')}`,
          `Total results: ${Math.floor(Math.random() * 50) + 1}`
        ]
      },
      removeFilter(filter: any) {
        console.log('Removing node filter:', filter.text)
        this.nodeFilters = this.nodeFilters.filter(
          (f: any) => f.id !== filter.id
        )
      },
      showFilterDialog() {
        console.log('Opening node filter dialog')
      }
    },
    template: `
      <div style="width: 600px; padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">ComfyUI Node Search</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Search for nodes and filter by category
          </p>
        </div>
        <SearchBox
          :modelValue="searchQuery"
          placeholder="Search nodes (e.g., KSampler, CLIP, VAE)..."
          icon="pi pi-sitemap"
          filterIcon="pi pi-filter"
          :filters="nodeFilters"
          :debounceTime="300"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
          @removeFilter="removeFilter"
          @showFilter="showFilterDialog"
        />
        <div v-if="searchResults.length" style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <div style="font-weight: 600; margin-bottom: 8px;">Search Results:</div>
          <div v-for="(result, index) in searchResults" :key="index" style="font-size: 14px; color: #4b5563; margin-bottom: 4px;">
            • {{ result }}
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'ComfyUI node search example with realistic filters and search behavior.'
      }
    }
  }
}

export const ModelManagerSearch: Story = {
  render: () => ({
    components: { SearchBox },
    data() {
      return {
        searchQuery: '',
        modelFilters: [
          { id: 1, text: 'Checkpoints', badge: '42', badgeClass: 'i-badge' },
          { id: 2, text: 'LoRA', badge: '28', badgeClass: 'o-badge' }
        ]
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, filters: any) {
        console.log('Model search:', value, 'filters:', filters)
      },
      removeFilter(filter: any) {
        console.log('Removing model filter:', filter.text)
        this.modelFilters = this.modelFilters.filter(
          (f: any) => f.id !== filter.id
        )
      },
      showFilterDialog() {
        console.log('Opening model filter dialog')
      }
    },
    template: `
      <div style="width: 500px; padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Model Manager Search</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Find and filter AI models
          </p>
        </div>
        <SearchBox
          :modelValue="searchQuery"
          placeholder="Search models (e.g., SDXL, Stable Diffusion)..."
          icon="pi pi-download"
          filterIcon="pi pi-sliders-h"
          :filters="modelFilters"
          :debounceTime="200"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
          @removeFilter="removeFilter"
          @showFilter="showFilterDialog"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Model Manager search example with model-specific filters and faster debounce.'
      }
    }
  }
}

export const ExtensionSearch: Story = {
  render: () => ({
    components: { SearchBox },
    data() {
      return {
        searchQuery: 'controlnet',
        extensionFilters: [
          { id: 1, text: 'Installed', badge: '23', badgeClass: 's-badge' },
          { id: 2, text: 'Updates', badge: '5', badgeClass: 'o-badge' }
        ]
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, filters: any) {
        console.log('Extension search:', value, 'filters:', filters)
      },
      removeFilter(filter: any) {
        this.extensionFilters = this.extensionFilters.filter(
          (f: any) => f.id !== filter.id
        )
      },
      showFilterDialog() {
        console.log('Opening extension filter dialog')
      }
    },
    template: `
      <div style="width: 500px; padding: 20px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Extension Manager</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Browse and manage ComfyUI extensions
          </p>
        </div>
        <SearchBox
          :modelValue="searchQuery"
          placeholder="Search extensions..."
          icon="pi pi-puzzle-piece"
          filterIcon="pi pi-cog"
          :filters="extensionFilters"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
          @removeFilter="removeFilter"
          @showFilter="showFilterDialog"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Extension Manager search example with pre-filled search and status filters.'
      }
    }
  }
}

export const ClearBehavior: Story = {
  render: () => ({
    components: { SearchBox },
    data() {
      return {
        searchQuery: 'Sample search text',
        clearCount: 0
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
        if (value === '') {
          this.clearCount++
        }
      },
      handleSearch(value: string, _filters: any) {
        console.log('Search after clear:', value)
      }
    },
    template: `
      <div style="width: 400px; padding: 20px;">
        <div style="margin-bottom: 12px; font-size: 14px; color: #6b7280;">
          Clear button demonstration - Times cleared: {{ clearCount }}
        </div>
        <SearchBox
          :modelValue="searchQuery"
          placeholder="Type something then clear it..."
          @update:modelValue="handleUpdate"
          @search="handleSearch"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates clear button behavior - button appears when text is entered and disappears when cleared.'
      }
    }
  }
}

export const NoDebounce: Story = {
  render: () => ({
    components: { SearchBox },
    data() {
      return {
        searchQuery: '',
        immediateSearchCount: 0
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, _filters: any) {
        this.immediateSearchCount++
        console.log(`Immediate search #${this.immediateSearchCount}:`, value)
      }
    },
    template: `
      <div style="width: 400px; padding: 20px;">
        <div style="margin-bottom: 12px; font-size: 14px; color: #6b7280;">
          No debounce (0ms) - Search count: {{ immediateSearchCount }}
        </div>
        <SearchBox
          :modelValue="searchQuery"
          placeholder="Instant search (no debounce)..."
          :debounceTime="0"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Search box with no debounce delay - search events fire immediately on every keystroke.'
      }
    }
  }
}

export const ManyFilters: Story = {
  render: () => ({
    components: { SearchBox },
    data() {
      return {
        searchQuery: '',
        manyFilters: [
          { id: 1, text: 'Sampling', badge: '15', badgeClass: 'i-badge' },
          {
            id: 2,
            text: 'Image Processing',
            badge: '23',
            badgeClass: 'o-badge'
          },
          { id: 3, text: 'ControlNet', badge: '12', badgeClass: 'c-badge' },
          { id: 4, text: 'Text Encoding', badge: '8', badgeClass: 's-badge' },
          { id: 5, text: 'Model Loading', badge: '6', badgeClass: 'i-badge' },
          { id: 6, text: 'Advanced', badge: '31', badgeClass: 'o-badge' }
        ]
      }
    },
    methods: {
      handleUpdate(value: string) {
        this.searchQuery = value
      },
      handleSearch(value: string, filters: any) {
        console.log(
          'Search with many filters:',
          value,
          filters.length,
          'filters'
        )
      },
      removeFilter(filter: any) {
        this.manyFilters = this.manyFilters.filter(
          (f: any) => f.id !== filter.id
        )
      },
      showFilterDialog() {
        console.log('Opening filter management dialog')
      }
    },
    template: `
      <div style="width: 600px; padding: 20px;">
        <div style="margin-bottom: 12px; font-size: 14px; color: #6b7280;">
          Many active filters demonstration:
        </div>
        <SearchBox
          :modelValue="searchQuery"
          placeholder="Search with multiple filters..."
          filterIcon="pi pi-filter-fill"
          :filters="manyFilters"
          @update:modelValue="handleUpdate"
          @search="handleSearch"
          @removeFilter="removeFilter"
          @showFilter="showFilterDialog"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Search box with many active filters showing filter chip wrapping behavior.'
      }
    }
  }
}
