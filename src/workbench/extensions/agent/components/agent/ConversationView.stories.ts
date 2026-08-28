import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { TurnId } from '../../schemas/agentApiSchema'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'

import ConversationView from './ConversationView.vue'

const entries: ConversationEntry[] = Array.from({ length: 12 }, (_, index) => ({
  id: `visual-user-${index}` as TurnId,
  role: 'user',
  text: `Long conversation prompt ${index + 1}`
}))

const meta: Meta<typeof ConversationView> = {
  title: 'Agent/Linear UX/ConversationView',
  component: ConversationView,
  parameters: { layout: 'padded' },
  args: { entries },
  decorators: [
    () => ({
      template:
        '<div class="bg-agent-surface-raised h-[480px] w-[400px]"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

/** T-28 / PM-677 / FE-1320: long chat has no scrollbar track background. */
export const T28TransparentScrollbarTrack: Story = {}
