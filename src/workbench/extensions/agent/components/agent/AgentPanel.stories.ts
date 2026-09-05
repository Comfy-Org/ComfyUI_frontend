import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'
import '../../agentPanel.css'

import AgentPanel from './AgentPanel.vue'

const emptyHistory: HistoryGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

const meta: Meta<typeof AgentPanel> = {
  title: 'Agent/AgentPanel',
  component: AgentPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    entries: [],
    historyGroups: emptyHistory,
    userName: 'Comfy user',
    activeTab: { path: 'workflows/portrait.json', name: 'portrait' },
    workflowTabs: [{ path: 'workflows/portrait.json', name: 'portrait' }]
  },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-agent-surface-raised h-screen w-100"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const PanelSpacing: Story = {
  name: 'Panel spacing'
}
