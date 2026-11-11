import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import '@/workbench/extensions/agent/agentPanel.css'

import ChatList from './ChatList.vue'

const groups: HistoryGroups = {
  current: [
    {
      id: 'thread-current',
      title: 'Character sheet v2',
      updatedAt: 6,
      titleSource: 'server'
    }
  ],
  today: [
    {
      id: 'thread-upscale',
      title: 'Portrait upscale',
      updatedAt: 5,
      titleSource: 'server'
    },
    {
      id: 'thread-sampler',
      title: 'Fix sampler errors',
      updatedAt: 4,
      titleSource: 'server'
    }
  ],
  yesterday: [
    {
      id: 'thread-ad',
      title: 'Product ad draft',
      updatedAt: 3,
      titleSource: 'server'
    },
    { id: 'thread-untitled', title: '', updatedAt: 2, titleSource: 'server' }
  ],
  earlier: [
    {
      id: 'thread-long',
      title:
        'Turn the storyboard frames into a short looping video with a slow camera pan',
      updatedAt: 1,
      titleSource: 'server'
    }
  ]
}

const meta: Meta<typeof ChatList> = {
  title: 'Agent/ChatList',
  component: ChatList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { groups },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-secondary flex h-120 w-100 flex-col"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LoadingRow: Story = {
  args: { loadingId: 'thread-upscale' }
}

export const FailedRow: Story = {
  args: { failedId: 'thread-sampler' }
}

export const Empty: Story = {
  args: {
    groups: { current: [], today: [], yesterday: [], earlier: [] }
  }
}
