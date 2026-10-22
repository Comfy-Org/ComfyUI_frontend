import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'

import MultiSelect from './MultiSelect.vue'
import type { MultiSelectProps } from './types'

const meta: Meta<typeof MultiSelect> = {
  title: 'Components/Select/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template: '<div class="pt-4"><story /></div>'
    })
  ],
  argTypes: {
    label: { control: 'text' },
    size: {
      control: { type: 'select' },
      options: ['lg', 'md']
    },
    showSearchBox: { control: 'boolean' },
    showSelectedCount: { control: 'boolean' },
    showClearButton: { control: 'boolean' },
    searchPlaceholder: { control: 'text' }
  },
  args: {
    accessibleLabel: 'Category',
    searchLabel: 'Search categories',
    emptyText: 'No results found',
    clearAllLabel: 'Clear all',
    formatSelectedCount: (count: number) => `${count} selected`,
    label: 'Category',
    size: 'lg',
    showSearchBox: false,
    showSelectedCount: false,
    showClearButton: false,
    searchPlaceholder: 'Search...'
  }
}

export default meta
type Story = StoryObj<MultiSelectProps>

const sampleOptions: SelectOption[] = [
  { name: 'Vue', value: 'vue' },
  { name: 'React', value: 'react' },
  { name: 'Angular', value: 'angular' },
  { name: 'Svelte', value: 'svelte' }
]

export const Default: Story = {
  render: (args: MultiSelectProps) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, sampleOptions, args }
    },
    template:
      '<MultiSelect v-bind="args" v-model="selected" :options="sampleOptions" />'
  })
}

export const MediumSize: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([sampleOptions[0]])
      return { selected, sampleOptions }
    },
    template:
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" size="md" accessible-label="Category" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => `${count} selected`" />'
  }),
  parameters: { controls: { disable: true } }
}

export const WithPreselectedValues: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([sampleOptions[0], sampleOptions[1]])
      return { selected, sampleOptions }
    },
    template:
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" accessible-label="Category" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => `${count} selected`" />'
  }),
  parameters: { controls: { disable: true } }
}

export const Disabled: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([sampleOptions[0]])
      return { selected, sampleOptions }
    },
    template:
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" disabled accessible-label="Category" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => `${count} selected`" />'
  }),
  parameters: { controls: { disable: true } }
}

export const ChipsViaValueSlot: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([sampleOptions[0], sampleOptions[3]])
      return { selected, sampleOptions }
    },
    template: `
      <MultiSelect v-model="selected" :options="sampleOptions" label="Category" accessible-label="Category" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)">
        <template #value="{ selected }">
          <div class="flex min-w-0 gap-1 overflow-hidden">
            <span
              v-for="item in selected"
              :key="item.value"
              class="truncate rounded-sm bg-secondary px-1.5 py-0.5 text-xs"
            >
              {{ item.name }}
            </span>
          </div>
        </template>
      </MultiSelect>`
  }),
  parameters: { controls: { disable: true } }
}

export const WithSearchBox: Story = {
  args: { showSearchBox: true, searchLabel: 'Search categories' },
  render: (args: MultiSelectProps) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, sampleOptions, args }
    },
    template:
      '<MultiSelect v-bind="args" v-model="selected" :options="sampleOptions" />'
  })
}

export const AllHeaderFeatures: Story = {
  args: {
    showSearchBox: true,
    searchLabel: 'Search categories',
    showSelectedCount: true,
    formatSelectedCount: (count: number) => `${count} selected`,
    showClearButton: true,
    clearAllLabel: 'Clear all'
  },
  render: (args: MultiSelectProps) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, sampleOptions, args }
    },
    template:
      '<MultiSelect v-bind="args" v-model="selected" :options="sampleOptions" />'
  })
}

export const AllStates: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const a = ref<SelectOption[]>([])
      const b = ref<SelectOption[]>([sampleOptions[0]])
      const c = ref<SelectOption[]>([sampleOptions[0]])
      return { sampleOptions, a, b, c }
    },
    template: `
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Large (Interface)</p>
          <div class="flex flex-col gap-3">
            <MultiSelect v-model="a" :options="sampleOptions" label="Default" accessible-label="Default" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
            <MultiSelect v-model="b" :options="sampleOptions" label="With Selection" accessible-label="With Selection" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
            <MultiSelect v-model="c" :options="sampleOptions" label="Disabled" disabled accessible-label="Disabled" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Medium (Node)</p>
          <div class="flex flex-col gap-3">
            <MultiSelect v-model="a" :options="sampleOptions" label="Default" size="md" accessible-label="Default" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
            <MultiSelect v-model="b" :options="sampleOptions" label="With Selection" size="md" accessible-label="With Selection" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
            <MultiSelect v-model="c" :options="sampleOptions" label="Disabled" size="md" disabled accessible-label="Disabled" search-label="Search" empty-text="No results found" clear-all-label="Clear all" :format-selected-count="count => String(count)" />
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true }
  }
}
