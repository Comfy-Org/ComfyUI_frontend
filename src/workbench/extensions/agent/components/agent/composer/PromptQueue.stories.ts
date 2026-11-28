import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import '@/workbench/extensions/agent/agentPanel.css'

import PromptQueue from './PromptQueue.vue'
import type { PromptQueueRow } from './PromptQueue.vue'

const waiting: PromptQueueRow = {
  id: 'waiting',
  text: 'Prompt message number 2',
  status: 'waiting'
}

const later: PromptQueueRow = {
  id: 'later',
  text: 'Prompt message number 3',
  status: 'waiting'
}

const meta: Meta<typeof PromptQueue> = {
  title: 'Agent/Composer/PromptQueue',
  component: PromptQueue,
  tags: ['autodocs'],
  args: {
    expanded: true,
    onToggle: fn(),
    onEdit: fn(),
    onDelete: fn()
  },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex w-80 flex-col gap-2"><story /><div class="h-28 rounded-lg border border-border/50 bg-background" /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { items: [] }
}

export const OneQueued: Story = {
  args: { items: [waiting] }
}

export const ManyQueued: Story = {
  args: { items: [waiting, later] }
}

export const Collapsed: Story = {
  args: {
    items: [waiting, later],
    expanded: false
  }
}
