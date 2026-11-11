import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '@/workbench/extensions/agent/agentPanel.css'

import AgentSidebarNav from './AgentSidebarNav.vue'

const meta: Meta<typeof AgentSidebarNav> = {
  title: 'Agent/AgentSidebarNav',
  component: AgentSidebarNav,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { section: 'chats' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope w-65 bg-background p-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Chats: Story = {}

export const Apps: Story = { args: { section: 'apps' } }

export const Workflows: Story = { args: { section: 'workflows' } }

export const Compact: Story = {
  args: { section: 'apps', compact: true },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope w-12 bg-background p-2"><story /></div>'
    })
  ]
}
