import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { app } from '@/scripts/app'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
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
  app: { loadGraphData: vi.fn() }
}))

vi.mock('@/platform/workflow/validation/schemas/workflowSchema', () => ({
  validateComfyWorkflow: vi.fn(async (content: unknown) => content)
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ workspaceToken: undefined })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userDisplayName: { value: 'Jo Rivera' } })
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

describe('AgentPanelRoot draft binding', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('binds the draft to the workflow id from the message ack and reloads the canvas on a patch', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      // The server owns the workflow and returns its id in the message ack.
      if (url.includes('/messages')) {
        return new Response(
          JSON.stringify({
            thread_id: 'th-1',
            message_id: 'm-1',
            workflow_id: 'wf-42'
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'build a graph')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    // A draft_patch carrying the ack's workflow id now drives the canvas; a foreign one does not.
    const graph = { version: 0.4, nodes: [{ id: 1 }] }
    socket.emit('message', {
      data: JSON.stringify({
        type: 'draft_patch',
        data: { workflow_id: 'other', base_version: 0, version: 1, content: {} }
      })
    })
    socket.emit('message', {
      data: JSON.stringify({
        type: 'draft_patch',
        data: {
          workflow_id: 'wf-42',
          base_version: 0,
          version: 1,
          content: graph
        }
      })
    })

    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
  })

  it('surfaces one toast per rejection streak and recovers on a valid draft', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/messages')) {
        return new Response(
          JSON.stringify({
            thread_id: 'th-1',
            message_id: 'm-1',
            workflow_id: 'wf-42'
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Module-level fns retain calls across tests (restoreAllMocks only restores spies).
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
    // The schema rejects the first two patches (e.g. content missing its required
    // version field, as observed live); the third passes through and must both load
    // the canvas and reset the notification streak.
    vi.mocked(validateComfyWorkflow)
      .mockImplementationOnce(async (_content, onError) => {
        onError?.('rejected')
        return null
      })
      .mockImplementationOnce(async (_content, onError) => {
        onError?.('rejected')
        return null
      })

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const toast = useToastStore()

    await userEvent.type(screen.getByRole('textbox'), 'build a graph')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    const patch = (version: number): void =>
      socket.emit('message', {
        data: JSON.stringify({
          type: 'draft_patch',
          data: {
            workflow_id: 'wf-42',
            base_version: version - 1,
            version,
            content: { nodes: [] }
          }
        })
      })

    // One patch per tick: the version watcher batches same-tick bumps into one fire.
    patch(1)
    await vi.waitFor(() =>
      expect(vi.mocked(validateComfyWorkflow)).toHaveBeenCalledTimes(1)
    )
    patch(2)
    await vi.waitFor(() =>
      expect(vi.mocked(validateComfyWorkflow)).toHaveBeenCalledTimes(2)
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()
    const rejectionToasts = toast.messagesToAdd.filter(
      (message) => message.summary === i18n.global.t('agent.draftApplyFailed')
    )
    expect(rejectionToasts).toHaveLength(1)

    patch(3)
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(1))
  })
})

describe('AgentPanelRoot history', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('populates Chat History from the server thread list on mount', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/agent/threads')) {
        // Live envelope shape: {threads, pagination}; title is "" until the server
        // names the thread, with the first prompt in preview.
        return new Response(
          JSON.stringify({
            threads: [
              {
                id: 'th-9',
                title: 'build a text to image graph',
                last_message_at: '2026-07-07T10:00:00Z'
              },
              {
                id: 'th-10',
                title: '',
                preview: 'make a duck',
                last_message_at: '2026-07-07T09:00:00Z'
              }
            ],
            pagination: { page: 1 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const history = useAgentChatHistoryStore()
    await vi.waitFor(() => expect(history.sessions).toHaveLength(2))
    expect(history.sessions[0]).toMatchObject({
      id: 'th-9',
      title: 'build a text to image graph'
    })
    // An unnamed thread falls back to its preview for the row title.
    expect(history.sessions[1]).toMatchObject({
      id: 'th-10',
      title: 'make a duck'
    })
  })

  it('marks the adopted thread as the current session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/agent/threads')
          ? new Response('{"threads":[]}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          : new Response('[]', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
      )
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const convo = useAgentConversationStore()
    convo.setThreadId('th-active')
    await nextTick()

    const history = useAgentChatHistoryStore()
    expect(history.activeId).toBe('th-active')
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

describe('AgentPanelRoot greeting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('personalizes the empty-state greeting with the account first name', async () => {
    // useCurrentUser is mocked to "Jo Rivera"; the greeting shows the first name only.
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByText('Hello Jo,')).toBeInTheDocument()
  })
})
