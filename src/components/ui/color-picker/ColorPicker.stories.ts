import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { ref } from 'vue'

import ColorPicker from './ColorPicker.vue'

const meta: Meta<ComponentPropsAndSlots<typeof ColorPicker>> = {
  title: 'Components/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs'],
  args: {
    accessibleLabel: 'Color',
    hexLabel: 'Hex',
    rgbaLabel: 'RGBA',
    hueLabel: 'Hue',
    alphaLabel: 'Alpha',
    redLabel: 'Red',
    greenLabel: 'Green',
    blueLabel: 'Blue',
    saturationBrightnessLabel: 'Saturation and brightness',
    formatLabel: 'Color format'
  },
  parameters: { layout: 'padded' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-60"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#e06cbd')
      return { color, args }
    },
    template: '<ColorPicker v-bind="args" v-model="color" />'
  })
}

export const Red: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#ff0000')
      return { color, args }
    },
    template: '<ColorPicker v-bind="args" v-model="color" />'
  })
}

export const Black: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#000000')
      return { color, args }
    },
    template: '<ColorPicker v-bind="args" v-model="color" />'
  })
}

export const White: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#ffffff')
      return { color, args }
    },
    template: '<ColorPicker v-bind="args" v-model="color" />'
  })
}
