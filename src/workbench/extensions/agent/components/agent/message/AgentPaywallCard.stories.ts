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

// A `message` renders only when capabilities resolved to nothing actionable.
// Any other kind has a localized body that is better copy than English prose
// from the server, so these two stories use `unavailable`.
export const AdmissionError: Story = {
  args: {
    presentation: { kind: 'unavailable' },
    message: 'Your workspace spend limit was reached.'
  },
  render: renderAtMinimumWidth
}

export const ServiceErrorMessage: Story = {
  args: {
    presentation: { kind: 'unavailable' },
    message: 'The agent is temporarily unavailable. Try again shortly.'
  },
  render: renderAtMinimumWidth
}

// The default presentation. No `message`, so its own body key renders.
export const Unavailable: Story = {
  args: { presentation: { kind: 'unavailable' } },
  render: renderAtMinimumWidth
}

// The read is still in flight, so the localized body renders even though a
// server `message` is present.
export const Unresolved: Story = {
  args: {
    presentation: { kind: 'unresolved' },
    message: 'Add credits to continue.'
  },
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
