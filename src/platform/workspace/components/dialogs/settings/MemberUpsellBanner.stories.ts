import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MemberUpsellBanner from './MemberUpsellBanner.vue'

const meta: Meta<typeof MemberUpsellBanner> = {
  title: 'Platform/Workspace/MemberUpsellBanner',
  component: MemberUpsellBanner,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['upgrade', 'reactivate', 'contactSales']
    },
    onAction: { action: 'action' }
  },
  args: {
    variant: 'upgrade'
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

// Personal workspace pitching the Team plan: acquisition copy, no title.
export const Upgrade: Story = {
  args: { variant: 'upgrade' }
}

// Team plan past its end date (subscription_status 'ended'): win-back copy
// with the in-product resume action. Cancel-scheduled plans show no banner
// at all — invites stay live until the plan actually ends (DES-1200).
export const Reactivate: Story = {
  args: { variant: 'reactivate' }
}

// Ended Enterprise: the route back is sales, not a resume button.
export const ContactSales: Story = {
  args: { variant: 'contactSales', enterprise: true }
}

// Ended unrecognized tier: same sales route, plan-neutral copy — an
// unidentifiable plan is never named Enterprise.
export const ContactSalesUnknownTier: Story = {
  args: { variant: 'contactSales' }
}

export const AllStates: Story = {
  render: () => ({
    components: { MemberUpsellBanner },
    template: `
      <div class="flex flex-col gap-4">
        <MemberUpsellBanner variant="upgrade" />
        <MemberUpsellBanner variant="reactivate" />
        <MemberUpsellBanner variant="contactSales" enterprise />
        <MemberUpsellBanner variant="contactSales" />
      </div>
    `
  })
}
