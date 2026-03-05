import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, ref, toRefs } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputText from './WidgetInputText.vue'

interface StoryArgs extends ComponentPropsAndSlots<typeof WidgetInputText> {
  readOnly: boolean
  disabled: boolean
  invalid: boolean
  placeholder: string
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/WidgetInputText',
  component: WidgetInputText,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    readOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    placeholder: { control: 'text' }
  },
  args: {
    readOnly: false,
    disabled: false,
    invalid: false,
    placeholder: ''
  },
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
  render: (args) => ({
    components: { WidgetInputText },
    setup() {
      const { readOnly, disabled, invalid, placeholder } = toRefs(args)
      const value = ref('Hello world')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'text',
        type: 'STRING',
        value: '',
        borderStyle: invalid.value
          ? 'border border-destructive-background'
          : undefined,
        options: {
          read_only: readOnly.value,
          disabled: disabled.value,
          ...(placeholder.value ? { placeholder: placeholder.value } : {})
        }
      }))
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { WidgetInputText },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref('This text is disabled')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'locked',
        type: 'STRING',
        value: '',
        options: { disabled: disabled.value }
      }))
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}

export const Invalid: Story = {
  args: { invalid: true },
  render: (args) => ({
    components: { WidgetInputText },
    setup() {
      const { invalid } = toRefs(args)
      const value = ref('Invalid input value')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'text',
        type: 'STRING',
        value: '',
        borderStyle: invalid.value
          ? 'border border-destructive-background'
          : undefined
      }))
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}

export const WithPlaceholder: Story = {
  args: { placeholder: 'Enter your prompt here...' },
  render: (args) => ({
    components: { WidgetInputText },
    setup() {
      const { placeholder } = toRefs(args)
      const value = ref('')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'prompt',
        type: 'STRING',
        value: '',
        options: {
          ...(placeholder.value ? { placeholder: placeholder.value } : {})
        }
      }))
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
      const widget: SimplifiedWidget<string> = {
        name: 'seed',
        type: 'STRING',
        value: '',
        label: 'Random Seed'
      }
      return { value, widget }
    },
    template: '<WidgetInputText :widget="widget" v-model="value" />'
  })
}
