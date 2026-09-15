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
        '<div class="agent-scope bg-secondary-background h-screen w-100"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const PanelSpacing: Story = {
  name: 'T-26 / PM-670 / FE-1324 Panel spacing'
}

export const WithHistory: Story = {
  args: {
    sessionId: 'portrait',
    historyGroups: {
      current: [{ id: 'portrait', title: 'Portrait lighting', updatedAt: 0 }],
      today: [
        { id: 'upscale', title: 'Upscale a product photo', updatedAt: 0 }
      ],
      yesterday: [],
      earlier: []
    }
  }
}
