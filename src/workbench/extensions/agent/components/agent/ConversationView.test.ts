import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useIntersectionObserver, useResizeObserver } from '@vueuse/core'

const intersectionCallbacks = vi.hoisted(
  () => [] as ((entries: { isIntersecting: boolean }[]) => void)[]
)
const resizeCallbacks = vi.hoisted(() => [] as (() => void)[])
vi.mock(import('@vueuse/core'), { spy: true })
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mocked(useIntersectionObserver).mockImplementation((_target, callback) => {
  intersectionCallbacks.push((entries) =>
    callback(
      entries.map((entry) => fromPartial(entry)),
      fromPartial({})
    )
  )
  return fromPartial({ stop: vi.fn() })
})
vi.mocked(useResizeObserver).mockImplementation((_target, callback) => {
  resizeCallbacks.push(() => callback([], fromPartial({})))
  return fromPartial({ stop: vi.fn() })
})

import { i18n } from '@/i18n'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { listSkillPacks } from '@/platform/skills/api/skillsApi'
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))
import { toTurnId, zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentMessages } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'

import ConversationView from './ConversationView.vue'

const T = toTurnId('msg-1')
const assistantMessage = (
  overrides: Partial<AssistantMessage> = {}
): AssistantMessage => ({
  id: toTurnId('msg-1'),
  role: 'assistant',
  parts: [{ type: 'text', text: 'hello', state: 'done' }],
  streaming: false,
  thinking: false,
  ...overrides
})
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

const PORTRAIT_SKILL_LINK =
  '[Use the saved skill /portrait](skill://portrait?description=Original)'
const skillHistoryRow = (
  id: string,
  turnId: string
): AgentMessages[number] => ({
  id,
  thread_id: 'th',
  seq: 1,
  turn_id: turnId,
  status: 'complete',
  role: 'user',
  content: { text: `${PORTRAIT_SKILL_LINK} render it` }
})

const Harness = defineComponent({
  components: { ConversationView },
  setup() {
    const store = useAgentConversationStore()
    return { store }
  },
  template: `<ConversationView
    :entries="store.entries"
    :conversation-id="store.threadId"
    user-name="Ada"
  />`
})

function mountHarness() {
  const pinia = getActivePinia()!
  const utils = render(Harness, { global: { plugins: [pinia, i18n] } })
  return { store: useAgentConversationStore(), ...utils }
}

function dispatchResize(): void {
  resizeCallbacks.forEach((callback) => callback())
}

describe('ConversationView', () => {
  beforeEach(() => {
    vi.mocked(useIntersectionObserver).mockImplementation(
      (_target, callback) => {
        intersectionCallbacks.push((entries) =>
          callback(
            entries.map((entry) => fromPartial(entry)),
            fromPartial({})
          )
        )
        return fromPartial({ stop: vi.fn() })
      }
    )
    vi.mocked(useResizeObserver).mockImplementation((_target, callback) => {
      resizeCallbacks.push(() => callback([], fromPartial({})))
      return fromPartial({ stop: vi.fn() })
    })
    Element.prototype.scrollTo = vi.fn()
    intersectionCallbacks.length = 0
    resizeCallbacks.length = 0
  })

  it('refreshes saved skills once each time a conversation with skills opens, and again on scope change', async () => {
    const skills = useSkillPacksStore()
    skills.flagsEnabled = true
    vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
    vi.mocked(listSkillPacks).mockResolvedValue([])
    const { store } = mountHarness()
    store.setThreadId('first')
    store.hydrate([
      skillHistoryRow('row-1', 'turn-1'),
      skillHistoryRow('row-2', 'turn-2')
    ])
    expect(await screen.findAllByTestId('skill-reference')).toHaveLength(2)
    await waitFor(() => expect(skills.catalogConfirmed).toBe(true))
    expect(listSkillPacks).toHaveBeenCalledOnce()
    store.setThreadId('second')
    store.hydrate([skillHistoryRow('row-3', 'turn-3')])
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledTimes(2))
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'new-workspace' })
    await waitFor(() => expect(skills.catalogConfirmed).toBe(true))
    expect(listSkillPacks).toHaveBeenCalledTimes(3)
  })

  it.for<{
    conversation: string
    open: (store: ReturnType<typeof useAgentConversationStore>) => void
  }>([
    { conversation: 'a new conversation', open: () => {} },
    {
      conversation: 'a new conversation after one with skills',
      open: (store) => {
        store.hydrate([skillHistoryRow('row-1', 'turn-1')])
        store.reset()
      }
    },
    {
      conversation: 'a loaded conversation without skills',
      open: (store) =>
        store.hydrate([
          {
            id: 'row-1',
            thread_id: 'th',
            seq: 1,
            turn_id: 'turn-1',
            status: 'complete',
            role: 'user',
            content: { text: 'plain prompt' }
          }
        ])
    }
  ])(
    'leaves the refresh for a live turn that first uses a skill in $conversation to the session',
    async ({ open }) => {
      const skills = useSkillPacksStore()
      skills.flagsEnabled = true
      vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
      vi.mocked(listSkillPacks).mockResolvedValue([])
      open(useAgentConversationStore())
      const { store } = mountHarness()
      store.recordUser(T, `${PORTRAIT_SKILL_LINK} render it`)
      store.startTurn(T)
      store.ingest(done('msg-1'))
      expect(await screen.findByTestId('skill-reference')).toBeInTheDocument()
      await nextTick()
      expect(listSkillPacks).not.toHaveBeenCalled()
    }
  )

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

  describe('completed trace toggles', () => {
    beforeEach(() => {
      const readStyle = globalThis.getComputedStyle
      vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
        (element, pseudo) => {
          const style = readStyle(element, pseudo)
          if (
            !(element instanceof HTMLElement) ||
            !element.classList.contains('agent-work-summary')
          )
            return style
          const animationName =
            element.dataset.state === 'open'
              ? 'agent-collapsible-down'
              : 'agent-collapsible-up'
          return new Proxy(style, {
            get: (target, key) =>
              key === 'animationName' ? animationName : Reflect.get(target, key)
          })
        }
      )
    })

    async function mountCompletedTurnAtEnd({
      content = 1_000,
      scrollTop = 500,
      turns = 1
    } = {}) {
      const { store } = mountHarness()
      for (let turn = 1; turn <= turns; turn++) {
        const id = `msg-${turn}`
        store.recordUser(toTurnId(id), 'make a cat')
        store.startTurn(toTurnId(id))
        store.ingest(thinking(id, 'pondering'))
        store.ingest(delta(id, 'Here is a cat'))
        store.ingest(done(id))
      }
      await nextTick()
      await nextTick()
      const scroll = screen.getByTestId('agent-conversation-scroll')
      const geometry = { content, trace: 0, viewport: 500 }
      Object.defineProperties(scroll, {
        scrollHeight: {
          get: () =>
            Math.max(
              geometry.viewport,
              geometry.content +
                (screen.queryAllByRole('list').length ? geometry.trace : 0)
            )
        },
        scrollTop: { value: scrollTop, writable: true },
        clientHeight: { get: () => geometry.viewport }
      })
      const scrollTo = vi.spyOn(Element.prototype, 'scrollTo')
      dispatchResize()
      scrollTo.mockClear()
      const summaries = screen.getAllByRole('button', { name: /^worked/i })
      return { store, scroll, geometry, scrollTo, summary: summaries[0] }
    }

    async function toggleTrace(summary: HTMLElement, expanded: boolean) {
      await userEvent.click(summary)
      await nextTick()
      expect(summary).toHaveAttribute('aria-expanded', String(expanded))
    }

    async function finishAnimation(
      animationName: 'agent-collapsible-down' | 'agent-collapsible-up',
      index = 0
    ) {
      const trace = screen.getAllByTestId('agent-work-trace')[index]
      await fireEvent.animationEnd(trace, { animationName })
      await nextTick()
    }

    async function startNextTurn(
      store: ReturnType<typeof useAgentConversationStore>
    ) {
      const next = toTurnId('msg-next')
      store.recordUser(next, 'make another cat')
      store.startTurn(next)
      store.ingest(delta('msg-next', 'More content'))
      await nextTick()
      await nextTick()
      expect(screen.getByText('More content')).toBeInTheDocument()
    }

    it('does not scroll when a trace expands or collapses at the end', async () => {
      const { scroll, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()

      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()
      await toggleTrace(summary, false)
      geometry.trace = 0
      dispatchResize()
      await nextTick()

      expect(scrollTo).not.toHaveBeenCalled()
      expect(scroll.scrollTop).toBe(500)
    })

    it('does not follow new content while a toggled trace is still opening', async () => {
      const { store, scroll, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)

      await startNextTurn(store)

      expect(scrollTo).not.toHaveBeenCalled()
      expect(scroll.scrollTop).toBe(500)
    })

    it('keeps new content below the fold after a trace opens away from the end', async () => {
      const { store, scroll, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()
      await finishAnimation('agent-collapsible-down')

      await startNextTurn(store)
      geometry.content = 1_200
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
      expect(scroll.scrollTop).toBe(500)
      await userEvent.click(screen.getByRole('button', { name: 'Latest' }))
      expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'instant' })
    })

    it('follows the next turn once a collapse leaves the reader at the end', async () => {
      const { store, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()
      await finishAnimation('agent-collapsible-down')
      expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
      await toggleTrace(summary, false)
      geometry.trace = 0
      dispatchResize()

      geometry.trace = 200
      await finishAnimation('agent-collapsible-up')
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      await startNextTurn(store)

      expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'instant' })
    })

    it('keeps the view in place when a collapsing trace re-opens', async () => {
      const { scroll, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()
      await finishAnimation('agent-collapsible-down')
      await fireEvent.wheel(scroll)
      scroll.scrollTop = 700
      await fireEvent.scroll(scroll)
      await toggleTrace(summary, false)
      geometry.trace = 100
      scroll.scrollTop = 600
      await fireEvent.scroll(scroll)
      dispatchResize()
      scrollTo.mockClear()

      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()

      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(scrollTo).not.toHaveBeenCalled()
      expect(scroll.scrollTop).toBe(600)
      await finishAnimation('agent-collapsible-down')
      expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
    })

    it('follows new content once an opened trace settles in a conversation that fits', async () => {
      const { store, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd({ content: 400, scrollTop: 0 })
      await toggleTrace(summary, true)
      geometry.trace = 80
      dispatchResize()
      await finishAnimation('agent-collapsible-down')

      await startNextTurn(store)
      geometry.content = 700
      dispatchResize()

      expect(scrollTo).toHaveBeenLastCalledWith({
        top: 280,
        behavior: 'instant'
      })
    })

    it('follows the next turn when an opened trace settles within the bottom grace', async () => {
      const { store, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      geometry.trace = 8
      dispatchResize()
      await finishAnimation('agent-collapsible-down')

      await startNextTurn(store)

      expect(scrollTo).toHaveBeenCalledWith({ top: 508, behavior: 'instant' })
    })

    it.for([
      { resize: 'shrinks', viewport: 300, content: 400, top: 180 },
      { resize: 'grows', viewport: 700, content: 900, top: 280 }
    ])(
      'follows new content when the viewport $resize after an opened trace settles at the end',
      async ({ viewport, content, top }) => {
        const { geometry, scrollTo, summary } = await mountCompletedTurnAtEnd({
          content: 400,
          scrollTop: 0
        })
        await toggleTrace(summary, true)
        geometry.trace = 80
        dispatchResize()
        await finishAnimation('agent-collapsible-down')

        geometry.viewport = viewport
        dispatchResize()
        geometry.content = content
        dispatchResize()

        expect(scrollTo).toHaveBeenLastCalledWith({ top, behavior: 'instant' })
      }
    )

    it('does not treat an animation inside the trace as the trace settling', async () => {
      const { store, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd({ content: 400, scrollTop: 0 })
      await toggleTrace(summary, true)
      geometry.trace = 80
      dispatchResize()

      await fireEvent.animationEnd(screen.getByRole('list'), {
        animationName: 'agent-row-enter'
      })
      await startNextTurn(store)
      geometry.content = 700
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('keeps following paused until the last toggled trace settles', async () => {
      const { geometry, scrollTo } = await mountCompletedTurnAtEnd({
        content: 400,
        scrollTop: 0,
        turns: 2
      })
      const [first, second] = screen.getAllByRole('button', {
        name: /^worked/i
      })
      await toggleTrace(first, true)
      await toggleTrace(second, true)
      geometry.trace = 80
      dispatchResize()

      await finishAnimation('agent-collapsible-down', 0)
      geometry.trace = 300
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
      await finishAnimation('agent-collapsible-down', 1)
      expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
    })

    it.for([
      {
        conversation: 'a conversation that scrolls',
        content: 1_000,
        scrollTop: 500
      },
      { conversation: 'a conversation that fits', content: 500, scrollTop: 0 }
    ])(
      'hides Latest while a toggled trace leaves the reader at the end of $conversation',
      async ({ content, scrollTop }) => {
        const { summary } = await mountCompletedTurnAtEnd({
          content,
          scrollTop
        })

        await toggleTrace(summary, true)
        dispatchResize()
        await nextTick()

        expect(
          screen.queryByRole('button', { name: 'Latest' })
        ).not.toBeInTheDocument()
      }
    )

    it('keeps the view in place when a trace opens a conversation that fits past the panel', async () => {
      const { scroll, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd({ content: 500, scrollTop: 0 })

      await toggleTrace(summary, true)
      dispatchResize()
      geometry.trace = 300
      dispatchResize()
      await finishAnimation('agent-collapsible-down')

      expect(scrollTo).not.toHaveBeenCalled()
      expect(scroll.scrollTop).toBe(0)
      expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
    })

    it('keeps following paused when an automatic scroll lands just after the toggle', async () => {
      const { store, scroll, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      const user = userEvent.setup()
      await user.pointer({ keys: '[MouseLeft>]', target: summary })
      geometry.content = 1_100
      dispatchResize()
      expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: 'instant' })
      scroll.scrollTop = 600
      await user.pointer({ keys: '[/MouseLeft]', target: summary })
      expect(summary).toHaveAttribute('aria-expanded', 'true')
      await fireEvent.scroll(scroll)
      scrollTo.mockClear()

      await startNextTurn(store)
      geometry.trace = 200
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
      expect(scroll.scrollTop).toBe(600)
    })

    it('keeps the view in place when new content arrives while a trace opens a conversation that fits', async () => {
      const { store, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd({ content: 400, scrollTop: 0 })
      await toggleTrace(summary, true)
      geometry.trace = 80
      dispatchResize()

      await startNextTurn(store)
      geometry.content = 720
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('keeps following paused while the Worked trigger is pressed at the end', async () => {
      const { geometry, scrollTo, summary } = await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      const user = userEvent.setup()

      await user.pointer({ keys: '[MouseLeft>]', target: summary })
      geometry.trace = 200
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('clears a trace pause when the conversation is emptied', async () => {
      const { store, geometry, summary } = await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()
      await nextTick()
      expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()

      store.reset()
      await nextTick()
      await nextTick()

      expect(
        screen.queryByRole('button', { name: 'Latest' })
      ).not.toBeInTheDocument()
    })

    it.for(['wheel', 'touchstart', 'keydown', 'pointerdown'])(
      'follows again when %s happens at the end after a toggle',
      async (type) => {
        const { scroll, geometry, scrollTo, summary } =
          await mountCompletedTurnAtEnd()
        await toggleTrace(summary, true)

        scroll.dispatchEvent(new Event(type))
        geometry.trace = 200
        dispatchResize()

        expect(scrollTo).toHaveBeenCalledWith({ top: 700, behavior: 'instant' })
      }
    )

    it('keeps reading when input happens away from the end after a toggle', async () => {
      const { scroll, geometry, scrollTo, summary } =
        await mountCompletedTurnAtEnd()
      await toggleTrace(summary, true)
      geometry.trace = 200
      dispatchResize()

      await fireEvent.wheel(scroll)
      geometry.content = 1_200
      dispatchResize()

      expect(scrollTo).not.toHaveBeenCalled()
      scroll.scrollTop = 900
      await fireEvent.scroll(scroll)
      geometry.content = 1_400
      dispatchResize()
      expect(scrollTo).toHaveBeenCalledWith({
        top: 1_100,
        behavior: 'instant'
      })
    })
  })

  it('starts a restored conversation at the latest message', async () => {
    const assistant = assistantMessage({
      parts: [{ type: 'text', text: 'latest reply', state: 'done' }]
    })
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
    dispatchResize()
    dispatchResize()
    scrollHeight = 1_200
    scrollTop = 490
    await userEvent.pointer([{ target: scrollContainer, keys: '[MouseLeft>]' }])
    await fireEvent.scroll(scrollContainer)
    scrollTo.mockClear()
    dispatchResize()

    store.ingest(delta('msg-1', 'Here is a cat'))
    await nextTick()
    await nextTick()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('shows a scroll-to-latest button when scrolled up and returns to bottom on click', async () => {
    const assistant = assistantMessage()
    let scrollTop = 100
    const scrollTo = vi.fn(
      (optionsOrX?: ScrollToOptions | number, y?: number) => {
        const top =
          typeof optionsOrX === 'number'
            ? (y ?? optionsOrX)
            : (optionsOrX?.top ?? 0)
        scrollTop = Math.min(top, 500)
      }
    )
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
      scrollTop: { get: () => scrollTop },
      clientHeight: { value: 500 }
    })
    await nextTick()
    scrollTop = 100
    await userEvent.pointer([{ target: scrollContainer, keys: '[MouseLeft>]' }])
    await fireEvent.scroll(scrollContainer)
    const jump = await screen.findByRole('button', { name: 'Latest' })
    expect(jump).toHaveTextContent('')

    await userEvent.click(jump)
    expect(scrollTo).toHaveBeenCalled()
    expect(scrollContainer.scrollTop).toBe(500)
    await fireEvent.scroll(scrollContainer)
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
    const assistant = assistantMessage({
      parts: [{ type: 'text', text: 'first thread', state: 'done' }]
    })
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

  it('does not re-enable following when a new conversation receives its id', async () => {
    const assistant = assistantMessage({
      parts: [{ type: 'text', text: 'first reply', state: 'done' }],
      streaming: true
    })
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    const { rerender } = render(ConversationView, {
      props: { entries: [assistant], conversationId: null },
      global: { plugins: [i18n] }
    })
    const scrollContainer = screen.getByTestId('agent-conversation-scroll')
    Object.defineProperties(scrollContainer, {
      scrollHeight: { value: 1_000 },
      scrollTop: { value: 100 },
      clientHeight: { value: 500 }
    })
    await nextTick()
    await userEvent.pointer([{ target: scrollContainer, keys: '[MouseLeft>]' }])
    await fireEvent.scroll(scrollContainer)
    scrollTo.mockClear()

    await rerender({ entries: [assistant], conversationId: 'thread-1' })
    await rerender({
      conversationId: 'thread-1',
      entries: [
        {
          ...assistant,
          parts: [
            { type: 'text', text: 'first reply continued', state: 'done' }
          ]
        }
      ]
    })
    await nextTick()
    await nextTick()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
  })

  it.for([
    { distance: 0.5, follows: true },
    { distance: 1.1, follows: false },
    { distance: 16.4, follows: false }
  ])(
    'follows only within the intent tolerance at $distance px',
    async ({ distance, follows }) => {
      const assistant = assistantMessage()
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

  it('preserves a scroll-away while the content watcher waits to render', async () => {
    const assistant = assistantMessage({ streaming: true })
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    const { rerender } = render(ConversationView, {
      props: { entries: [assistant] },
      global: { plugins: [i18n] }
    })
    let scrollTop = 500
    const scrollContainer = screen.getByTestId('agent-conversation-scroll')
    Object.defineProperties(scrollContainer, {
      scrollHeight: { value: 1_000 },
      scrollTop: { get: () => scrollTop },
      clientHeight: { value: 500 }
    })
    await nextTick()
    scrollTo.mockClear()

    const rendering = rerender({
      entries: [
        {
          ...assistant,
          parts: [{ type: 'text', text: 'hello again', state: 'done' }]
        }
      ]
    })
    scrollTop = 480
    scrollContainer.dispatchEvent(new Event('scroll'))
    await rendering
    await nextTick()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
  })

  it('fades only the edges where content continues past the view', async () => {
    const assistant = assistantMessage()

    const { container } = render(ConversationView, {
      props: { entries: [assistant] },
      global: { plugins: [i18n] }
    })

    // oxlint-disable-next-line testing-library/no-node-access -- scroll container has no queryable role; mask classes are the behavior under test
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
