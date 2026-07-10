import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as VueUse from '@vueuse/core'

// Capture the IntersectionObserver callback useIntersectionObserver registers so the test
// can drive the "at bottom" signal directly — happy-dom has no real observer, and the pill
// only shows once the sentinel scrolls out of view.
const intersectionCallbacks = vi.hoisted(
  () => [] as ((entries: { isIntersecting: boolean }[]) => void)[]
)
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof VueUse>()),
  useIntersectionObserver: (
    _target: unknown,
    callback: (entries: { isIntersecting: boolean }[]) => void
  ) => {
    intersectionCallbacks.push(callback)
    return { stop: () => {} }
  }
}))

import { i18n } from '@/i18n'
import type { TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
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
  beforeEach(() => {
    setActivePinia(createPinia())
    intersectionCallbacks.length = 0
  })

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

  it('shows a scroll-to-latest pill when scrolled up and returns to bottom on click', async () => {
    const assistant: AssistantMessage = {
      id: 'msg-1' as TurnId,
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello', state: 'done' }],
      streaming: false,
      thinking: false
    }
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(ConversationView, {
      props: { entries: [assistant] },
      global: { plugins: [i18n] }
    })

    // At bottom initially: no pill.
    expect(screen.queryByText('Latest')).not.toBeInTheDocument()

    // Drive the sentinel out of view -> the pill appears.
    for (const cb of intersectionCallbacks) cb([{ isIntersecting: false }])
    const pill = await screen.findByRole('button', { name: 'Latest' })

    await userEvent.click(pill)
    expect(scrollIntoView).toHaveBeenCalled()
  })
})
