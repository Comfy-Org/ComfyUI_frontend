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

export const Default: Story = {
  name: 'Minimum panel reference',
  render: () => ({
    components: { AgentPaywallCard },
    template: '<div class="w-[372px]"><AgentPaywallCard /></div>'
  })
}

export const WidePanel: Story = {
  render: () => ({
    components: { AgentPaywallCard },
    template: '<div class="w-[608px]"><AgentPaywallCard /></div>'
  })
}
