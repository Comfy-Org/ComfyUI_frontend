import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '@/workbench/extensions/agent/agentPanel.css'

import AgentWorkflowList from './AgentWorkflowList.vue'
import type { WorkflowListItem } from './workflowListItem'

const items: WorkflowListItem[] = [
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
  },
  {
    path: 'workflows/video/Turn the storyboard frames into a short looping video.json',
    name: 'Turn the storyboard frames into a short looping video',
    folder: 'video'
  }
]

const manyItems: WorkflowListItem[] = Array.from(
  { length: 60 },
  (_, index) => ({
    path: `workflows/batches/Batch upscale ${index + 1}.json`,
    name: `Batch upscale ${index + 1}`,
    folder: 'batches'
  })
)

const meta: Meta<typeof AgentWorkflowList> = {
  title: 'Agent/AgentWorkflowList',
  component: AgentWorkflowList,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { kind: 'workflows', items },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex h-screen w-65 flex-col bg-background pt-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Workflows: Story = {}

export const Apps: Story = { args: { kind: 'apps' } }

export const Loading: Story = { args: { loading: true } }

export const LoadingFirstTime: Story = { args: { items: [], loading: true } }

export const OpeningAWorkflow: Story = {
  args: { openingPath: 'workflows/upscalers/Portrait upscale.json' }
}

export const FailedToOpen: Story = {
  args: { failedPath: 'workflows/video/ads/Product ad draft.json' }
}

export const NoWorkflows: Story = { args: { items: [] } }

export const NoApps: Story = { args: { kind: 'apps', items: [] } }

export const MoreThanOnePage: Story = { args: { items: manyItems } }
