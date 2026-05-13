import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'

import MultiSelect from './MultiSelect.vue'

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
    label: 'Category',
    size: 'lg',
    showSearchBox: false,
    showSelectedCount: false,
    showClearButton: false,
    searchPlaceholder: 'Search...'
  }
}

export default meta
type Story = StoryObj<typeof meta>

const sampleOptions: SelectOption[] = [
  { name: 'Vue', value: 'vue' },
  { name: 'React', value: 'react' },
  { name: 'Angular', value: 'angular' },
  { name: 'Svelte', value: 'svelte' }
]

export const Default: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, sampleOptions, args }
    },
    template:
      '<MultiSelect v-model="selected" :options="sampleOptions" :label="args.label" :size="args.size" :show-search-box="args.showSearchBox" :show-selected-count="args.showSelectedCount" :show-clear-button="args.showClearButton" />'
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
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" size="md" />'
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
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" />'
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
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" disabled />'
  }),
  parameters: { controls: { disable: true } }
}

export const WithSearchBox: Story = {
  args: { showSearchBox: true },
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, sampleOptions, args }
    },
    template:
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" :show-search-box="args.showSearchBox" />'
  })
}

export const AllHeaderFeatures: Story = {
  args: {
    showSearchBox: true,
    showSelectedCount: true,
    showClearButton: true
  },
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, sampleOptions, args }
    },
    template:
      '<MultiSelect v-model="selected" :options="sampleOptions" label="Category" :show-search-box="args.showSearchBox" :show-selected-count="args.showSelectedCount" :show-clear-button="args.showClearButton" />'
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
            <MultiSelect v-model="a" :options="sampleOptions" label="Default" />
            <MultiSelect v-model="b" :options="sampleOptions" label="With Selection" />
            <MultiSelect v-model="c" :options="sampleOptions" label="Disabled" disabled />
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Medium (Node)</p>
          <div class="flex flex-col gap-3">
            <MultiSelect v-model="a" :options="sampleOptions" label="Default" size="md" />
            <MultiSelect v-model="b" :options="sampleOptions" label="With Selection" size="md" />
            <MultiSelect v-model="c" :options="sampleOptions" label="Disabled" size="md" disabled />
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true }
  }
}
