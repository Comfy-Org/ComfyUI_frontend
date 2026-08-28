import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AgentPanel from './AgentPanel.vue'

const emptyHistory = { current: [], today: [], yesterday: [], earlier: [] }

const meta: Meta<typeof AgentPanel> = {
  title: 'Agent/Linear UX/AgentPanel',
  component: AgentPanel,
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
        '<div class="bg-agent-surface-raised h-screen w-[400px]"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/** T-26 / PM-670 / FE-1324: header, content, notice, and composer spacing. */
export const T26PanelSpacing: Story = {}

/** T-27 / PM-674 / FE-1319: hover header controls to inspect compact black tooltips. */
export const T27CompactBlackTooltips: Story = {
  parameters: { pseudo: { hover: true } }
}
