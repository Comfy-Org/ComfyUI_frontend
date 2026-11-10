import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor, within } from 'storybook/test'

import { FREE_USE_NOTICE_DISMISSED_KEY } from '@/workbench/extensions/agent/components/agent/freeUseNoticeDismissal'
import '@/workbench/extensions/agent/agentPanel.css'

import DualLedgerChip from './DualLedgerChip.vue'
import ExplorationAgentDock from './ExplorationAgentDock.vue'
import {
  emptyHistory,
  panelTabs,
  portraitTab,
  usingFreeEntries
} from './fixtures'

function clearNoticeDismissals() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(FREE_USE_NOTICE_DISMISSED_KEY)) {
      localStorage.removeItem(key)
    }
  }
}

const meta: Meta<typeof ExplorationAgentDock> = {
  title: 'Explorations/DES-1317/Dual ledger chip',
  component: ExplorationAgentDock,
  parameters: { layout: 'fullscreen' },
  globals: { theme: 'dark' },
  args: {
    historyGroups: emptyHistory,
    userName: 'Comfy user',
    activeTab: portraitTab,
    workflowTabs: panelTabs,
    entries: usingFreeEntries,
    freeAmount: '1.4 / 2.0',
    paidAmount: '128,400',
    activeLedger: 'free',
    statusKey: 'agent.explorations.des1317.usingFree',
    chrome: 'app',
    streaming: true
  },
  argTypes: {
    activeLedger: { control: 'select', options: ['free', 'paid'] },
    chrome: { control: 'select', options: ['app', 'dock'] }
  },
  beforeEach() {
    clearNoticeDismissals()
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const InPanel: Story = {}

export const LedgerDetail: Story = {
  args: { ledgerOpen: true, chrome: 'dock' },
  decorators: [
    () => ({
      template:
        '<div class="flex h-screen w-[1440px] items-start justify-end bg-background p-8"><story /></div>'
    })
  ],
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          'Updated a few minutes ago'
        )
      ).toBeVisible()
    )
  }
}

export const Chip: Story = {
  render: () => ({
    components: { DualLedgerChip },
    template: `
      <div class="agent-scope bg-secondary w-100 p-4">
        <DualLedgerChip
          free-amount="1.4 / 2.0"
          paid-amount="128,400"
          initially-open
        />
      </div>
    `
  }),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByText(
          'Updated a few minutes ago'
        )
      ).toBeVisible()
    )
  }
}
