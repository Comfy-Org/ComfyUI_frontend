import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import Slider from './Slider.vue'

const meta: Meta<typeof Slider> = {
  title: 'Website/UI/Slider',
  component: Slider,
  tags: ['autodocs', 'stable'],
  decorators: [() => ({ template: '<div class="w-96 p-8"><story /></div>' })],
  args: { modelValue: [40], thumbLabel: 'Quality', min: 0, max: 100 },
  render: (args) => ({
    components: { Slider },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: '<Slider v-bind="args" v-model="value" />'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole('slider', {
      name: 'Quality'
    })
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(slider).toHaveAttribute('aria-valuenow', '41')
  }
}
export const WithTicks: Story = { args: { ticks: 5, modelValue: [50] } }
export const Range: Story = {
  args: { modelValue: [25, 75], thumbLabel: 'Range boundary' }
}
export const Disabled: Story = { args: { disabled: true } }
