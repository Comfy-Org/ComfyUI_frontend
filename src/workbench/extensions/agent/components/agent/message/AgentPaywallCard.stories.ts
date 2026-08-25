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
  render: () => ({
    components: { AgentPaywallCard },
    template: '<div class="w-[372px]"><AgentPaywallCard /></div>'
  })
}
