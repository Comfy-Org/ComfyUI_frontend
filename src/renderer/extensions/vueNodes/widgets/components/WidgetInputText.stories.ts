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
  title: 'Components/Input/InputText',
  component: WidgetInputText,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size: {
      control: 'select',
      options: ['medium', 'large']
    },
    readOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    loading: { control: 'boolean' },
    placeholder: { control: 'text' }
  },
  args: {
    size: 'medium',
    readOnly: false,
    disabled: false,
    invalid: false,
    loading: false,
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
      const { size, readOnly, disabled, invalid, loading, placeholder } =
        toRefs(args)
      const value = ref('Hello world')
      const widget = computed<SimplifiedWidget<string>>(() => ({
        name: 'text',
        type: 'STRING',
        value: '',
        options: {
          read_only: readOnly.value,
          disabled: disabled.value,
          ...(placeholder.value ? { placeholder: placeholder.value } : {})
        }
      }))
      return { value, widget, size, invalid, loading }
    },
    template:
      '<WidgetInputText :widget="widget" :size="size" :invalid="invalid" :loading="loading" v-model="value" />'
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
      const widget: SimplifiedWidget<string> = {
        name: 'text',
        type: 'STRING',
        value: ''
      }
      return { value, widget, invalid }
    },
    template:
      '<WidgetInputText :widget="widget" :invalid="invalid" v-model="value" />'
  })
}

export const Status: Story = {
  args: { loading: true },
  render: (args) => ({
    components: { WidgetInputText },
    setup() {
      const { loading } = toRefs(args)
      const value = ref('Loading...')
      const widget: SimplifiedWidget<string> = {
        name: 'text',
        type: 'STRING',
        value: ''
      }
      return { value, widget, loading }
    },
    template:
      '<WidgetInputText :widget="widget" :loading="loading" v-model="value" />'
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
