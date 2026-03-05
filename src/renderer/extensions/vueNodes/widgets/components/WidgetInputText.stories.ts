import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputText from './WidgetInputText.vue'

function createWidget(
  overrides: Partial<SimplifiedWidget<string>> = {}
): SimplifiedWidget<string> {
  return {
    name: 'prompt',
    type: 'STRING',
    value: '',
    ...overrides
  }
}

const meta: Meta<typeof WidgetInputText> = {
  title: 'Widgets/WidgetInputText',
  component: WidgetInputText,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="grid grid-cols-[auto_1fr] gap-1 w-80"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { WidgetInputText },
    setup() {
      const value = ref('Hello world')
      const widget = createWidget({ name: 'text' })
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}

export const WithPlaceholder: Story = {
  render: () => ({
    components: { WidgetInputText },
    setup() {
      const value = ref('')
      const widget = createWidget({
        name: 'prompt',
        options: { placeholder: 'Enter your prompt here...' }
      })
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}

export const ReadOnly: Story = {
  render: () => ({
    components: { WidgetInputText },
    setup() {
      const value = ref('This text cannot be edited')
      const widget = createWidget({
        name: 'output',
        options: { read_only: true }
      })
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}

export const WithLabel: Story = {
  render: () => ({
    components: { WidgetInputText },
    setup() {
      const value = ref('Some value')
      const widget = createWidget({
        name: 'seed',
        label: 'Random Seed'
      })
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}
