import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MemberUpsellBanner from './MemberUpsellBanner.vue'

const meta: Meta<typeof MemberUpsellBanner> = {
  title: 'Platform/Workspace/MemberUpsellBanner',
  component: MemberUpsellBanner,
  tags: ['autodocs'],
  argTypes: {
    reactivate: { control: 'boolean' },
    onShowPlans: { action: 'showPlans' }
  },
  args: {
    reactivate: false
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div class="w-[720px] bg-base-background p-6"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

// Workspace that never subscribed to a team plan: acquisition copy.
export const Upgrade: Story = {
  args: { reactivate: false }
}

// Team plan that was subscribed and has since been cancelled or ended: win-back
// copy (driven by hasLapsedTeamPlan → subscriptionStatus 'canceled' | 'ended').
export const Reactivate: Story = {
  args: { reactivate: true }
}

export const BothStates: Story = {
  render: () => ({
    components: { MemberUpsellBanner },
    template: `
      <div class="flex flex-col gap-4">
        <MemberUpsellBanner :reactivate="false" />
        <MemberUpsellBanner :reactivate="true" />
      </div>
    `
  })
}
