import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CrdtDevPanel from './CrdtDevPanel.vue'
import type { AgentCrdtStatus } from './agentCrdtStatus'

const status: AgentCrdtStatus = {
  enabled: true,
  connected: true,
  workflowId: 'workflow-debug-42',
  updatesApplied: 17,
  lastFrameType: 'doc_update',
  outcomes: {
    received: 20,
    applied: 17,
    appliedLive: 17,
    skipped: 2,
    errored: 0,
    gap: 1,
    reset: 0,
    dropped: 0
  }
}

const meta = {
  title: 'Workbench/Agent/CRDT Debug Panel',
  component: CrdtDevPanel,
  tags: ['autodocs'],
  args: { status },
  decorators: [
    () => ({
      template:
        '<div class="flex h-[720px] w-[420px] flex-col justify-end bg-base-background py-4"><story /></div>'
    })
  ]
} satisfies Meta<typeof CrdtDevPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  beforeEach: () => {
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.hidden', 'false')
  }
}

export const Collapsed: Story = {
  beforeEach: () => {
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'false')
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.hidden', 'false')
  }
}
