import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, onMounted, onUnmounted, ref } from 'vue'

import type { TurnId } from '../../../schemas/agentApiSchema'
import type {
  AssistantMessage,
  MessagePart
} from '../../../services/agent/agentMessageParts'
import '../../../agentPanel.css'

import AgentMessage from './AgentMessage.vue'

const trace: MessagePart[] = [
  {
    type: 'thinking',
    text: 'Inspecting the graph',
    state: 'done',
    durationMs: 100
  },
  {
    type: 'tool',
    callId: 'c1',
    name: 'load_skill',
    state: 'done',
    ok: true,
    durationMs: 40
  },
  {
    type: 'tool',
    callId: 'c2',
    name: 'list_model_picks',
    state: 'done',
    ok: true,
    durationMs: 600
  },
  {
    type: 'thinking',
    text: 'Picking a checkpoint that matches the prompt',
    state: 'done',
    durationMs: 400
  },
  {
    type: 'tool',
    callId: 'c3',
    name: 'ls_nodes',
    state: 'done',
    ok: true,
    durationMs: 1600
  }
]

function message(parts: MessagePart[], streaming: boolean): AssistantMessage {
  return {
    id: 'msg-0' as TurnId,
    role: 'assistant',
    parts,
    streaming,
    thinking: false
  }
}

const meta: Meta<typeof AgentMessage> = {
  title: 'Agent/AgentMessage',
  component: AgentMessage,
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope bg-agent-surface-raised w-100 p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const StreamingTrace: Story = {
  name: 'DES-778 Every step open while the turn runs',
  args: {
    message: message(
      [
        ...trace,
        { type: 'tool', callId: 'c4', name: 'set_widget', state: 'streaming' }
      ],
      true
    )
  }
}

export const ComposingReply: Story = {
  name: 'DES-778 Between the last call and the first reply token',
  args: { message: message(trace, true) }
}

export const CompletedSummary: Story = {
  name: 'DES-778 Folded into one summary once the reply finishes',
  args: {
    message: message(
      [
        ...trace,
        { type: 'text', text: 'The workflow is ready.', state: 'done' }
      ],
      false
    )
  }
}

export const ThinkingOnly: Story = {
  name: 'DES-778 Thinking-only turn without tool calls',
  args: {
    message: message(
      [
        {
          type: 'thinking',
          text: 'Considering the request. I can answer without changing the graph.',
          state: 'done',
          durationMs: 1400
        },
        { type: 'text', text: 'No graph edits are needed.', state: 'done' }
      ],
      false
    )
  }
}

export const FailedCall: Story = {
  name: 'DES-778 Failed call with an error reply',
  args: {
    message: message(
      [
        ...trace,
        {
          type: 'tool',
          callId: 'c5',
          name: 'set_widget',
          state: 'done',
          ok: false,
          durationMs: 200
        },
        { type: 'text', text: 'I could not set that widget.', state: 'done' }
      ],
      false
    )
  }
}

/**
 * The steps arrive one at a time, the way a turn delivers them. Each row fades
 * in as it lands and the rows already on screen hold still. The other stories
 * mount every row at once, which shows the fade but not this.
 */
const ArrivingTurn = defineComponent({
  components: { AgentMessage },
  setup() {
    const parts = ref<MessagePart[]>([])
    let timer: number | undefined

    const next = () => {
      if (parts.value.length >= trace.length) return
      parts.value = trace.slice(0, parts.value.length + 1)
      timer = window.setTimeout(next, 900)
    }

    const replay = () => {
      window.clearTimeout(timer)
      parts.value = []
      timer = window.setTimeout(next, 300)
    }

    onMounted(replay)
    onUnmounted(() => window.clearTimeout(timer))

    return { parts, replay, message }
  },
  template: `
    <div>
      <button
        class="text-agent-fg-muted border-agent-border mb-3 cursor-pointer rounded-lg border px-2 py-1 text-xs"
        @click="replay"
      >
        Replay
      </button>
      <AgentMessage :message="message(parts, true)" />
    </div>
  `
})

export const StepsArriving: Story = {
  name: 'DES-1032 Each step fades in as it arrives',
  render: () => ({
    components: { ArrivingTurn },
    template: '<ArrivingTurn />'
  })
}
