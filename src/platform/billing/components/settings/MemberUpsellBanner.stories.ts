import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MemberUpsellBanner from './MemberUpsellBanner.vue'

const meta: Meta<typeof MemberUpsellBanner> = {
  title: 'Platform/Workspace/MemberUpsellBanner',
  component: MemberUpsellBanner,
  tags: ['autodocs'],
  argTypes: {
    onAction: { action: 'action' }
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-[720px] bg-background p-6"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Upgrade: Story = {}
