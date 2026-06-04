import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import RatingPanel from './RatingPanel.vue'

const meta: Meta<typeof RatingPanel> = {
  title: 'Components/Widget/Panel/RatingPanel',
  component: RatingPanel,
  argTypes: {
    modelValue: {
      control: { type: 'number', min: 1, max: 5, step: 1 },
      description: 'Current rating (1‑5)'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    modelValue: 3
  },
  render: (args) => ({
    components: { RatingPanel },
    setup() {
      const score = ref(args.modelValue)
      return { args, score }
    },
    template: `
      <div style="height: 500px; width: 80px;">
        <RatingPanel
          :modelValue="args.modelValue"
        />
      </div>
    `
  })
}
