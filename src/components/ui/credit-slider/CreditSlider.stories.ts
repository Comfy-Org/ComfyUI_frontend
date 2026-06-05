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
      // Previews at the real layout width: the Figma "Team Plan" card column is
      // 512px wide with 32px padding (DES-197), i.e. a 448px content area — the
      // width the slider actually renders into inside PricingTableWorkspace.
      template: '<div class="w-[512px] px-8"><story /></div>'
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
