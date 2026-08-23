import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MediaAssetSelectionBar from './MediaAssetSelectionBar.vue'

const meta: Meta<typeof MediaAssetSelectionBar> = {
  title: 'Platform/Assets/MediaAssetSelectionBar',
  component: MediaAssetSelectionBar,
  decorators: [
    () => ({
      template:
        '<div class="bg-base-background" style="position:relative;display:flex;flex-direction:column;justify-content:flex-end;height:480px;width:360px;"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { count: 2, showDelete: true }
}

export const SingleSelection: Story = {
  args: { count: 1, showDelete: true }
}

export const WithoutDelete: Story = {
  args: { count: 3, showDelete: false }
}
