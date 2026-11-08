import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { setBillingContextMock } from '@/storybook/mocks/useBillingContext'
import { setCurrentUserMock } from '@/storybook/mocks/useCurrentUser'

import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import '@/workbench/extensions/agent/agentPanel.css'

import AgentAccountMenu from './AgentAccountMenu.vue'
import AgentSidebar from './AgentSidebar.vue'
import AgentWorkflowList from './AgentWorkflowList.vue'
import type { WorkflowListItem } from './workflowListItem'

const libraryItems: WorkflowListItem[] = [
  { path: 'workflows/Character sheet v2.json', name: 'Character sheet v2' },
  {
    path: 'workflows/upscalers/Portrait upscale.json',
    name: 'Portrait upscale',
    folder: 'upscalers'
  },
  {
    path: 'workflows/video/ads/Product ad draft.json',
    name: 'Product ad draft',
    folder: 'video/ads'
  }
]

const groups: HistoryGroups = {
  current: [
    {
      id: 'thread-current',
      title: 'Character sheet v2',
      updatedAt: 6,
      titleSource: 'server',
      workflowId: 'workflow-sheet'
    }
  ],
  today: [
    {
      id: 'thread-upscale',
      title: 'Portrait upscale',
      updatedAt: 5,
      titleSource: 'server',
      workflowId: 'workflow-upscale'
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
    }
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

const meta: Meta<typeof AgentSidebar> = {
  title: 'Agent/AgentSidebar',
  component: AgentSidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { mode: 'expanded', groups },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope relative flex h-screen bg-background"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Expanded: Story = {}

export const Wide: Story = { args: { width: 400 } }

export const Rail: Story = { args: { mode: 'rail' } }

export const Drawer: Story = { args: { mode: 'drawer' } }

export const WithWorkflowNames: Story = {
  args: {
    activeId: 'thread-current',
    workflowNames: new Map([
      ['workflow-sheet', 'Unsaved Workflow'],
      ['workflow-upscale', 'portrait_upscale_4x']
    ])
  }
}

export const OpeningAChat: Story = { args: { loadingId: 'thread-upscale' } }

export const FailedToOpen: Story = { args: { failedId: 'thread-ad' } }

export const Empty: Story = {
  args: { groups: { current: [], today: [], yesterday: [], earlier: [] } }
}

function withLibrary(args: Story['args']): Story {
  return {
    args,
    render: (storyArgs) => ({
      components: { AgentSidebar, AgentWorkflowList },
      setup: () => ({ storyArgs, libraryItems }),
      template: `
        <AgentSidebar v-bind="storyArgs">
          <template #library="{ section }">
            <AgentWorkflowList :kind="section" :items="libraryItems" />
          </template>
        </AgentSidebar>
      `
    })
  }
}

export const AppsSection: Story = withLibrary({ section: 'apps' })

export const WorkflowsSection: Story = withLibrary({ section: 'workflows' })

export const RailOnASection: Story = withLibrary({
  mode: 'rail',
  section: 'workflows'
})

function withAccountMenu(args: Story['args']): Story {
  return {
    args,
    beforeEach() {
      setCurrentUserMock({})
      setBillingContextMock({
        tier: 'PRO',
        balance: { amountMicros: 588, currency: 'USD' }
      })
      return () => {
        setCurrentUserMock({})
        setBillingContextMock({})
      }
    },
    render: (storyArgs) => ({
      components: { AgentSidebar, AgentAccountMenu },
      setup: () => ({ storyArgs }),
      template: `
        <AgentSidebar v-bind="storyArgs">
          <template #account="{ compact }">
            <AgentAccountMenu :compact />
          </template>
        </AgentSidebar>
      `
    })
  }
}

export const WithAccountMenu: Story = withAccountMenu({})

export const RailWithAccountMenu: Story = withAccountMenu({ mode: 'rail' })
