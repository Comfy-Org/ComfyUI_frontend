import type { Meta, StoryObj } from '@storybook/vue3-vite'

import RatingPanel from './RatingPanel.vue'

const meta: Meta<typeof RatingPanel> = {
  title: 'Components/Widget/Panel/RatingPanel',
  component: RatingPanel
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { RatingPanel },
    template: `
      <div style="height: 500px; width: 80px;">
        <RatingPanel/>
      </div>
    `
  })
}
