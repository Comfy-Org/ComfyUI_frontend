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
  parameters: { layout: 'padded' },
  argTypes: {
    alphaEnabled: { control: 'boolean' }
  },
  args: {
    alphaEnabled: true
  },
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
    template: '<ColorPicker v-model="color" v-bind="args" />'
  })
}

export const WithAlpha: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#3498db80')
      return { color, args }
    },
    template: '<ColorPicker v-model="color" v-bind="args" />'
  })
}

export const AlphaDisabled: Story = {
  args: { alphaEnabled: false },
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#2ecc71')
      return { color, args }
    },
    template: '<ColorPicker v-model="color" v-bind="args" />'
  })
}

export const Red: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#ff0000')
      return { color, args }
    },
    template: '<ColorPicker v-model="color" v-bind="args" />'
  })
}

export const Black: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#000000')
      return { color, args }
    },
    template: '<ColorPicker v-model="color" v-bind="args" />'
  })
}

export const White: Story = {
  render: (args) => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#ffffff')
      return { color, args }
    },
    template: '<ColorPicker v-model="color" v-bind="args" />'
  })
}
