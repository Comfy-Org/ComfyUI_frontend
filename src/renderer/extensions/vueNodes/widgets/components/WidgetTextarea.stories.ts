import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { provide, ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

import WidgetTextarea from './WidgetTextarea.vue'

function createWidget(
  overrides: Partial<SimplifiedWidget<string>> = {}
): SimplifiedWidget<string> {
  return {
    name: 'text',
    type: 'STRING',
    value: '',
    ...overrides
  }
}

const meta: Meta<typeof WidgetTextarea> = {
  title: 'Widgets/WidgetTextarea',
  component: WidgetTextarea,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Multi-line text input with optional label.',
          'Captures wheel, pointer, and context menu events to prevent canvas interference.',
          'Shows a copy-to-clipboard button on hover when in read-only mode.'
        ].join(' ')
      }
    }
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-80 h-40"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      const value = ref('A multi-line text area for entering prompts.')
      const widget = createWidget({ name: 'prompt', label: 'Prompt' })
      return { value, widget }
    },
    template:
      '<WidgetTextarea :widget="widget" v-model="value" placeholder="Enter prompt..." />'
  })
}

export const WithLabelVisible: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      const value = ref('beautiful landscape, mountains, sunset, 4k, detailed')
      const widget = createWidget({
        name: 'positive',
        label: 'Positive Prompt'
      })
      return { value, widget }
    },
    template: '<WidgetTextarea :widget="widget" v-model="value" />'
  })
}

export const HiddenLabel: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      provide(HideLayoutFieldKey, true)
      const value = ref('Label is hidden via HideLayoutFieldKey injection.')
      const widget = createWidget({ name: 'notes', label: 'Notes' })
      return { value, widget }
    },
    template: '<WidgetTextarea :widget="widget" v-model="value" />'
  })
}

export const ReadOnly: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      const value = ref('This text is read-only. Hover to see the copy button.')
      const widget = createWidget({
        name: 'output',
        label: 'Output',
        options: { read_only: true }
      })
      return { value, widget }
    },
    template: '<WidgetTextarea :widget="widget" v-model="value" />'
  }),
  parameters: {
    docs: {
      description: {
        story:
          'When read-only, a copy-to-clipboard button appears on hover in the top-right corner.'
      }
    }
  }
}

export const Disabled: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      const value = ref('This textarea is disabled via widget options.')
      const widget = createWidget({
        name: 'locked',
        label: 'Locked Field',
        options: { disabled: true }
      })
      return { value, widget }
    },
    template: '<WidgetTextarea :widget="widget" v-model="value" />'
  })
}

export const WithPlaceholder: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      const value = ref('')
      const widget = createWidget({
        name: 'negative',
        label: 'Negative Prompt'
      })
      return { value, widget }
    },
    template:
      '<WidgetTextarea :widget="widget" v-model="value" placeholder="Describe what to avoid..." />'
  })
}
