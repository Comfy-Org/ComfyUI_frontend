import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import CreditSlider from './CreditSlider.vue'

const meta: Meta<typeof CreditSlider> = {
  title: 'Components/CreditSlider',
  component: CreditSlider,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' }
  },
  args: {
    disabled: false
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-96"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { CreditSlider },
    setup() {
      const value = ref(700)
      return { args, value }
    },
    template: '<CreditSlider v-model="value" :disabled="args.disabled" />'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { CreditSlider },
    setup() {
      const value = ref(700)
      return { args, value }
    },
    template: '<CreditSlider v-model="value" :disabled="args.disabled" />'
  })
}
