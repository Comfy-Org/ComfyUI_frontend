import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AgentPaywallCard from './AgentPaywallCard.vue'

const meta: Meta<typeof AgentPaywallCard> = {
  title: 'Workbench/Agent/AgentPaywallCard',
  component: AgentPaywallCard,
  parameters: { layout: 'centered' },
  globals: { theme: 'dark' }
}

export default meta
type Story = StoryObj<typeof meta>

const renderAtMinimumWidth: Story['render'] = (args) => ({
  components: { AgentPaywallCard },
  setup: () => ({ args }),
  template: '<div class="w-[372px]"><AgentPaywallCard v-bind="args" /></div>'
})

export const Subscribed: Story = {
  args: { presentation: { kind: 'subscribed', showUpgrade: true } },
  render: renderAtMinimumWidth
}

export const HighestPlan: Story = {
  args: { presentation: { kind: 'subscribed', showUpgrade: false } },
  render: renderAtMinimumWidth
}

export const SubscriptionRequired: Story = {
  args: { presentation: { kind: 'subscriptionRequired' } },
  render: renderAtMinimumWidth
}

export const Member: Story = {
  args: { presentation: { kind: 'member' } },
  render: renderAtMinimumWidth
}

export const SalesManaged: Story = {
  args: { presentation: { kind: 'salesManaged' } },
  render: renderAtMinimumWidth
}

export const Local: Story = {
  args: { presentation: { kind: 'local' } },
  render: renderAtMinimumWidth
}

export const WidePanel: Story = {
  args: { presentation: { kind: 'subscribed', showUpgrade: true } },
  render: (args) => ({
    components: { AgentPaywallCard },
    setup: () => ({ args }),
    template: '<div class="w-[608px]"><AgentPaywallCard v-bind="args" /></div>'
  })
}
