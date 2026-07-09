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

const appMock = vi.hoisted(() => ({
  loadGraphData: vi.fn(),
  graph: { nodes: [] as unknown[] }
}))

vi.mock('@/scripts/app', () => ({ app: appMock }))

vi.mock(
  '@/platform/workflow/validation/schemas/workflowSchema',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    validateComfyWorkflow: vi.fn(async (content: unknown) => content)
  })
)

// Controllable host-store fakes: a tab registry with an active tab, and the
// canvas selection the @-tag chips read. Reactive so the root's watches fire.
type FakeTab = {
  path: string
  filename: string
  isModified: boolean
  activeState: { id?: string } | null
}
const hostStores = vi.hoisted(() => ({
  workflow: null as unknown as {
    activeWorkflow: FakeTab | null
    openWorkflows: FakeTab[]
    tabs: Map<string, FakeTab>
    getWorkflowByPath: (path: string) => FakeTab | null
  },
  canvas: null as unknown as { selectedItems: unknown[] }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { reactive } = await import('vue')
  const tabs = new Map<string, FakeTab>()
  const store = reactive({
    activeWorkflow: null as FakeTab | null,
    get openWorkflows() {
      return Array.from(tabs.values())
    },
    tabs,
    getWorkflowByPath: (path: string) => tabs.get(path) ?? null
  })
  hostStores.workflow = store
  return { useWorkflowStore: () => store }
})

vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { reactive } = await import('vue')
  const store = reactive({ selectedItems: [] as unknown[] })
  hostStores.canvas = store
  return { useCanvasStore: () => store }
})

vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isLGraphNode: (item: unknown) =>
    (item as { isNodeFake?: boolean } | null)?.isNodeFake === true
}))

// Light stand-in for the host execution-error store the draft-apply failure writes to.
const executionErrors = vi.hoisted(() => ({
  lastPromptError: null as {
    type: string
    message: string
    details: string
  } | null,
  showErrorOverlay: vi.fn()
}))

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => executionErrors
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
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

import AgentPanelRoot from './AgentPanelRoot.vue'

beforeEach(() => {
  hostStores.workflow.tabs.clear()
  hostStores.workflow.activeWorkflow = null
  hostStores.canvas.selectedItems = []
  appMock.graph.nodes = []
})

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

    // The sent attachment stays visible in the transcript's user message
    // (thumbnail + name), not just on the wire.
    expect(screen.getByAltText('cat.png')).toBeInTheDocument()
    expect(screen.getByText('cat.png')).toBeInTheDocument()
  })

  it('shows an uploading chip and blocks send until the upload settles', async () => {
    let settleUpload: () => void = () => {}
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/upload/image')) {
        await new Promise<void>((resolve) => {
          settleUpload = resolve
        })
        return new Response(
          JSON.stringify({
            name: 'uploaded_cat.png',
            subfolder: '',
            type: 'input'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ thread_id: 'th-1', message_id: 'm-1' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )

    // The chip is visible the moment the file is picked, marked uploading,
    // and the send stays blocked so the unfinished ref cannot be dropped.
    expect(await screen.findByText('cat.png')).toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.global.t('agent.uploading'))
    ).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), 'make it pop')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    settleUpload()
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    )
    expect(
      screen.queryByLabelText(i18n.global.t('agent.uploading'))
    ).not.toBeInTheDocument()
  })

  it('renders the attachment on the turn that sent it, not earlier turns', async () => {
    let acks = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
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
        if (init?.method === 'POST' && url.includes('/messages')) {
          acks += 1
          return new Response(
            JSON.stringify({ thread_id: 'th-1', message_id: `m-${acks}` }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response(JSON.stringify({ threads: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'first message')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })
    socket.emit('message', {
      data: JSON.stringify({
        type: 'agent_message_done',
        data: { message_id: 'm-1', thread_id: 'th-1' }
      })
    })
    await screen.findByRole('button', { name: 'Send' })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    await screen.findByText('cat.png')
    await userEvent.type(screen.getByRole('textbox'), 'second message')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    // Exactly one thumbnail, positioned after the first turn's bubble — keying
    // the record to the wrong turn would render it inside the first user entry.
    // (index -1: the session bar title also mirrors the first prompt's text.)
    const thumbs = screen.getAllByAltText('cat.png')
    expect(thumbs).toHaveLength(1)
    const firstBubble = screen.getAllByText('first message').at(-1)!
    expect(
      firstBubble.compareDocumentPosition(thumbs[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('removes the chip, revokes its preview, and toasts when the upload fails', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    let failUpload: () => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/upload/image')) {
          await new Promise<void>((resolve) => {
            failUpload = resolve
          })
          return new Response('{"error":"disk full"}', {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        return new Response('{"threads":[]}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const toast = useToastStore()

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    expect(await screen.findByText('cat.png')).toBeInTheDocument()

    failUpload()
    await vi.waitFor(() =>
      expect(screen.queryByText('cat.png')).not.toBeInTheDocument()
    )
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(toast.messagesToAdd.at(-1)).toMatchObject({
      severity: 'error',
      summary: 'cat.png could not be uploaded'
    })
    revoke.mockRestore()
  })

  it('dismissing a staged chip removes it and releases its preview', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
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
        return new Response('{"threads":[]}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    expect(await screen.findByText('cat.png')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.remove') })
    )
    expect(screen.queryByText('cat.png')).not.toBeInTheDocument()
    expect(revoke).toHaveBeenCalledTimes(1)
    revoke.mockRestore()
  })
})

describe('AgentPanelRoot draft binding', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
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

    // No tab is bound to wf-42 yet, so the first apply opens a new tab.
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, null)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
  })

  it('surfaces one workflow error per rejection streak and recovers on a valid draft', async () => {
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
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()
    // The schema rejects the first two patches (e.g. content missing its required
    // version field, as observed live); the third passes through and must both load
    // the canvas and reset the failure streak so a later rejection surfaces again.
    vi.mocked(validateComfyWorkflow)
      .mockImplementationOnce(async (_content, onError) => {
        onError?.('rejected: version required')
        return null
      })
      .mockImplementationOnce(async (_content, onError) => {
        onError?.('rejected: version required')
        return null
      })

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

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
            content: { nodes: [{ id: 1 }] }
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
    // The failure lands on the host workflow-error surface, once per streak.
    expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_draft_apply_failed',
      details: 'rejected: version required'
    })

    patch(3)
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(1))

    // A rejection after a successful apply is a NEW streak and surfaces again.
    vi.mocked(validateComfyWorkflow).mockImplementationOnce(
      async (_content, onError) => {
        onError?.('rejected again')
        return null
      }
    )
    patch(4)
    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(2)
    )
  })

  it('surfaces a loadGraphData rejection as the same workflow error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/messages')
          ? new Response(
              JSON.stringify({
                thread_id: 'th-1',
                message_id: 'm-1',
                workflow_id: 'wf-42'
              }),
              { status: 202, headers: { 'Content-Type': 'application/json' } }
            )
          : new Response('{}', { status: 200 })
      )
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(app.loadGraphData)
      .mockClear()
      .mockRejectedValueOnce(new Error('graph configure exploded'))
    vi.mocked(validateComfyWorkflow).mockClear()
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'build a graph')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    socket.emit('message', {
      data: JSON.stringify({
        type: 'draft_patch',
        data: {
          workflow_id: 'wf-42',
          base_version: 0,
          version: 1,
          content: { version: 0.4, nodes: [{ id: 1 }] }
        }
      })
    })

    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    )
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_draft_apply_failed',
      details: 'graph configure exploded'
    })
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

describe('AgentPanelRoot workflow binding', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function makeTab(id?: string): FakeTab {
    const tab: FakeTab = {
      path: 'workflows/current.json',
      filename: 'current',
      isModified: false,
      activeState: id === undefined ? null : { id }
    }
    hostStores.workflow.tabs.set(tab.path, tab)
    hostStores.workflow.activeWorkflow = tab
    return tab
  }

  function mockMessagesEndpoint(ackWorkflowId: string): unknown[] {
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages')) {
          bodies.push(JSON.parse(String(init?.body)))
          return new Response(
            JSON.stringify({
              thread_id: 'th-1',
              message_id: `m-${bodies.length}`,
              workflow_id: ackWorkflowId
            }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('{}', { status: 200 })
      })
    )
    return bodies
  }

  const patch = (version: number, content: unknown): void =>
    socket.emit('message', {
      data: JSON.stringify({
        type: 'draft_patch',
        data: {
          workflow_id: 'wf-42',
          base_version: version - 1,
          version,
          content
        }
      })
    })

  it('names the active tab in the panel strip', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByText('current')).toBeInTheDocument()

    // Reactive: switching tabs renames the strip.
    const other: FakeTab = {
      path: 'workflows/other.json',
      filename: 'other',
      isModified: false,
      activeState: null
    }
    hostStores.workflow.tabs.set(other.path, other)
    hostStores.workflow.activeWorkflow = other
    expect(await screen.findByText('other')).toBeInTheDocument()
    expect(screen.queryByText('current')).not.toBeInTheDocument()
  })

  it("sends the active tab's saved workflow id and applies patches in place", async () => {
    const tab = makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })

    // The ack confirmed the id we sent, so the patch lands IN the active tab
    // (no new tab) and the graph write re-baselines the user-edit flag.
    tab.isModified = false
    const graph = { version: 0.4, nodes: [{ id: 1 }] }
    patch(1, graph)
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
  })

  it('retries once without the speculative id when the server rejects it', async () => {
    makeTab('someone-elses-uuid')
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!url.includes('/messages'))
          return new Response('{}', { status: 200 })
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (body.workflow_id !== undefined) {
          return new Response(
            JSON.stringify({ error: 'workflow not found or access denied' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({
            thread_id: 'th-1',
            message_id: 'm-1',
            workflow_id: 'wf-fresh'
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'build a graph')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toMatchObject({ workflow_id: 'someone-elses-uuid' })
    expect(bodies[1]).not.toHaveProperty('workflow_id')

    // The minted id was NOT adopted onto the active tab (it is not the id we
    // sent), so its first patch takes the new-tab path, not the active tab.
    const graph = { version: 0.4, nodes: [{ id: 9 }] }
    socket.emit('message', {
      data: JSON.stringify({
        type: 'draft_patch',
        data: {
          workflow_id: 'wf-fresh',
          base_version: 0,
          version: 1,
          content: graph
        }
      })
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, null)
    )
  })

  it('parks a patch for a backgrounded bound tab and applies it on refocus', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    // The bound tab goes to the background before the patch lands.
    const other: FakeTab = {
      path: 'workflows/other.json',
      filename: 'other',
      isModified: false,
      activeState: null
    }
    hostStores.workflow.tabs.set(other.path, other)
    hostStores.workflow.activeWorkflow = other

    const graph = { version: 0.4, nodes: [{ id: 3 }] }
    patch(1, graph)
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()

    // Refocusing the bound tab applies the parked draft exactly once.
    hostStores.workflow.activeWorkflow = tab
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
  })

  it("leaves the edited tab alone when the user picks 'Open new tab'", async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    tab.isModified = true
    const graph = { version: 0.4, nodes: [{ id: 4 }] }
    patch(1, graph)
    await screen.findByText(i18n.global.t('agent.conflictTitle'))

    // 'Open in new tab' lives in the dropdown attached to the primary action.
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.moreApplyOptions')
      })
    )
    await userEvent.click(
      await screen.findByText(i18n.global.t('agent.openNewTab'))
    )
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, null)
    )
    expect(tab.isModified).toBe(true)
  })

  it('replays a parked draft on the next turn even when its version is unchanged', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [] })
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    // The X close is a defer, same as Cancel: nothing applies.
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('g.close') })
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()

    socket.emit('message', {
      data: JSON.stringify({
        type: 'agent_message_done',
        data: { message_id: 'm-1', thread_id: 'th-1' }
      })
    })
    await screen.findByRole('button', { name: 'Send' })

    // No new patch arrives; the send itself must re-drive the parked draft,
    // which re-raises the dialog against the still-edited tab.
    await userEvent.type(screen.getByRole('textbox'), 'go ahead')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(
      await screen.findByText(i18n.global.t('agent.conflictTitle'))
    ).toBeInTheDocument()
  })

  it('drops the parked draft when a new chat starts', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [] })
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('g.cancel') })
    )

    // New chat: the abandoned thread's parked draft must not leak forward.
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    // A stale patch for the abandoned workflow is rejected by the reset store;
    // were it adopted, the send below would replay it onto the clean tab.
    patch(2, { version: 0.4, nodes: [{ id: 6 }] })
    await nextTick()
    await nextTick()
    tab.isModified = false

    await userEvent.type(screen.getByRole('textbox'), 'fresh start')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()

    // The new conversation's own patches flow normally into the still-bound tab.
    const graph = { version: 0.4, nodes: [{ id: 8 }] }
    patch(3, graph)
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
  })

  it('sends only the surviving chip ids after one is dismissed', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    hostStores.canvas.selectedItems = [
      { isNodeFake: true, id: 5, title: 'KSampler' },
      { isNodeFake: true, id: 7, title: 'VAEDecode' }
    ]
    expect(await screen.findByText('KSampler')).toBeInTheDocument()
    expect(screen.getByText('VAEDecode')).toBeInTheDocument()

    // Dismiss the first chip; the unchanged canvas selection must not resurrect it.
    await userEvent.click(
      screen.getAllByRole('button', { name: i18n.global.t('agent.remove') })[0]
    )
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'decode it')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['7'] } })
    // The surviving tag persists on the transcript; the dismissed one is gone.
    expect(screen.getByText('VAEDecode')).toBeInTheDocument()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
  })

  it('raises the conflict dialog on a user-edited bound tab and honors the choice', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    // The user edited the tab after the turn started: no silent overwrite.
    tab.isModified = true
    patch(1, { version: 0.4, nodes: [] })
    expect(
      await screen.findByText(i18n.global.t('agent.conflictTitle'))
    ).toBeInTheDocument()
    expect(app.loadGraphData).not.toHaveBeenCalled()

    // Cancel defers: later patches stay un-applied this turn.
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('g.cancel') })
    )
    patch(2, { version: 0.4, nodes: [] })
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()

    // The next turn re-arms applies; the still-edited tab re-raises the dialog
    // and 'Accept agent changes' overwrites in place.
    socket.emit('message', {
      data: JSON.stringify({
        type: 'agent_message_done',
        data: { message_id: 'm-1', thread_id: 'th-1' }
      })
    })
    await screen.findByRole('button', { name: 'Send' })
    await userEvent.type(screen.getByRole('textbox'), 'go on')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    const graph = { version: 0.4, nodes: [{ id: 2 }] }
    patch(3, graph)
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.acceptAgent')
      })
    )
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
    expect(tab.isModified).toBe(false)
  })

  it("'Keep my changes' retires the pending draft version for good", async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [] })
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.keepMine') })
    )

    // The decision sticks: the next turn does NOT re-ask about this version...
    socket.emit('message', {
      data: JSON.stringify({
        type: 'agent_message_done',
        data: { message_id: 'm-1', thread_id: 'th-1' }
      })
    })
    await screen.findByRole('button', { name: 'Send' })
    await userEvent.type(screen.getByRole('textbox'), 'something else')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await nextTick()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()

    // ...but a NEWER agent edit is a fresh decision.
    patch(2, { version: 0.4, nodes: [{ id: 3 }] })
    expect(
      await screen.findByText(i18n.global.t('agent.conflictTitle'))
    ).toBeInTheDocument()
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('stages selected nodes as chips and sends their ids once', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    hostStores.canvas.selectedItems = [
      { isNodeFake: true, id: 5, title: 'KSampler' }
    ]
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'tweak the sampler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['5'] } })
    // Consumed on send: the composer chip clears (no remove button left), but
    // the tag stays visible on the transcript's user message.
    expect(
      screen.queryByRole('button', { name: i18n.global.t('agent.remove') })
    ).not.toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })
  it('coalesces patches that stream faster than the canvas apply settles', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'add an upscaler')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    let releaseApply: () => void = () => {}
    vi.mocked(app.loadGraphData).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseApply = resolve
        })
    )
    const g1 = { version: 0.4, nodes: [{ id: 1 }] }
    patch(1, g1)
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(1))

    // Two more patches land while the first apply is still settling: they must
    // queue into ONE trailing re-run, never interleave a second loadGraphData.
    patch(2, { version: 0.4, nodes: [{ id: 2 }] })
    await nextTick()
    patch(3, { version: 0.4, nodes: [{ id: 3 }] })
    await nextTick()
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)

    releaseApply()
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(2))
    // The trailing re-run applies the LATEST draft only (v3), skipping v2.
    expect(vi.mocked(app.loadGraphData).mock.calls[1][0]).toEqual({
      version: 0.4,
      nodes: [{ id: 3 }]
    })
    expect(vi.mocked(app.loadGraphData).mock.calls[1][3]).toBe(tab)
  })
  it('parks an empty unbound draft instead of opening a blank tab', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    // The server's freshly minted draft is empty: nothing should apply.
    patch(1, { version: 0.4, nodes: [] })
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()

    // The first patch with real nodes opens the tab as usual.
    const graph = { version: 0.4, nodes: [{ id: 1 }] }
    patch(2, graph)
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, null)
    )
  })

  it('stages a chip from the @ node picker and sends its id', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.graph.nodes = [{ id: 9, title: 'VAE Decode' }]

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.mention') })
    )
    await userEvent.click(await screen.findByText('VAE Decode'))
    // Picked node staged as a removable chip.
    expect(
      screen.getByRole('button', { name: i18n.global.t('agent.remove') })
    ).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'explain this')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['9'] } })
  })
})
