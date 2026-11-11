import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '@/workbench/extensions/agent/agentPanel.css'

import ChatOpeningPane from './ChatOpeningPane.vue'

const meta: Meta<typeof ChatOpeningPane> = {
  title: 'Agent/ChatOpeningPane',
  component: ChatOpeningPane,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { status: 'loading', title: 'Portrait upscale' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex h-120 flex-col bg-background"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {}

export const Failed: Story = { args: { status: 'failed' } }
