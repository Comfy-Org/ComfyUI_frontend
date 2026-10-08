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
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { PromptSnapshot } from '../../types/workflowReference'
import { composerPromptForSubmission } from '../../utils/composerPrompt'

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

const Harness = defineComponent({
  components: { ConversationView },
  setup() {
    const store = useAgentConversationStore()
    return { store }
  },
  template: `<ConversationView :entries="store.entries" user-name="Ada" />`
})

function mountHarness() {
  const pinia = getActivePinia()!
  const utils = render(Harness, { global: { plugins: [pinia, i18n] } })
  return { store: useAgentConversationStore(), ...utils }
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

  it.for(['live', 'history'])(
    'renders and edits the skill from a %s message alongside a workflow reference',
    async (source) => {
      const store = useAgentConversationStore()
      const marker =
        '[Use the saved skill /portrait](skill://portrait?description=Use%20defaults)'
      if (source === 'live') {
        store.recordUser(T, `${marker} render it`, undefined, undefined, [
          { id: 'wf', name: 'Reference', textOffset: marker.length }
        ])
        store.startTurn(T)
      } else {
        store.hydrate([
          {
            id: 'row',
            thread_id: 'thread',
            seq: 1,
            turn_id: T,
            status: 'complete',
            role: 'user',
            content: {
              text: `${marker}[Reference](workflow://wf) render it`,
              workflow_references: [{ workflow_id: 'wf', name: 'Reference' }]
            }
          }
        ])
      }
      const view = render(ConversationView, {
        props: { entries: store.entries, editableTurnId: T },
        global: { plugins: [i18n] }
      })
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(
        '/portrait'
      )
      await userEvent.hover(screen.getByTestId('skill-reference'))
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        /^Use defaults$/
      )
      await userEvent.unhover(screen.getByTestId('skill-reference'))
      expect(screen.getByTestId('workflow-reference-chip')).toHaveTextContent(
        'Reference'
      )
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      const snapshot: PromptSnapshot = {
        text: ' render it',
        workflowReferences: [{ id: 'wf', name: 'Reference', textOffset: 0 }],
        skillReference: {
          name: 'portrait',
          description: 'Use defaults',
          textOffset: 0,
          workflowIndex: 0
        }
      }
      expect(view.emitted().editPrompt).toEqual([[snapshot]])
      const composer = useAgentComposerStore()
      composer.setSkillScope('current-user/workspace')
      composer.replacePrompt(snapshot)
      expect(composerPromptForSubmission(composer.prompt)).toEqual({
        text: `${marker} render it`,
        workflowReferences: [
          { id: 'wf', name: 'Reference', textOffset: marker.length }
        ]
      })
    }
  )

  it('refreshes once for multiple historical references without refetching on text updates', async () => {
    const skills = useSkillPacksStore()
    skills.flagsEnabled = true
    vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
    let resolve: (
      packs: Awaited<ReturnType<typeof listSkillPacks>>
    ) => void = () => {}
    vi.mocked(listSkillPacks).mockReturnValueOnce(
      new Promise((settle) => {
        resolve = settle
      })
    )
    const entries = ['one', 'two'].map((id) => ({
      id: toTurnId(id),
      role: 'user' as const,
      text: ' render',
      skillReference: {
        name: 'portrait',
        description: 'Original',
        textOffset: 0
      }
    }))
    const view = render(ConversationView, {
      props: { entries, conversationId: 'conversation' },
      global: { plugins: [i18n] }
    })
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledOnce())
    expect(screen.getAllByTestId('skill-reference')).toHaveLength(2)
    expect(screen.getAllByTestId('skill-reference')[0]).toHaveClass(
      'text-warning-background'
    )
    const refresh = skills.refreshPacks()
    expect(listSkillPacks).toHaveBeenCalledOnce()
    await view.rerender({
      entries: entries.map((entry) => ({ ...entry, text: ' changed text' }))
    })
    expect(listSkillPacks).toHaveBeenCalledOnce()
    resolve([
      {
        id: 'portrait',
        name: 'portrait',
        description: 'Current',
        body: '',
        body_hash: '',
        created_at: '',
        updated_at: ''
      }
    ])
    await refresh
    expect(skills.catalogConfirmed).toBe(true)
    await userEvent.hover(screen.getAllByTestId('skill-reference')[0])
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Original$/)
  })

  it('does not display a late historical catalog description after switching workspace', async () => {
    const skills = useSkillPacksStore()
    skills.flagsEnabled = true
    vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
    let resolveOld: (
      packs: Awaited<ReturnType<typeof listSkillPacks>>
    ) => void = () => {}
    let resolveNew: (
      packs: Awaited<ReturnType<typeof listSkillPacks>>
    ) => void = () => {}
    vi.mocked(listSkillPacks)
      .mockReturnValueOnce(
        new Promise((settle) => {
          resolveOld = settle
        })
      )
      .mockReturnValueOnce(
        new Promise((settle) => {
          resolveNew = settle
        })
      )
    render(ConversationView, {
      props: {
        conversationId: 'history',
        entries: [
          {
            id: T,
            role: 'user',
            text: ' render',
            skillReference: {
              name: 'portrait',
              description: 'Original',
              textOffset: 0
            }
          }
        ]
      },
      global: { plugins: [i18n] }
    })
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledOnce())
    const oldRequest = skills.refreshPacks()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'new-workspace' })
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledTimes(2))
    const newRequest = skills.refreshPacks()
    resolveNew([
      {
        id: 'portrait',
        name: 'portrait',
        description: 'New workspace description',
        body: '',
        body_hash: '',
        created_at: '',
        updated_at: ''
      }
    ])
    await newRequest
    resolveOld([
      {
        id: 'portrait',
        name: 'portrait',
        description: 'Foreign old description',
        body: '',
        body_hash: '',
        created_at: '',
        updated_at: ''
      }
    ])
    await oldRequest
    await userEvent.hover(screen.getByTestId('skill-reference'))
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(/^Original$/)
    expect(tooltip).not.toHaveTextContent('Foreign old description')
    expect(tooltip).not.toHaveTextContent('New workspace description')
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
