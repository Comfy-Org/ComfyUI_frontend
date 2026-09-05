import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { TurnId } from '../../schemas/agentApiSchema'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import '../../agentPanel.css'

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
        '<div class="agent-scope bg-agent-surface-raised h-120 w-100"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const TransparentScrollbarTrack: Story = {
  name: 'Transparent scrollbar track'
}
