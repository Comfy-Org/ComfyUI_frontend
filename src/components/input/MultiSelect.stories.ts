import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { MultiSelectProps } from 'primevue/multiselect'
import { ref } from 'vue'

import MultiSelect from './MultiSelect.vue'

// Combine our component props with PrimeVue MultiSelect props
// Since we use v-bind="$attrs", all PrimeVue props are available
interface ExtendedProps extends Partial<MultiSelectProps> {
  // Our custom props
  label?: string
  showSearchBox?: boolean
  showSelectedCount?: boolean
  showClearButton?: boolean
  searchPlaceholder?: string
  // Override modelValue type to match our Option type
  modelValue?: Array<{ name: string; value: string }>
}

const meta: Meta<ExtendedProps> = {
  title: 'Components/Input/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text'
    },
    options: {
      control: 'object'
    },
    showSearchBox: {
      control: 'boolean',
      description: 'Toggle searchBar visibility'
    },
    showSelectedCount: {
      control: 'boolean',
      description: 'Toggle selected count visibility'
    },
    showClearButton: {
      control: 'boolean',
      description: 'Toggle clear button visibility'
    },
    searchPlaceholder: {
      control: 'text'
    }
  },
  args: {
    label: 'Select',
    options: [
      { name: 'Vue', value: 'vue' },
      { name: 'React', value: 'react' },
      { name: 'Angular', value: 'angular' },
      { name: 'Svelte', value: 'svelte' }
    ],
    showSearchBox: false,
    showSelectedCount: false,
    showClearButton: false,
    searchPlaceholder: 'Search...'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref([])
      const options = args.options || [
        { name: 'Vue', value: 'vue' },
        { name: 'React', value: 'react' },
        { name: 'Angular', value: 'angular' },
        { name: 'Svelte', value: 'svelte' }
      ]
      return { selected, options, args }
    },
    template: `
      <div>
        <MultiSelect 
          v-model="selected" 
          :options="options"
          :label="args.label"
          :showSearchBox="args.showSearchBox"
          :showSelectedCount="args.showSelectedCount"
          :showClearButton="args.showClearButton"
          :searchPlaceholder="args.searchPlaceholder"
        />
        <div class="mt-4 p-3 bg-gray-50 dark-theme:bg-zinc-800 rounded">
          <p class="text-sm">Selected: {{ selected.length > 0 ? selected.map(s => s.name).join(', ') : 'None' }}</p>
        </div>
      </div>
    `
  })
}

export const WithPreselectedValues: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const options = args.options || [
        { name: 'JavaScript', value: 'js' },
        { name: 'TypeScript', value: 'ts' },
        { name: 'Python', value: 'python' },
        { name: 'Go', value: 'go' },
        { name: 'Rust', value: 'rust' }
      ]
      const selected = ref([options[0], options[1]])
      return { selected, options, args }
    },
    template: `
      <div>
        <MultiSelect 
          v-model="selected" 
          :options="options"
          :label="args.label"
          :showSearchBox="args.showSearchBox"
          :showSelectedCount="args.showSelectedCount"
          :showClearButton="args.showClearButton"
          :searchPlaceholder="args.searchPlaceholder"
        />
        <div class="mt-4 p-3 bg-gray-50 dark-theme:bg-zinc-800 rounded">
          <p class="text-sm">Selected: {{ selected.map(s => s.name).join(', ') }}</p>
        </div>
      </div>
    `
  }),
  args: {
    label: 'Select Languages',
    options: [
      { name: 'JavaScript', value: 'js' },
      { name: 'TypeScript', value: 'ts' },
      { name: 'Python', value: 'python' },
      { name: 'Go', value: 'go' },
      { name: 'Rust', value: 'rust' }
    ],
    showSearchBox: false,
    showSelectedCount: false,
    showClearButton: false,
    searchPlaceholder: 'Search...'
  }
}

export const MultipleSelectors: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const frameworkOptions = ref([
        { name: 'Vue', value: 'vue' },
        { name: 'React', value: 'react' },
        { name: 'Angular', value: 'angular' },
        { name: 'Svelte', value: 'svelte' }
      ])

      const projectOptions = ref([
        { name: 'Project A', value: 'proj-a' },
        { name: 'Project B', value: 'proj-b' },
        { name: 'Project C', value: 'proj-c' },
        { name: 'Project D', value: 'proj-d' }
      ])

      const tagOptions = ref([
        { name: 'Frontend', value: 'frontend' },
        { name: 'Backend', value: 'backend' },
        { name: 'Database', value: 'database' },
        { name: 'DevOps', value: 'devops' },
        { name: 'Testing', value: 'testing' }
      ])

      const selectedFrameworks = ref([])
      const selectedProjects = ref([])
      const selectedTags = ref([])

      return {
        frameworkOptions,
        projectOptions,
        tagOptions,
        selectedFrameworks,
        selectedProjects,
        selectedTags,
        args
      }
    },
    template: `
      <div class="space-y-4">
        <div class="flex gap-2">
          <MultiSelect 
            v-model="selectedFrameworks" 
            :options="frameworkOptions"
            label="Select Frameworks"
            :showSearchBox="args.showSearchBox"
            :showSelectedCount="args.showSelectedCount"
            :showClearButton="args.showClearButton"
            :searchPlaceholder="args.searchPlaceholder"
          />
          <MultiSelect 
            v-model="selectedProjects" 
            :options="projectOptions"
            label="Select Projects"
            :showSearchBox="args.showSearchBox"
            :showSelectedCount="args.showSelectedCount"
            :showClearButton="args.showClearButton"
            :searchPlaceholder="args.searchPlaceholder"
          />
          <MultiSelect 
            v-model="selectedTags" 
            :options="tagOptions"
            label="Select Tags"
            :showSearchBox="args.showSearchBox"
            :showSelectedCount="args.showSelectedCount"
            :showClearButton="args.showClearButton"
            :searchPlaceholder="args.searchPlaceholder"
          />
        </div>
        
        <div class="p-4 bg-gray-50 dark-theme:bg-zinc-800 rounded">
          <h4 class="font-medium mt-0">Current Selection:</h4>
          <div class="flex flex-col text-sm">
            <p>Frameworks: {{ selectedFrameworks.length > 0 ? selectedFrameworks.map(s => s.name).join(', ') : 'None' }}</p>
            <p>Projects: {{ selectedProjects.length > 0 ? selectedProjects.map(s => s.name).join(', ') : 'None' }}</p>
            <p>Tags: {{ selectedTags.length > 0 ? selectedTags.map(s => s.name).join(', ') : 'None' }}</p>
          </div>
        </div>
      </div>
    `
  }),
  args: {
    showSearchBox: false,
    showSelectedCount: false,
    showClearButton: false,
    searchPlaceholder: 'Search...'
  }
}

export const WithSearchBox: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSearchBox: true
  }
}

export const WithSelectedCount: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSelectedCount: true
  }
}

export const WithClearButton: Story = {
  ...Default,
  args: {
    ...Default.args,
    showClearButton: true
  }
}

export const AllHeaderFeatures: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSearchBox: true,
    showSelectedCount: true,
    showClearButton: true
  }
}

export const CustomSearchPlaceholder: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSearchBox: true,
    searchPlaceholder: 'Filter packages...'
  }
}
