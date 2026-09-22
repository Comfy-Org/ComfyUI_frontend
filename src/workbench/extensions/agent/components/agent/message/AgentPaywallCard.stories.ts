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

export const AdmissionError: Story = {
  args: {
    presentation: { kind: 'member' },
    message: 'Your workspace spend limit was reached.'
  },
  render: renderAtMinimumWidth
}

// The service-error copy arrives as a `message` override, so this exercises the
// override path rather than the `unavailable` presentation below.
export const ServiceErrorMessage: Story = {
  args: {
    presentation: { kind: 'member' },
    message: 'The agent is temporarily unavailable. Try again shortly.'
  },
  render: renderAtMinimumWidth
}

// The default presentation. No `message`, so its own body key renders.
export const Unavailable: Story = {
  args: { presentation: { kind: 'unavailable' } },
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
