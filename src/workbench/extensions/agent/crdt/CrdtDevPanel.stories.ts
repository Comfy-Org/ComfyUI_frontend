import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CrdtDevPanel from './CrdtDevPanel.vue'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const status: AgentCrdtStatus = {
  enabled: true,
  connected: true,
  workflowId: 'workflow-debug-42',
  updatesApplied: 17,
  lastFrameType: 'doc_update',
  outcomes: {
    received: 20,
    applied: 17,
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
  render: () => ({
    components: { CrdtDevPanel },
    setup() {
      localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
      localStorage.setItem('Comfy.Agent.CrdtDevPanel.hidden', 'false')
      return { status }
    },
    template: '<CrdtDevPanel :status="status" />'
  })
}

export const Collapsed: Story = {
  render: () => ({
    components: { CrdtDevPanel },
    setup() {
      localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'false')
      localStorage.setItem('Comfy.Agent.CrdtDevPanel.hidden', 'false')
      return { status }
    },
    template: '<CrdtDevPanel :status="status" />'
  })
}
