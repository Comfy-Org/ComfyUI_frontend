import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fromPartial } from '@total-typescript/shoehorn'
import { expect } from 'storybook/test'

import { fillNodeAskAgentPrompt } from '@/components/graph/askAgentFromNode'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { FREE_USE_VARIANTS } from '@/workbench/extensions/agent/experiments/freeUsePlacement'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
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

function seedNodeChips(nodes: { id: string; title: string }[], focus = false) {
  const composer = useAgentComposerStore()
  composer.restorePrompt({ text: '', references: [] })
  composer.setNodeScope('story-workflow')
  composer.setNodes(nodes)
  if (focus) composer.requestEditorFocus()
}

export const OneNodeChip: Story = {
  decorators: [
    () => ({
      setup() {
        seedNodeChips([{ id: '5', title: 'KSampler' }])
        return {}
      },
      template: '<story />'
    })
  ]
}

function seedStarterFromNode(options: {
  id: number
  title: string
  text: string
}) {
  const graph = new LGraph()
  const node = new LGraphNode(options.title)
  node.id = toNodeId(options.id)
  graph.add(node)
  useCanvasStore().currentGraph = graph
  useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
    path: 'workflows/portrait.json',
    instanceId: 'story-workflow'
  })
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.isOpen = true
  fillNodeAskAgentPrompt(node.id, options.text)
}

export const StarterPromptFilled: Story = {
  decorators: [
    () => ({
      setup() {
        seedStarterFromNode({
          id: 5,
          title: 'ModelSamplingAuraFlow',
          text: 'Explain this node for me'
        })
        return {}
      },
      template: '<story />'
    })
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox')).toHaveFocus()
  }
}

export const PartnerStarterPromptFilled: Story = {
  decorators: [
    () => ({
      setup() {
        seedStarterFromNode({
          id: 9,
          title: 'ByteDance Seedance 2.5 First-Last-Frame to Video',
          text: 'Enhance the prompt considering the purpose of this workflow'
        })
        return {}
      },
      template: '<story />'
    })
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox')).toHaveFocus()
  }
}

export const MultipleNodeChips: Story = {
  decorators: [
    () => ({
      setup() {
        seedNodeChips([
          { id: '5', title: 'KSampler' },
          { id: '12', title: 'VAE Decode' }
        ])
        return {}
      },
      template: '<story />'
    })
  ]
}

export const FocusedAfterChip: Story = {
  decorators: [
    () => ({
      setup() {
        seedNodeChips([{ id: '5', title: 'KSampler' }], true)
        return {}
      },
      template: '<story />'
    })
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox')).toHaveFocus()
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
