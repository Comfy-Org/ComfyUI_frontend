import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { onBeforeUnmount } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import '@/workbench/extensions/agent/agentPanel.css'

import AgentBrand from './AgentBrand.vue'

const meta: Meta<typeof AgentBrand> = {
  title: 'Agent/AgentBrand',
  component: AgentBrand,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex h-12 w-100 items-center bg-background px-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Classic: Story = {}

export const Redesign: Story = {
  decorators: [
    () => ({
      setup() {
        const store = useAgentPanelStore()
        store.experience = 'redesign'
        onBeforeUnmount(() => {
          store.experience = 'classic'
        })
      },
      template: '<story />'
    })
  ]
}
