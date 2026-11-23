import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { provide, ref, toRefs } from 'vue'

import { useStoryWidget } from '@/storybook/mocks/useStoryWidget'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

import WidgetTextarea from './WidgetTextarea.vue'

interface StoryArgs extends ComponentPropsAndSlots<typeof WidgetTextarea> {
  readOnly: boolean
  disabled: boolean
}

const meta: Meta<StoryArgs> = {
  title: 'Components/Input/TextArea',
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
      const widgetId = useStoryWidget(() => ({
        name: 'prompt',
        type: 'STRING',
        value: '',
        label: 'Prompt',
        options: {
          read_only: readOnly.value,
          disabled: disabled.value
        }
      }))
      return { value, widgetId }
    },
    template:
      '<WidgetTextarea :widget-id="widgetId" v-model="value" placeholder="Enter prompt..." />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { WidgetTextarea },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref('This textarea is disabled via widget options.')
      const widgetId = useStoryWidget(() => ({
        name: 'locked',
        type: 'STRING',
        value: '',
        label: 'Locked Field',
        options: { disabled: disabled.value }
      }))
      return { value, widgetId }
    },
    template: '<WidgetTextarea :widget-id="widgetId" v-model="value" />'
  })
}

export const HiddenLabel: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      provide(HideLayoutFieldKey, true)
      const value = ref('Label is hidden via HideLayoutFieldKey injection.')
      const widgetId = useStoryWidget(() => ({
        name: 'notes',
        type: 'STRING',
        value: '',
        label: 'Notes',
        options: {}
      }))
      return { value, widgetId }
    },
    template: '<WidgetTextarea :widget-id="widgetId" v-model="value" />'
  })
}

export const WithPlaceholder: Story = {
  render: () => ({
    components: { WidgetTextarea },
    setup() {
      const value = ref('')
      const widgetId = useStoryWidget(() => ({
        name: 'negative',
        type: 'STRING',
        value: '',
        label: 'Negative Prompt',
        options: {}
      }))
      return { value, widgetId }
    },
    template:
      '<WidgetTextarea :widget-id="widgetId" v-model="value" placeholder="Describe what to avoid..." />'
  })
}
