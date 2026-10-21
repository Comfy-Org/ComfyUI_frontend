import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { FREE_USE_VARIANTS } from '@/workbench/extensions/agent/experiments/freeUsePlacement'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import '@/workbench/extensions/agent/agentPanel.css'

import AgentPanel from './AgentPanel.vue'

const emptyHistory: HistoryGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

const meta: Meta<typeof AgentPanel> = {
  title: 'Agent/AgentPanel',
  component: AgentPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    entries: [],
    historyGroups: emptyHistory,
    userName: 'Comfy user',
    activeTab: { path: 'workflows/portrait.json', name: 'portrait' },
    workflowTabs: [{ path: 'workflows/portrait.json', name: 'portrait' }]
  },
  argTypes: {
    freeUsePlacement: { control: 'select', options: FREE_USE_VARIANTS }
  },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-secondary h-screen w-100"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const PanelSpacing: Story = {
  name: 'T-26 / PM-670 / FE-1324 Panel spacing'
}

export const WithHistory: Story = {
  args: {
    sessionId: 'portrait',
    historyGroups: {
      current: [
        {
          id: 'portrait',
          title: 'Portrait lighting',
          updatedAt: 0,
          titleSource: 'server'
        }
      ],
      today: [
        {
          id: 'upscale',
          title: 'Upscale a product photo',
          updatedAt: 0,
          titleSource: 'server'
        }
      ],
      yesterday: [],
      earlier: []
    }
  }
}

export const InDialog: Story = {
  args: WithHistory.args,
  render: (args) => ({
    components: {
      AgentPanel,
      Dialog,
      DialogContent,
      DialogOverlay,
      DialogPortal,
      DialogTitle
    },
    setup() {
      const open = ref(true)
      return { args, open }
    },
    template: `
      <Dialog v-model:open="open">
        <DialogPortal>
          <DialogOverlay />
          <DialogContent class="h-180 overflow-hidden p-0">
            <DialogTitle class="sr-only">Agent</DialogTitle>
            <AgentPanel v-bind="args" />
          </DialogContent>
        </DialogPortal>
      </Dialog>
    `
  })
}

export const LongWorkflowList: Story = {
  args: {
    availableWorkflows: Array.from({ length: 30 }, (_, index) => ({
      id: `workflow-${index + 1}`,
      name: `Workflow ${String(index + 1).padStart(2, '0')}`
    }))
  },
  play: async () => {
    const body = within(document.body)
    await userEvent.click(body.getByRole('button', { name: 'Add to prompt' }))
    await userEvent.click(body.getByRole('menuitem', { name: 'Workflows' }))
    const lastWorkflow = await body.findByRole('menuitem', {
      name: 'Workflow 30'
    })
    const workflowMenu = body.getByRole('menu', { name: 'Workflows' })

    lastWorkflow.scrollIntoView({ block: 'nearest' })

    await expect(workflowMenu.scrollHeight).toBeGreaterThan(
      workflowMenu.clientHeight
    )
    await expect(workflowMenu.scrollTop).toBeGreaterThan(0)
    const lastWorkflowRect = lastWorkflow.getBoundingClientRect()
    await expect(lastWorkflowRect.top).toBeGreaterThanOrEqual(10)
    await expect(lastWorkflowRect.bottom).toBeLessThanOrEqual(
      window.innerHeight - 10
    )
  }
}

export const ChipStates: Story = {
  args: {
    selectionTags: [
      {
        id: '12',
        title: 'A selected node with a long descriptive title'
      }
    ],
    entries: [
      {
        id: toTurnId('chip-states'),
        role: 'user',
        text: 'Compare  with .',
        tags: ['A referenced node with a long descriptive title'],
        workflowReferences: [
          {
            id: 'available-workflow',
            name: 'Available portrait workflow with a long name',
            textOffset: 8
          },
          {
            id: 'missing-workflow',
            name: 'Unavailable workflow',
            unavailable: true,
            textOffset: 14
          }
        ]
      }
    ]
  }
}

export const FreeUsePlacements: Story = {
  name: 'DES-1221 a–e / placement arms',
  render: (args) => ({
    components: { AgentPanel },
    setup() {
      return { placements: FREE_USE_VARIANTS, args }
    },
    template: `
      <div class="flex h-screen gap-4 overflow-x-auto">
        <div v-for="placement in placements" :key="placement" class="shrink-0">
          <div class="px-2 py-1 text-xs text-muted-foreground">{{ placement }}</div>
          <div class="agent-scope bg-secondary h-full w-100">
            <AgentPanel v-bind="args" :free-use-placement="placement" />
          </div>
        </div>
      </div>
    `
  }),
  decorators: [() => ({ template: '<story />' })]
}
