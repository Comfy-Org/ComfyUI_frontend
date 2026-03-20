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
  render: () => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#e06cbd')
      return { color }
    },
    template: '<ColorPicker v-model="color" />'
  })
}

export const Red: Story = {
  render: () => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#ff0000')
      return { color }
    },
    template: '<ColorPicker v-model="color" />'
  })
}

export const Black: Story = {
  render: () => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#000000')
      return { color }
    },
    template: '<ColorPicker v-model="color" />'
  })
}

export const White: Story = {
  render: () => ({
    components: { ColorPicker },
    setup() {
      const color = ref('#ffffff')
      return { color }
    },
    template: '<ColorPicker v-model="color" />'
  })
}
