import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, provide, ref, toRefs } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

import WidgetTextarea from './WidgetTextarea.vue'

interface StoryArgs extends ComponentPropsAndSlots<typeof WidgetTextarea> {
  readOnly: boolean
  disabled: boolean
}

const meta: Meta<StoryArgs> = {
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
          'Shows a copy-to-clipboard button on hover.'
        ].join(' ')
      }
    }
  },
  argTypes: {
    readOnly: { control: 'boolean' },
    disabled: { control: 'boolean' }
  },
  args: {
    readOnly: false,
    disabled: false
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
  render: (args) => ({
    components: { WidgetTextarea },
    setup() {
      const { readOnly, disabled } = toRefs(args)
      const value = ref('A multi-line text area for entering prompts.')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'prompt',
        type: 'STRING',
        value: '',
        label: 'Prompt',
        options: {
          read_only: readOnly.value,
          disabled: disabled.value
        }
      }))
      return { value, widget }
    },
    template:
      '<WidgetTextarea :widget="widget" v-model="value" placeholder="Enter prompt..." />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { WidgetTextarea },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref('This textarea is disabled via widget options.')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'locked',
        type: 'STRING',
        value: '',
        label: 'Locked Field',
        options: { disabled: disabled.value }
      }))
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
      const widget: SimplifiedWidget<string> = {
        name: 'notes',
        type: 'STRING',
        value: '',
        label: 'Notes'
      }
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
      const widget: SimplifiedWidget<string> = {
        name: 'negative',
        type: 'STRING',
        value: '',
        label: 'Negative Prompt'
      }
      return { value, widget }
    },
    template:
      '<WidgetTextarea :widget="widget" v-model="value" placeholder="Describe what to avoid..." />'
  })
}
