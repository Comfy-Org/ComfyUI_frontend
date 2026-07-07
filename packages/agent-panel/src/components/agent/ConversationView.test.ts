import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '../../i18n'
import type { TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import type {
  AssistantMessage,
  FilePart,
  ReasoningPart
} from '../../services/agent/agentMessageParts'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'

import ConversationView from './ConversationView.vue'

const T = 'msg-1' as TurnId
const chat = (raw: unknown): AgentChatEvent =>
  zAgentWsEvent.parse(raw) as AgentChatEvent
const thinking = (id: string, delta: string) =>
  chat({
    type: 'agent_thinking',
    data: { delta, message_id: id, thread_id: 'th' }
  })
const delta = (id: string, text: string) =>
  chat({
    type: 'agent_message_delta',
    data: { delta: text, message_id: id, thread_id: 'th' }
  })
const toolCall = (id: string, name: string, status: string) =>
  chat({
    type: 'agent_tool_call',
    data: { tool_name: name, status, args: [], message_id: id, thread_id: 'th' }
  })
const done = (id: string) =>
  chat({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage: null }
  })

const Harness = defineComponent({
  components: { ConversationView },
  setup() {
    const store = useAgentConversationStore()
    return { store }
  },
  template: `<ConversationView :entries="store.entries" user-name="Ada" />`
})

function mountHarness() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const utils = render(Harness, { global: { plugins: [pinia, i18n] } })
  return { store: useAgentConversationStore(), ...utils }
}

describe('ConversationView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('wire-driven v1 turn renders user pill, spinner, reasoning-free text, tool group', async () => {
    const { store } = mountHarness()
    store.recordUser(T, 'make a cat')
    store.startTurn(T)

    store.ingest(thinking('msg-1', 'pondering'))
    // The thinking chip shows before any text streams.
    expect(await screen.findByText('Thinking...')).toBeInTheDocument()

    store.ingest(delta('msg-1', 'Here is a **cat**'))
    store.ingest(toolCall('msg-1', 'add_node', 'ok'))
    store.ingest(done('msg-1'))

    expect(await screen.findByText('make a cat')).toBeInTheDocument()
    expect(screen.getByText('Ran 1 tool call')).toBeInTheDocument()
    // The markdown bold survives sanitization as a real <strong> element.
    expect(screen.getByText('cat', { selector: 'strong' })).toBeInTheDocument()
    expect(store.entries.at(-1)).toMatchObject({
      role: 'assistant',
      streaming: false
    })
  })

  it('renders parts-driven surfaces without a wire source', async () => {
    // These surfaces have no v1 wire event yet: thinking is transient (agent_thinking
    // never persists a ReasoningPart) and assets arrive via the host run path, not the
    // chat socket. The components must still render them from a hand-built parts list.
    const reasoning: ReasoningPart = {
      type: 'reasoning',
      text: 'pondering',
      state: 'done'
    }
    const file: FilePart = {
      type: 'file',
      mediaType: 'image',
      url: 'https://x/cat.png',
      filename: 'cat.png'
    }
    const assistant: AssistantMessage = {
      id: 'msg-1' as TurnId,
      role: 'assistant',
      parts: [reasoning, file],
      tokens: 0,
      streaming: false,
      thinking: false
    }
    const entries: ConversationEntry[] = [assistant]

    render(ConversationView, {
      props: { entries, userName: 'Ada' },
      global: { plugins: [i18n] }
    })

    expect(await screen.findByText('Reasoning')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://x/cat.png')
  })
})
