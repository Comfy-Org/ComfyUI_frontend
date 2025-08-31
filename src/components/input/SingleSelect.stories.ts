import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ArrowUpDown } from 'lucide-vue-next'
import { ref } from 'vue'

import SingleSelect from './SingleSelect.vue'

// SingleSelect already includes options prop, so no need to extend
const meta: Meta<typeof SingleSelect> = {
  title: 'Components/Input/SingleSelect',
  component: SingleSelect,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    options: { control: 'object' }
  },
  args: {
    label: 'Sorting Type',
    options: [
      { name: 'Popular', value: 'popular' },
      { name: 'Newest', value: 'newest' },
      { name: 'Oldest', value: 'oldest' },
      { name: 'A → Z', value: 'az' },
      { name: 'Z → A', value: 'za' }
    ]
  }
}

export default meta
export type Story = StoryObj<typeof meta>

const sampleOptions = [
  { name: 'Popular', value: 'popular' },
  { name: 'Newest', value: 'newest' },
  { name: 'Oldest', value: 'oldest' },
  { name: 'A → Z', value: 'az' },
  { name: 'Z → A', value: 'za' }
]

export const Default: Story = {
  render: (args) => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>(null)
      const options = args.options || sampleOptions
      return { selected, options, args }
    },
    template: `
      <div>
        <SingleSelect v-model="selected" :options="options" :label="args.label" />
        <div class="mt-4 p-3 bg-gray-50 dark-theme:bg-zinc-800 rounded">
          <p class="text-sm">Selected: {{ selected ?? 'None' }}</p>
        </div>
      </div>
    `
  })
}

export const WithIcon: Story = {
  render: () => ({
    components: { SingleSelect, ArrowUpDown },
    setup() {
      const selected = ref<string | null>('popular')
      const options = sampleOptions
      return { selected, options }
    },
    template: `
      <div>
        <SingleSelect v-model="selected" :options="options" label="Sorting Type">
          <template #icon>
            <ArrowUpDown :size="14" />
          </template>
        </SingleSelect>
        <div class="mt-4 p-3 bg-gray-50 dark-theme:bg-zinc-800 rounded">
          <p class="text-sm">Selected: {{ selected }}</p>
        </div>
      </div>
    `
  })
}

export const Preselected: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>('newest')
      const options = sampleOptions
      return { selected, options }
    },
    template: `
      <SingleSelect v-model="selected" :options="options" label="Sorting Type" />
    `
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { SingleSelect, ArrowUpDown },
    setup() {
      const options = sampleOptions
      const a = ref<string | null>(null)
      const b = ref<string | null>('popular')
      const c = ref<string | null>('az')
      return { options, a, b, c }
    },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <SingleSelect v-model="a" :options="options" label="No Icon" />
        </div>
        <div class="flex items-center gap-3">
          <SingleSelect v-model="b" :options="options" label="With Icon">
            <template #icon>
              <ArrowUpDown :size="14" />
            </template>
          </SingleSelect>
        </div>
        <div class="flex items-center gap-3">
          <SingleSelect v-model="c" :options="options" label="Preselected (A→Z)" />
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true },
    actions: { disable: true }
  }
}
