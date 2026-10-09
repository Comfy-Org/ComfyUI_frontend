import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, within } from 'storybook/test'

import { toTurnId } from '../../schemas/agentApiSchema'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'
import '../../agentPanel.css'

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
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-secondary-background h-screen w-100"><story /></div>'
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

/**
 * DES-1221 / FE-3142. One notice, five arms, and nothing else moves: the
 * starter prompts and the composer placeholder are identical in every cell, so
 * placement is the only variable between them.
 */
export const FreeUseControl: Story = {
  name: 'DES-1221 a / control',
  args: { freeUsePlacement: 'control' }
}

export const FreeUseTopBanner: Story = {
  name: 'DES-1221 b / top banner',
  args: { freeUsePlacement: 'top-banner' }
}

export const FreeUseNearComposer: Story = {
  name: 'DES-1221 c / near composer',
  args: { freeUsePlacement: 'near-composer' }
}

export const FreeUseAboveInput: Story = {
  name: 'DES-1221 d / above input',
  args: { freeUsePlacement: 'above-input' }
}

export const FreeUseInsideInput: Story = {
  name: 'DES-1221 e / inside input',
  args: { freeUsePlacement: 'inside-input' }
}

/**
 * DES-1224. The opening message adapts to what the agent knows about the
 * canvas. a–c have not inspected the workflow; d–e have found a problem in it.
 */
export const GreetingEmptyCanvas: Story = {
  name: 'DES-1224 a / empty canvas',
  args: { userName: 'Jo', greeting: { kind: 'emptyCanvas' } }
}

export const GreetingWorkflowOpen: Story = {
  name: 'DES-1224 b / workflow open, not inspected',
  args: { userName: 'Jo', greeting: { kind: 'workflowOpen' } }
}

export const GreetingFirstOpen: Story = {
  name: 'DES-1224 c / first open',
  args: { userName: 'Jo', greeting: { kind: 'firstOpen' } }
}

const unconnectedInput = {
  kind: 'unconnectedInput',
  node: 'VAE Decode',
  input: 'vae'
} as const

export const GreetingWorkflowAware: Story = {
  name: 'DES-1224 d / workflow-aware',
  args: { userName: 'Jo', greeting: unconnectedInput }
}

export const GreetingWorkflowAwareAsked: Story = {
  name: 'DES-1224 e / workflow-aware, CTA pressed',
  args: { userName: 'Jo', greeting: unconnectedInput },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: 'Ask about this input'
      })
    )
  }
}
