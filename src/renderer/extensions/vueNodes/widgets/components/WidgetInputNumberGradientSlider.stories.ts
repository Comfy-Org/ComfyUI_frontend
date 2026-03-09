import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, ref, toRefs } from 'vue'

import type { IWidgetGradientSliderOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'

interface StoryArgs extends ComponentPropsAndSlots<
  typeof WidgetInputNumberGradientSlider
> {
  min: number
  max: number
  precision: number
  disabled: boolean
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/NumberGradientSlider',
  component: WidgetInputNumberGradientSlider,
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
    components: { WidgetInputNumberGradientSlider },
    setup() {
      const { min, max, precision, disabled } = toRefs(args)
      const value = ref(50)
      const widget = computed<
        SimplifiedWidget<number, IWidgetGradientSliderOptions>
      >(() => ({
        name: 'value',
        type: 'FLOAT',
        value: 0,
        options: {
          min: min.value,
          max: max.value,
          step2: 0.01,
          precision: precision.value,
          disabled: disabled.value
        }
      }))
      return { value, widget }
    },
    template:
      '<WidgetInputNumberGradientSlider :widget="widget" v-model="value" />'
  })
}

export const CustomGradient: Story = {
  render: () => ({
    components: { WidgetInputNumberGradientSlider },
    setup() {
      const value = ref(50)
      const widget: SimplifiedWidget<number, IWidgetGradientSliderOptions> = {
        name: 'color_value',
        type: 'FLOAT',
        value: 0,
        options: {
          min: 0,
          max: 100,
          step2: 0.01,
          gradient_stops: [
            { offset: 0, color: [255, 0, 0] },
            { offset: 0.5, color: [0, 255, 0] },
            { offset: 1, color: [0, 0, 255] }
          ]
        }
      }
      return { value, widget }
    },
    template:
      '<WidgetInputNumberGradientSlider :widget="widget" v-model="value" />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { WidgetInputNumberGradientSlider },
    setup() {
      const { disabled } = toRefs(args)
      const value = ref(50)
      const widget = computed<
        SimplifiedWidget<number, IWidgetGradientSliderOptions>
      >(() => ({
        name: 'value',
        type: 'FLOAT',
        value: 0,
        options: {
          min: 0,
          max: 100,
          step2: 0.01,
          precision: 2,
          disabled: disabled.value
        }
      }))
      return { value, widget }
    },
    template:
      '<WidgetInputNumberGradientSlider :widget="widget" v-model="value" />'
  })
}

export const WithLabel: Story = {
  render: () => ({
    components: { WidgetInputNumberGradientSlider },
    setup() {
      const value = ref(0.5)
      const widget: SimplifiedWidget<number, IWidgetGradientSliderOptions> = {
        name: 'strength',
        type: 'FLOAT',
        value: 0,
        label: 'Denoise Strength',
        options: {
          min: 0,
          max: 1,
          step2: 0.01,
          precision: 3
        }
      }
      return { value, widget }
    },
    template:
      '<WidgetInputNumberGradientSlider :widget="widget" v-model="value" />'
  })
}
