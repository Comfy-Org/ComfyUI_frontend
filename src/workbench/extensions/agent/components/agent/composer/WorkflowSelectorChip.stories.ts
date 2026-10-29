import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ActiveTab } from '@/workbench/extensions/agent/types/activeTab'
import '@/workbench/extensions/agent/agentPanel.css'

import WorkflowSelectorChip from './WorkflowSelectorChip.vue'

const untitled: ActiveTab = {
  path: 'workflows/untitled.json',
  name: 'Untitled workflow',
  isPersisted: false
}

const openTabs: ActiveTab[] = [
  untitled,
  {
    path: 'workflows/api_nano_banana_2_1_t2i.json',
    name: 'api_nano_banana_2_1_t2i',
    modified: true
  },
  {
    path: 'workflows/unsaved-11.json',
    name: 'Unsaved Workflow (11)',
    isPersisted: false
  },
  {
    path: 'workflows/image_krea2_turbo_t2i.json',
    name: 'image_krea2_turbo_t2i',
    modified: true
  }
]

const meta: Meta<typeof WorkflowSelectorChip> = {
  title: 'Agent/Composer/WorkflowSelectorChip',
  component: WorkflowSelectorChip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    activeTab: untitled,
    tabs: openTabs,
    visibleTabPath: untitled.path,
    selectTab: fn(async () => true)
  },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope w-93 rounded-t-lg bg-background p-1"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MenuOpen: Story = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    () => ({
      template:
        '<div class="flex h-140 items-end justify-center bg-secondary px-4 pb-4"><div class="agent-scope w-93 rounded-lg bg-secondary p-1"><div><story /></div></div></div>'
    })
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: enMessages.agent.switchWorkflow })
    )
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByRole('menu')
      ).toBeVisible()
    )
  }
}
