import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

// A controllable stand-in for the host api: an EventTarget with a swappable socket, the
// exact surface the reconnecting event source binds to. Emitting a malformed agent frame
// through its socket is the one seam that drives a session notice at mount without a live
// backend, which is what FIX 5 forwards to the toast. Hoisted so the api mock factory can
// close over the same listener map the test emits through.
const socket = vi.hoisted(() => {
  type Listener = (event?: { data: unknown }) => void
  const listeners = new Map<string, Set<Listener>>()
  const fake = {
    readyState: 1,
    addEventListener(type: string, listener: Listener) {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener)
    }
  }
  const emit = (type: string, event?: { data: unknown }): void => {
    for (const listener of listeners.get(type) ?? []) listener(event)
  }
  const clear = (): void => listeners.clear()
  return { fake, emit, clear }
})

vi.mock('@/scripts/api', () => {
  const target = new EventTarget()
  return {
    api: {
      socket: socket.fake,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target)
    }
  }
})

vi.mock('@/scripts/app', () => ({
  app: { loadGraphData: vi.fn(), graph: { serialize: () => ({ nodes: [] }) } }
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ workspaceToken: undefined })
}))

const trackAgentMessageFeedback = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackAgentMessageFeedback })
}))

import type { TurnId } from './schemas/agentApiSchema'
import { zAgentWsEvent } from './schemas/agentApiSchema'
import type { AgentChatEvent } from './services/agent/agentEventTransport'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'

import AgentPanelRoot from './AgentPanelRoot.vue'

const zAgentWsEventForTest = (raw: unknown): AgentChatEvent =>
  zAgentWsEvent.parse(raw) as AgentChatEvent

describe('AgentPanelRoot session notices', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards a session notice to the host toast as an error', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const toast = useToastStore()

    // A malformed agent_message_done with no readable message_id makes the session push an
    // error notice (i18n agent.malformedEvent). The root watch must surface it as a toast.
    socket.emit('message', {
      data: JSON.stringify({ type: 'agent_message_done', data: {} })
    })
    await nextTick()

    expect(toast.messagesToAdd).toHaveLength(1)
    expect(toast.messagesToAdd[0]).toMatchObject({
      severity: 'error',
      summary: i18n.global.t('agent.malformedEvent')
    })
  })
})

describe('AgentPanelRoot attach flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uploads a picked file, stages its ref, and forwards it on the next send', async () => {
    const messageBodies: unknown[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/upload/image')) {
        return new Response(
          JSON.stringify({
            name: 'uploaded_cat.png',
            subfolder: '',
            type: 'input'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.endsWith('/api/workflows')) {
        return new Response(JSON.stringify({ id: 'wf-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      // The messages POST that carries the send payload.
      messageBodies.push(JSON.parse(String(init?.body)))
      return new Response(
        JSON.stringify({ thread_id: 'th-1', message_id: 'm-1' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    const input = screen.getByTestId<HTMLInputElement>('agent-file-input')
    await userEvent.upload(input, file)

    // The uploaded file's server name renders as a staged chip.
    expect(await screen.findByText('cat.png')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'make it pop')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({
      content: 'make it pop',
      attachments: ['uploaded_cat.png']
    })
  })
})

describe('AgentPanelRoot workflow binding', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('mints the session workflow before the first message and binds it', async () => {
    const urls: string[] = []
    let messageBody: Record<string, unknown> | undefined
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(url)
      if (url.endsWith('/api/workflows')) {
        return new Response(JSON.stringify({ id: 'wf-42' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      messageBody = JSON.parse(String(init?.body))
      return new Response(
        JSON.stringify({ thread_id: 'th-1', message_id: 'm-1' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'hello agent')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    // The workflow POST precedes the message POST, and the message carries its id.
    const workflowIndex = urls.findIndex((u) => u.endsWith('/api/workflows'))
    const messageIndex = urls.findIndex((u) => u.includes('/messages'))
    expect(workflowIndex).toBeGreaterThanOrEqual(0)
    expect(messageIndex).toBeGreaterThan(workflowIndex)
    expect(messageBody).toMatchObject({
      content: 'hello agent',
      workflow_id: 'wf-42'
    })
  })

  it('warns once on mint failure but still sends every message', async () => {
    const messageBodies: Record<string, unknown>[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/workflows')) {
        return new Response('nope', { status: 500 })
      }
      messageBodies.push(JSON.parse(String(init?.body)))
      return new Response(
        JSON.stringify({ thread_id: 'th-1', message_id: 'm-1' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const toast = useToastStore()
    const draftWarnings = () =>
      toast.messagesToAdd.filter(
        (message) =>
          message.summary === i18n.global.t('agent.draftsUnavailable')
      )

    // First send: minting 500s, so the user is warned and the message still posts unbound.
    await userEvent.type(screen.getByRole('textbox'), 'hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(messageBodies).toHaveLength(1))
    expect(messageBodies[0]).toMatchObject({ content: 'hi' })
    expect(draftWarnings()).toHaveLength(1)

    // Settle the turn so the composer returns to Send, then send again: it still posts, but
    // the drafts-unavailable warning is not repeated.
    await screen.findByRole('button', { name: 'Stop' })
    socket.emit('message', {
      data: JSON.stringify({
        type: 'agent_message_done',
        data: { message_id: 'm-1', thread_id: 'th-1', usage: null }
      })
    })
    await userEvent.type(await screen.findByRole('textbox'), 'again')
    await userEvent.click(await screen.findByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(messageBodies).toHaveLength(2))
    expect(draftWarnings()).toHaveLength(1)
  })
})

describe('AgentPanelRoot history', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers the active conversation as the current history session', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const convo = useAgentConversationStore()
    const turnId = 'turn-1' as TurnId
    convo.recordUser(turnId, 'build a text to image graph')
    convo.startTurn(turnId)
    await nextTick()

    const history = useAgentChatHistoryStore()
    expect(history.activeId).toBe('turn-1')
    expect(history.grouped.current).toHaveLength(1)
    expect(history.grouped.current[0]).toMatchObject({
      id: 'turn-1',
      title: 'build a text to image graph'
    })
  })
})

describe('AgentPanelRoot feedback capture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
    trackAgentMessageFeedback.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards a thumbs vote to telemetry with the message id and vote', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    // Seed a settled assistant turn so its feedback control renders.
    const store = useAgentConversationStore()
    const turnId = 'turn-9' as TurnId
    store.recordUser(turnId, 'make a cat')
    store.startTurn(turnId)
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_delta',
        data: { delta: 'Here is a cat', message_id: 'turn-9', thread_id: 'th' }
      })
    )
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: 'turn-9', thread_id: 'th', usage: null }
      })
    )
    await nextTick()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Helpful' })
    )
    // A second click on the active thumb retracts the vote; null must forward, not be dropped.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Helpful' })
    )

    expect(trackAgentMessageFeedback.mock.calls).toEqual([
      [{ message_id: 'turn-9', vote: 'up' }],
      [{ message_id: 'turn-9', vote: null }]
    ])
  })
})

describe('AgentPanelRoot lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('cancels the in-flight turn when the panel unmounts', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url)
      if (url.endsWith('/api/workflows')) {
        return new Response(JSON.stringify({ id: 'wf-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(
        JSON.stringify({ thread_id: 'th-1', message_id: 'm-1' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'hello')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    // The turn is in flight once the Stop control shows (activeTurnId + thread adopted).
    await screen.findByRole('button', { name: 'Stop' })

    unmount()

    // Closing the panel must POST the cancel so the turn does not keep billing unheard.
    await vi.waitFor(() =>
      expect(urls.some((url) => url.endsWith('/cancel'))).toBe(true)
    )
  })
})
