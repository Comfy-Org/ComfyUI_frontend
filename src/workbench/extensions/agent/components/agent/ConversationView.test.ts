// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
})

import type * as VueUse from '@vueuse/core'

const intersectionCallbacks = vi.hoisted(
  () => [] as ((entries: { isIntersecting: boolean }[]) => void)[]
)
const resizeCallbacks = vi.hoisted(() => [] as (() => void)[])
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof VueUse>()),
  useIntersectionObserver: (
    _target: unknown,
    callback: (entries: { isIntersecting: boolean }[]) => void
  ) => {
    intersectionCallbacks.push(callback)
    return { stop: () => {} }
  },
  useResizeObserver: (_target: unknown, callback: () => void) => {
    resizeCallbacks.push(callback)
    return { stop: () => {} }
  }
}))

import { i18n } from '@/i18n'
import type { TurnId } from '../../schemas/agentApiSchema'
import { toTurnId, zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'

import ConversationView from './ConversationView.vue'

const T = 'msg-1' as TurnId
const chat = (raw: unknown): AgentChatEvent => zAgentWsEvent.parse(raw)
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
    data: {
      tool_call_id: `call-${name}`,
      tool_name: name,
      status,
      message_id: id,
      thread_id: 'th'
    }
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
    Element.prototype.scrollTo = vi.fn()
    intersectionCallbacks.length = 0
    resizeCallbacks.length = 0
  })

  it('wire-driven v1 turn renders user pill, spinner, reasoning-free text, work summary', async () => {
    const { store } = mountHarness()
    store.recordUser(T, 'make a cat')
    store.startTurn(T)

    store.ingest(thinking('msg-1', 'pondering'))
    expect(await screen.findByText('pondering')).toBeInTheDocument()

    store.ingest(delta('msg-1', 'Here is a **cat**'))
    store.ingest(toolCall('msg-1', 'add_node', 'success'))
    store.ingest(done('msg-1'))

    expect(await screen.findByText('make a cat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^worked/i })).toBeInTheDocument()
    expect(screen.getByText('cat', { selector: 'strong' })).toBeInTheDocument()
    expect(store.entries.at(-1)).toMatchObject({
      role: 'assistant',
      streaming: false
    })
  })

  it('follows the reply as each kind of content lands', async () => {
    const settle = async () => {
      await nextTick()
      await nextTick()
    }

    const { store } = mountHarness()
    store.recordUser(T, 'make a cat')
    store.startTurn(T)
    await settle()

    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo

    // a new part
    store.ingest(thinking('msg-1', 'pondering'))
    await settle()
    expect(scrollTo).toHaveBeenCalled()

    // the tail part growing
    scrollTo.mockClear()
    store.ingest(delta('msg-1', 'Here is a cat'))
    await settle()
    expect(scrollTo).toHaveBeenCalled()

    // a tool call starting
    scrollTo.mockClear()
    store.ingest(toolCall('msg-1', 'add_node', 'running'))
    await settle()
    expect(scrollTo).toHaveBeenCalled()

    // the same tool call settling
    scrollTo.mockClear()
    store.ingest(toolCall('msg-1', 'add_node', 'success'))
    await settle()
    expect(scrollTo).toHaveBeenCalled()

    // a tool call settling behind a text tail
    store.ingest(toolCall('msg-1', 'ls_nodes', 'running'))
    store.ingest(delta('msg-1', 'Checking the graph'))
    await settle()
    scrollTo.mockClear()
    store.ingest(toolCall('msg-1', 'ls_nodes', 'success'))
    await settle()
    expect(scrollTo).toHaveBeenCalled()

    // the turn settling with a text tail
    store.ingest(delta('msg-1', 'Done.'))
    await settle()
    scrollTo.mockClear()
    store.ingest(done('msg-1'))
    await settle()
    expect(scrollTo).toHaveBeenCalled()
  })

  it('starts a restored conversation at the latest message', async () => {
    const assistant: AssistantMessage = {
      id: toTurnId('msg-1'),
      role: 'assistant',
      parts: [{ type: 'text', text: 'latest reply', state: 'done' }],
      streaming: false,
      thinking: false
    }
    render(ConversationView, {
      props: { entries: [assistant] },
      global: { plugins: [i18n] }
    })
    const scrollContainer = screen.getByTestId('agent-conversation-scroll')
    Object.defineProperties(scrollContainer, {
      scrollTo: { value: undefined },
      scrollHeight: { value: 512 },
      scrollTop: { value: 0, writable: true }
    })
    await nextTick()

    expect(scrollContainer.scrollTop).toBe(512)
  })

  it('does not follow new content after the user scrolls up', async () => {
    const { store } = mountHarness()
    store.recordUser(T, 'make a cat')
    store.startTurn(T)
    await nextTick()
    await nextTick()

    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    const scrollContainer = screen.getByTestId('agent-conversation-scroll')
    let scrollHeight = 1_000
    let scrollTop = 100
    Object.defineProperties(scrollContainer, {
      scrollHeight: { get: () => scrollHeight },
      scrollTop: { get: () => scrollTop },
      clientHeight: { value: 500 }
    })
    await nextTick()
    for (const callback of resizeCallbacks) callback()
    for (const callback of resizeCallbacks) callback()
    scrollHeight = 1_200
    scrollTop = 490
    await userEvent.pointer([{ target: scrollContainer, keys: '[MouseLeft>]' }])
    await fireEvent.scroll(scrollContainer)
    scrollTo.mockClear()
    for (const callback of resizeCallbacks) callback()

    store.ingest(delta('msg-1', 'Here is a cat'))
    await nextTick()
    await nextTick()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('shows a scroll-to-latest button when scrolled up and returns to bottom on click', async () => {
    const assistant: AssistantMessage = {
      id: toTurnId('msg-1'),
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello', state: 'done' }],
      streaming: false,
      thinking: false
    }
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo

    const { rerender } = render(ConversationView, {
      props: { entries: [assistant] },
      global: { plugins: [i18n] }
    })

    expect(
      screen.queryByRole('button', { name: 'Latest' })
    ).not.toBeInTheDocument()

    const scrollContainer = screen.getByTestId('agent-conversation-scroll')
    Object.defineProperties(scrollContainer, {
      scrollHeight: { value: 1_000 },
      scrollTop: { value: 100 },
      clientHeight: { value: 500 }
    })
    await nextTick()
    await fireEvent.scroll(scrollContainer)
    const jump = await screen.findByRole('button', { name: 'Latest' })
    expect(jump).toHaveTextContent('')

    await userEvent.click(jump)
    expect(scrollTo).toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Latest' })
    ).not.toBeInTheDocument()

    scrollTo.mockClear()
    await rerender({
      entries: [
        {
          ...assistant,
          parts: [{ type: 'text', text: 'hello again', state: 'done' }]
        }
      ]
    })
    await nextTick()
    expect(scrollTo).toHaveBeenCalled()
  })

  it('resumes following when the conversation identity changes', async () => {
    const assistant: AssistantMessage = {
      id: toTurnId('msg-1'),
      role: 'assistant',
      parts: [{ type: 'text', text: 'first thread', state: 'done' }],
      streaming: false,
      thinking: false
    }
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    const { rerender } = render(ConversationView, {
      props: { entries: [assistant], conversationId: 'thread-1' },
      global: { plugins: [i18n] }
    })

    const scrollContainer = screen.getByTestId('agent-conversation-scroll')
    Object.defineProperties(scrollContainer, {
      scrollHeight: { value: 1_000 },
      scrollTop: { value: 100 },
      clientHeight: { value: 500 }
    })
    await nextTick()
    await fireEvent.scroll(scrollContainer)
    expect(
      await screen.findByRole('button', { name: 'Latest' })
    ).toBeInTheDocument()

    scrollTo.mockClear()
    await rerender({
      conversationId: 'thread-2',
      entries: [assistant]
    })
    await userEvent.pointer([{ target: scrollContainer, keys: '[MouseLeft>]' }])
    await fireEvent.scroll(scrollContainer)
    await rerender({
      conversationId: 'thread-2',
      entries: [
        {
          ...assistant,
          id: toTurnId('msg-2'),
          parts: [{ type: 'text', text: 'other thread', state: 'done' }]
        }
      ]
    })
    await nextTick()
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Latest' })
    ).not.toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalled()
  })

  it.for([
    { distance: 16, follows: true },
    { distance: 17, follows: false }
  ])(
    'measures the bottom tolerance at $distance px',
    async ({ distance, follows }) => {
      const assistant: AssistantMessage = {
        id: toTurnId('msg-1'),
        role: 'assistant',
        parts: [{ type: 'text', text: 'hello', state: 'done' }],
        streaming: false,
        thinking: false
      }
      const scrollTo = vi.fn()
      Element.prototype.scrollTo = scrollTo
      const { rerender } = render(ConversationView, {
        props: { entries: [assistant] },
        global: { plugins: [i18n] }
      })
      const scrollContainer = screen.getByTestId('agent-conversation-scroll')
      Object.defineProperties(scrollContainer, {
        scrollHeight: { value: 1_000 },
        scrollTop: { value: 500 - distance },
        clientHeight: { value: 500 }
      })
      await nextTick()
      await userEvent.pointer([
        { target: scrollContainer, keys: '[MouseLeft>]' }
      ])
      await fireEvent.scroll(scrollContainer)

      scrollTo.mockClear()
      await rerender({
        entries: [
          {
            ...assistant,
            parts: [{ type: 'text', text: 'hello again', state: 'done' }]
          }
        ]
      })
      await nextTick()

      expect(Boolean(screen.queryByRole('button', { name: 'Latest' }))).toBe(
        !follows
      )
      expect(scrollTo).toHaveBeenCalledTimes(follows ? 1 : 0)
    }
  )

  it('fades only the edges where content continues past the view', async () => {
    const assistant: AssistantMessage = {
      id: 'msg-1' as TurnId,
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello', state: 'done' }],
      streaming: false,
      thinking: false
    }

    const { container } = render(ConversationView, {
      props: { entries: [assistant] },
      global: { plugins: [i18n] }
    })

    // eslint-disable-next-line testing-library/no-node-access -- scroll container has no queryable role; mask classes are the behavior under test
    const scroll = container.firstElementChild?.firstElementChild as HTMLElement
    const topMask = 'mask-t-from-[calc(100%-2rem)]'
    const bottomMask = 'mask-b-from-[calc(100%-2rem)]'

    const [fireTop] = intersectionCallbacks

    expect(scroll.classList.contains(topMask)).toBe(false)
    expect(scroll.classList.contains(bottomMask)).toBe(false)

    fireTop([{ isIntersecting: false }])
    await nextTick()
    expect(scroll.classList.contains(topMask)).toBe(true)
    expect(scroll.classList.contains(bottomMask)).toBe(false)

    fireTop([{ isIntersecting: true }])
    await nextTick()
    expect(scroll.classList.contains(topMask)).toBe(false)

    Object.defineProperties(scroll, {
      scrollHeight: { value: 1_000 },
      scrollTop: { value: 100 },
      clientHeight: { value: 500 }
    })
    await fireEvent.scroll(scroll)
    expect(scroll.classList.contains(bottomMask)).toBe(true)
    expect(scroll.classList.contains(topMask)).toBe(false)
  })
})
