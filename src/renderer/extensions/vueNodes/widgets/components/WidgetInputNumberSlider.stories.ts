import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, ref, toRefs } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'

interface StoryArgs extends ComponentPropsAndSlots<
  typeof WidgetInputNumberSlider
> {
  min: number
  max: number
  precision: number
  disabled: boolean
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/NumberSlider',
  component: WidgetInputNumberSlider,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    precision: { control: 'number' },
    disabled: { control: 'boolean' }
  },
  args: {
    min: 0,
    max: 100,
    precision: 2,
    disabled: false
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
    components: { WidgetInputNumberSlider },
    setup() {
      const { min, max, precision, disabled } = toRefs(args)
      const value = ref(36.02)
      const widget = computed<SimplifiedWidget<number>>(() => ({
        name: 'value',
        type: 'FLOAT',
        value: 0,
        options: {
          min: min.value,
          max: max.value,
          precision: precision.value,
          disabled: disabled.value
        }
      }))
      return { value, widget }
    },
    template: '<WidgetInputNumberSlider :widget="widget" v-model="value" />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { WidgetInputNumberSlider },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref(36.02)
      const widget = computed<SimplifiedWidget<number>>(() => ({
        name: 'value',
        type: 'FLOAT',
        value: 0,
        options: {
          min: 0,
          max: 100,
          precision: 2,
          disabled: disabled.value
        }
      }))
      return { value, widget }
    },
    template: '<WidgetInputNumberSlider :widget="widget" v-model="value" />'
  })
}

export const Integer: Story = {
  args: { precision: 0 },
  render: (args) => ({
    components: { WidgetInputNumberSlider },
    setup() {
      const { precision } = toRefs(args)
      const value = ref(42)
      const widget = computed<SimplifiedWidget<number>>(() => ({
        name: 'steps',
        type: 'INT',
        value: 0,
        options: {
          min: 0,
          max: 100,
          precision: precision.value
        }
      }))
      return { value, widget }
    },
    template: '<WidgetInputNumberSlider :widget="widget" v-model="value" />'
  })
}

export const NegativeRange: Story = {
  args: { min: -100, max: 100 },
  render: (args) => ({
    components: { WidgetInputNumberSlider },
    setup() {
      const { min, max } = toRefs(args)
      const value = ref(-25)
      const widget = computed<SimplifiedWidget<number>>(() => ({
        name: 'offset',
        type: 'FLOAT',
        value: 0,
        options: {
          min: min.value,
          max: max.value,
          precision: 2
        }
      }))
      return { value, widget }
    },
    template: '<WidgetInputNumberSlider :widget="widget" v-model="value" />'
  })
}

export const SmallStep: Story = {
  args: { min: 0, max: 1, precision: 5 },
  render: (args) => ({
    components: { WidgetInputNumberSlider },
    setup() {
      const { min, max, precision } = toRefs(args)
      const value = ref(0.5)
      const widget = computed<SimplifiedWidget<number>>(() => ({
        name: 'denoise',
        type: 'FLOAT',
        value: 0,
        options: {
          min: min.value,
          max: max.value,
          precision: precision.value
        }
      }))
      return { value, widget }
    },
    template: '<WidgetInputNumberSlider :widget="widget" v-model="value" />'
  })
}

export const WithLabel: Story = {
  render: () => ({
    components: { WidgetInputNumberSlider },
    setup() {
      const value = ref(0.75)
      const widget: SimplifiedWidget<number> = {
        name: 'cfg',
        type: 'FLOAT',
        value: 0,
        label: 'CFG Scale',
        options: {
          min: 0,
          max: 20,
          precision: 2
        }
      }
      return { value, widget }
    },
    template: '<WidgetInputNumberSlider :widget="widget" v-model="value" />'
  })
}
