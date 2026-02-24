import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'

import { ref } from 'vue'

import SearchInput from './SearchInput.vue'
import { FOR_STORIES } from './searchInput.variants'

const { sizes } = FOR_STORIES

const meta: Meta<ComponentPropsAndSlots<typeof SearchInput>> = {
  title: 'Components/Input/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'text' },
    placeholder: { control: 'text' },
    icon: { control: 'text' },
    debounceTime: { control: 'number' },
    autofocus: { control: 'boolean' },
    loading: { control: 'boolean' },
    size: {
      control: { type: 'select' },
      options: sizes
    },
    'onUpdate:modelValue': { action: 'update:modelValue' },
    onSearch: { action: 'search' }
  },
  args: {
    modelValue: '',
    size: 'md',
    loading: false,
    autofocus: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { SearchInput },
    setup() {
      const searchText = ref('')
      return { searchText, args }
    },
    template: `
      <div style="max-width: 320px;">
        <SearchInput v-bind="args" v-model="searchText" />
      </div>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: { SearchInput },
    setup() {
      const sm = ref('')
      const md = ref('')
      const lg = ref('')
      return { sm, md, lg }
    },
    template: `
      <div class="flex flex-col gap-4" style="max-width: 320px;">
        <div class="text-xs text-muted-foreground">sm</div>
        <SearchInput v-model="sm" size="sm" />
        <div class="text-xs text-muted-foreground">md</div>
        <SearchInput v-model="md" size="md" />
        <div class="text-xs text-muted-foreground">lg</div>
        <SearchInput v-model="lg" size="lg" />
      </div>
    `
  })
}

export const WithValue: Story = {
  render: (args) => ({
    components: { SearchInput },
    setup() {
      const searchText = ref('neural network')
      return { searchText, args }
    },
    template: `
      <div style="max-width: 320px;">
        <SearchInput v-bind="args" v-model="searchText" />
      </div>
    `
  })
}

export const Loading: Story = {
  render: (args) => ({
    components: { SearchInput },
    setup() {
      const searchText = ref('')
      return { searchText, args }
    },
    template: `
      <div style="max-width: 320px;">
        <SearchInput v-bind="args" v-model="searchText" :loading="true" />
      </div>
    `
  })
}

export const CustomPlaceholder: Story = {
  ...Default,
  args: {
    placeholder: 'Find a workflow...'
  }
}

export const CustomIcon: Story = {
  ...Default,
  args: {
    icon: 'icon-[lucide--filter]'
  }
}

export const CustomBackground: Story = {
  render: (args) => ({
    components: { SearchInput },
    setup() {
      const searchText = ref('')
      return { searchText, args }
    },
    template: `
      <div style="max-width: 320px;">
        <SearchInput
          v-bind="args"
          v-model="searchText"
          class="bg-component-node-widget-background"
        />
      </div>
    `
  })
}
