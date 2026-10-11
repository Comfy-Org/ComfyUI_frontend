import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { FREE_USE_PLACEMENTS } from '../../experiments/freeUsePlacement'
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
  argTypes: {
    freeUsePlacement: { control: 'select', options: FREE_USE_PLACEMENTS }
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
 * placement is the only variable between them. Side-by-side is the point here
 * — the question the design asks is which cell reads best against the others —
 * so this stays a grid while `freeUsePlacement` is also a Controls option for
 * walking one arm at a time.
 */
export const FreeUsePlacements: Story = {
  name: 'DES-1221 a–e / placement arms',
  render: (args) => ({
    components: { AgentPanel },
    setup() {
      return { placements: FREE_USE_PLACEMENTS, args }
    },
    template: `
      <div class="flex h-screen gap-4 overflow-x-auto">
        <div v-for="placement in placements" :key="placement" class="shrink-0">
          <div class="px-2 py-1 text-xs text-muted-foreground">{{ placement }}</div>
          <div class="agent-scope bg-secondary-background h-full w-100">
            <AgentPanel v-bind="args" :free-use-placement="placement" />
          </div>
        </div>
      </div>
    `
  }),
  decorators: [() => ({ template: '<story />' })]
}
