import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { TurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import '@/workbench/extensions/agent/agentPanel.css'

import ConversationView from './ConversationView.vue'

const entries: ConversationEntry[] = Array.from({ length: 12 }, (_, index) => ({
  id: `visual-user-${index}` as TurnId,
  role: 'user',
  text: `Long conversation prompt ${index + 1}`
}))

const meta: Meta<typeof ConversationView> = {
  title: 'Agent/ConversationView',
  component: ConversationView,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { entries },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-secondary h-120 w-100"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const TransparentScrollbarTrack: Story = {
  name: 'T-28 / PM-677 / FE-1320 Transparent scrollbar track'
}
