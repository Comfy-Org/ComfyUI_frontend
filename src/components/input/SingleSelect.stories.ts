import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import SingleSelect from './SingleSelect.vue'

const meta: Meta<typeof SingleSelect> = {
  title: 'Components/Select/SingleSelect',
  component: SingleSelect,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template: '<div class="pt-4"><story /></div>'
    })
  ],
  argTypes: {
    label: { control: 'text' },
    options: { control: 'object' },
    size: {
      control: { type: 'select' },
      options: ['lg', 'md']
    },
    invalid: { control: 'boolean' },
    loading: { control: 'boolean' }
  },
  args: {
    label: 'Category',
    size: 'lg',
    invalid: false,
    loading: false,
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
type Story = StoryObj<typeof meta>

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
      return { selected, args }
    },
    template:
      '<SingleSelect v-model="selected" :options="args.options" :label="args.label" :size="args.size" :invalid="args.invalid" :loading="args.loading" />'
  })
}

export const MediumSize: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>('popular')
      return { selected, sampleOptions }
    },
    template:
      '<SingleSelect v-model="selected" :options="sampleOptions" label="Category" size="md" />'
  }),
  parameters: { controls: { disable: true } }
}

export const WithIcon: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>('popular')
      return { selected, sampleOptions }
    },
    template: `
      <SingleSelect v-model="selected" :options="sampleOptions" label="Sorting Type">
        <template #icon>
          <i class="icon-[lucide--arrow-up-down] size-3.5" />
        </template>
      </SingleSelect>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const Disabled: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>('popular')
      return { selected, sampleOptions }
    },
    template:
      '<SingleSelect v-model="selected" :options="sampleOptions" label="Category" disabled />'
  }),
  parameters: { controls: { disable: true } }
}

export const Invalid: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>('popular')
      return { selected, sampleOptions }
    },
    template:
      '<SingleSelect v-model="selected" :options="sampleOptions" label="Category" invalid />'
  }),
  parameters: { controls: { disable: true } }
}

export const Loading: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | null>('popular')
      return { selected, sampleOptions }
    },
    template:
      '<SingleSelect v-model="selected" :options="sampleOptions" label="Category" loading />'
  }),
  parameters: { controls: { disable: true } }
}

export const AllStates: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const a = ref<string | null>('popular')
      const b = ref<string | null>('popular')
      const c = ref<string | null>('popular')
      const d = ref<string | null>('popular')
      const e = ref<string | null>('popular')
      return { sampleOptions, a, b, c, d, e }
    },
    template: `
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Large (Interface)</p>
          <div class="flex flex-col gap-3">
            <SingleSelect v-model="a" :options="sampleOptions" label="Default" />
            <SingleSelect v-model="b" :options="sampleOptions" label="Disabled" disabled />
            <SingleSelect v-model="c" :options="sampleOptions" label="Invalid" invalid />
            <SingleSelect v-model="d" :options="sampleOptions" label="Loading" loading />
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Medium (Node)</p>
          <div class="flex flex-col gap-3">
            <SingleSelect v-model="a" :options="sampleOptions" label="Default" size="md" />
            <SingleSelect v-model="b" :options="sampleOptions" label="Disabled" size="md" disabled />
            <SingleSelect v-model="c" :options="sampleOptions" label="Invalid" size="md" invalid />
            <SingleSelect v-model="e" :options="sampleOptions" label="Loading" size="md" loading />
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true }
  }
}
