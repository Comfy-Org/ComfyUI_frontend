import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { app } from '@/scripts/app'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useToastStore } from '@/platform/updates/common/toastStore'

const ws = vi.hoisted(() => {
  type Listener = (event: { detail?: unknown }) => void
  const listeners = new Map<string, Set<Listener>>()
  const add = (type: string, listener: Listener): void => {
    const set = listeners.get(type) ?? new Set()
    set.add(listener)
    listeners.set(type, set)
  }
  const remove = (type: string, listener: Listener): void => {
    listeners.get(type)?.delete(listener)
  }
  const emit = (type: string, data?: unknown): void => {
    for (const listener of listeners.get(type) ?? []) listener({ detail: data })
  }
  const clear = (): void => listeners.clear()
  return { add, remove, emit, clear }
})

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (route: string, options?: RequestInit) =>
      fetch(route.startsWith('/api') ? route : `/api${route}`, options),
    socket: { readyState: 1 },
    addEventListener: ws.add,
    removeEventListener: ws.remove,
    addCustomEventListener: ws.add,
    removeCustomEventListener: ws.remove
  }
}))

const appMock = vi.hoisted(() => {
  const graph = {
    nodes: [] as unknown[],
    serialize: () => ({ version: 0.4, nodes: graph.nodes })
  }
  return {
    loadGraphData: vi.fn(),
    graph,
    canvas: undefined as { graph: { nodes: unknown[] } } | undefined
  }
})

vi.mock('@/scripts/app', () => ({ app: appMock }))

vi.mock(
  '@/platform/workflow/validation/schemas/workflowSchema',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    validateComfyWorkflow: vi.fn(async (content: unknown) => content)
  })
)

type FakeTab = {
  path: string
  directory: string
  filename: string
  isTemporary: boolean
  isModified: boolean
  activeState: { id?: string } | null
  initialMode?: 'app' | 'graph'
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
    getWorkflowByPath: (path: string) => tabs.get(path) ?? null,
    createTemporary: (path?: string, data?: unknown) => {
      const requested = (path ?? 'Unsaved Workflow.json').replace(/\.json$/, '')
      let stem = requested
      let counter = 2
      while (tabs.has(`workflows/${stem}.json`))
        stem = `${requested} (${counter++})`
      const tab: FakeTab = {
        path: `workflows/${stem}.json`,
        directory: 'workflows',
        filename: stem,
        isTemporary: true,
        isModified: false,
        activeState: (data ?? null) as { id?: string } | null
      }
      tabs.set(tab.path, tab)
      return tab
    }
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

const workflowService = vi.hoisted(() => ({
  saveWorkflow: vi.fn(async (tab: { isModified: boolean }) => {
    tab.isModified = false
    return true
  }),
  saveWorkflowAs: vi.fn(
    async (
      tab: { path: string; isTemporary: boolean; isModified: boolean },
      _options?: { filename?: string }
    ) => {
      tab.isTemporary = false
      tab.isModified = false
      return true
    }
  ),
  openWorkflow: vi.fn(async (tab: { path: string }) => {
    const known = hostStores.workflow.tabs.get(tab.path)
    if (known) hostStores.workflow.activeWorkflow = known
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => workflowService
}))

vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isLGraphNode: (item: unknown) =>
    (item as { isNodeFake?: boolean } | null)?.isNodeFake === true
}))

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

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userDisplayName: { value: 'Jo Rivera' } })
}))

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref } = await import('vue')
  return {
    ...(await importOriginal<object>()),
    useClipboard: () => ({
      copy: clipboard.copy,
      copied: ref(false),
      isSupported: ref(true),
      text: ref('')
    })
  }
})

const telemetry = vi.hoisted(() => ({
  trackAgentMessageFeedback: vi.fn(),
  trackAgentWorkflowApplied: vi.fn(),
  trackAgentMessageSent: vi.fn(),
  trackAgentNodeTagged: vi.fn(),
  trackAgentAttachButtonClicked: vi.fn(),
  trackAgentCloseButtonClicked: vi.fn(),
  trackAgentPanelOpened: vi.fn(),
  trackAgentPanelClosed: vi.fn()
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => telemetry
}))

import type { TurnId } from './schemas/agentApiSchema'
import { zAgentWsEvent } from './schemas/agentApiSchema'
import type { AgentChatEvent } from './services/agent/agentEventTransport'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentDraftStore } from './stores/agent/agentDraftStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'

import AgentPanelRoot from './AgentPanelRoot.vue'

beforeEach(() => {
  localStorage.clear()
  hostStores.workflow.tabs.clear()
  hostStores.workflow.activeWorkflow = null
  hostStores.canvas.selectedItems = []
  appMock.graph.nodes = []
  appMock.canvas = undefined
  workflowService.saveWorkflow.mockClear()
  workflowService.saveWorkflowAs.mockClear()
  workflowService.openWorkflow.mockClear()
})

const zAgentWsEventForTest = (raw: unknown): AgentChatEvent =>
  zAgentWsEvent.parse(raw) as AgentChatEvent

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function ack(workflowId: string, messageId = 'm-1') {
  return { thread_id: 'th-1', message_id: messageId, workflow_id: workflowId }
}

async function sendFromComposer(text: string): Promise<void> {
  await userEvent.type(screen.getByRole('textbox'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  await screen.findByRole('button', { name: 'Stop' })
}

async function renderAndSend(text: string): Promise<void> {
  render(AgentPanelRoot, { global: { plugins: [i18n] } })
  await sendFromComposer(text)
}

async function settleTurnAndSend(
  messageId: string,
  text: string
): Promise<void> {
  ws.emit('agent_message_done', { message_id: messageId, thread_id: 'th-1' })
  await screen.findByRole('button', { name: 'Send' })
  await sendFromComposer(text)
}

function addTab(path: string, overrides: Partial<FakeTab> = {}): FakeTab {
  const slash = path.lastIndexOf('/')
  const tab: FakeTab = {
    path,
    directory: path.slice(0, slash),
    filename: path.slice(slash + 1).replace(/\.json$/, ''),
    isTemporary: false,
    isModified: false,
    activeState: null,
    ...overrides
  }
  hostStores.workflow.tabs.set(tab.path, tab)
  return tab
}

describe('AgentPanelRoot session notices', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('surfaces a session error notice via the host error modal, not a toast', async () => {
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{"threads":[]}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const toast = useToastStore()

    ws.emit('agent_message_done', {})
    await nextTick()

    expect(toast.messagesToAdd).toHaveLength(0)
    expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_api_failed',
      details: i18n.global.t('agent.malformedEvent')
    })
  })
})

describe('AgentPanelRoot attach flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
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
      messageBodies.push(JSON.parse(String(init?.body)))
      return json(202, { thread_id: 'th-1', message_id: 'm-1' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.attach') })
    )
    expect(telemetry.trackAgentAttachButtonClicked).toHaveBeenCalled()

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    const input = screen.getByTestId<HTMLInputElement>('agent-file-input')
    await userEvent.upload(input, file)

    expect(await screen.findByText('cat.png')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'make it pop')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({
      content: 'make it pop',
      attachments: ['uploaded_cat.png']
    })
    expect(telemetry.trackAgentMessageSent).toHaveBeenCalledWith({
      attachment_count: 1,
      node_tag_count: 0
    })

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
      return json(202, { thread_id: 'th-1', message_id: 'm-1' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )

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
          return json(202, { thread_id: 'th-1', message_id: `m-${acks}` })
        }
        return json(200, { threads: [] })
      })
    )

    await renderAndSend('first message')
    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    await screen.findByText('cat.png')
    await sendFromComposer('second message')

    const thumbs = screen.getAllByAltText('cat.png')
    expect(thumbs).toHaveLength(1)
    const firstBubble = screen.getAllByText('first message').at(-1)!
    expect(
      firstBubble.compareDocumentPosition(thumbs[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('removes the chip, revokes its preview, and raises the error modal when the upload fails', async () => {
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()
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
    expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_api_failed',
      details: 'cat.png could not be uploaded'
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
    ws.clear()
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('binds the draft to the workflow id from the message ack and reloads the canvas on a patch', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/messages')) {
        return new Response(JSON.stringify(ack('wf-42', 'm-1')), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await renderAndSend('build a graph')

    const graph = { version: 0.4, nodes: [{ id: 1 }] }
    ws.emit('draft_patch', {
      workflow_id: 'other',
      base_version: 0,
      version: 1,
      content: {}
    })
    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 0,
      version: 1,
      content: graph
    })

    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, null)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
  })

  it('surfaces one workflow error per rejection streak and recovers on a valid draft', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/messages')) {
        return new Response(JSON.stringify(ack('wf-42', 'm-1')), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('{"threads":[]}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()
    vi.mocked(validateComfyWorkflow)
      .mockImplementationOnce(async (_content, onError) => {
        onError?.('rejected: version required')
        return null
      })
      .mockImplementationOnce(async (_content, onError) => {
        onError?.('rejected: version required')
        return null
      })

    await renderAndSend('build a graph')

    const patch = (version: number): void =>
      ws.emit('draft_patch', {
        workflow_id: 'wf-42',
        base_version: version - 1,
        version,
        content: { nodes: [{ id: 1 }] }
      })

    patch(1)
    await vi.waitFor(() =>
      expect(vi.mocked(validateComfyWorkflow)).toHaveBeenCalledTimes(1)
    )
    patch(2)
    await vi.waitFor(() =>
      expect(vi.mocked(validateComfyWorkflow)).toHaveBeenCalledTimes(2)
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_draft_apply_failed',
      details: 'rejected: version required'
    })

    patch(3)
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(1))

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
          ? new Response(JSON.stringify(ack('wf-42', 'm-1')), {
              status: 202,
              headers: { 'Content-Type': 'application/json' }
            })
          : new Response('{"threads":[]}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
      )
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(app.loadGraphData)
      .mockClear()
      .mockRejectedValueOnce(new Error('graph configure exploded'))
    vi.mocked(validateComfyWorkflow).mockClear()
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()

    await renderAndSend('build a graph')

    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 0,
      version: 1,
      content: { version: 0.4, nodes: [{ id: 1 }] }
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
    ws.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('populates Chat History from the server thread list on mount', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/agent/threads')) {
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
    expect(history.sessions[1]).toMatchObject({
      id: 'th-10',
      title: 'make a duck'
    })
  })

  it('surfaces a thread-list failure via the host error modal', async () => {
    executionErrors.lastPromptError = null
    executionErrors.showErrorOverlay.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 }))
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    )
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_api_failed'
    })
    expect(useAgentChatHistoryStore().sessions).toHaveLength(0)
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

describe('AgentPanelRoot transcript copy', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
    clipboard.copy.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('copies the active session from chat history as formatted markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/agent/threads')
          ? new Response(
              JSON.stringify({
                threads: [
                  {
                    id: 'th-1',
                    title: 'make a cat',
                    last_message_at: '2026-07-07T10:00:00Z'
                  }
                ],
                pagination: { page: 1 }
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          : new Response('{}', { status: 200 })
      )
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const convo = useAgentConversationStore()
    const turnId = 'turn-1' as TurnId
    convo.setThreadId('th-1')
    convo.recordUser(turnId, 'make a cat')
    convo.startTurn(turnId)
    convo.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_delta',
        data: { delta: 'Here is ', message_id: 'turn-1', thread_id: 'th-1' }
      })
    )
    convo.ingest(
      zAgentWsEventForTest({
        type: 'agent_tool_call',
        data: {
          tool_name: 'add_node',
          status: 'ok',
          args: [],
          message_id: 'turn-1',
          thread_id: 'th-1'
        }
      })
    )
    convo.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_delta',
        data: { delta: 'a cat.', message_id: 'turn-1', thread_id: 'th-1' }
      })
    )
    convo.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: 'turn-1', thread_id: 'th-1', usage: null }
      })
    )
    await nextTick()

    await userEvent.click(screen.getByRole('button', { name: 'make a cat' }))
    await userEvent.click(
      await screen.findByRole('button', {
        name: i18n.global.t('agent.copyMarkdown')
      })
    )

    expect(clipboard.copy).toHaveBeenCalledWith(
      '**You:** make a cat\n\n**Agent:** Here is a cat.'
    )
  })
})

describe('AgentPanelRoot feedback capture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
    telemetry.trackAgentMessageFeedback.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards a thumbs vote to telemetry with the message id and vote', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    useAgentDraftStore().workflowId = 'wf-9'

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
    await userEvent.click(
      await screen.findByRole('button', { name: 'Helpful' })
    )

    expect(telemetry.trackAgentMessageFeedback.mock.calls).toEqual([
      [{ message_id: 'turn-9', vote: 'up', workflow_id: 'wf-9' }],
      [{ message_id: 'turn-9', vote: null, workflow_id: 'wf-9' }]
    ])
  })
})

describe('AgentPanelRoot lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports the header close click and attributes the panel close to it', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    useAgentPanelStore().isOpen = true
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.close') })
    )

    expect(telemetry.trackAgentCloseButtonClicked).toHaveBeenCalled()
    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: null
    })
    expect(useAgentPanelStore().isOpen).toBe(false)
  })

  it('does not cancel the in-flight turn when the panel unmounts', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url)
      return json(202, { thread_id: 'th-1', message_id: 'm-1' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await sendFromComposer('hello')

    unmount()
    await new Promise((resolve) => setTimeout(resolve))

    expect(urls.some((url) => url.endsWith('/cancel'))).toBe(false)
  })
})

describe('AgentPanelRoot greeting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('personalizes the empty-state greeting with the account first name', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByText('Hello Jo,')).toBeInTheDocument()
  })
})

describe('AgentPanelRoot workflow binding', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
    telemetry.trackAgentNodeTagged.mockClear()
    telemetry.trackAgentWorkflowApplied.mockClear()
    executionErrors.showErrorOverlay.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function makeTab(id?: string): FakeTab {
    const tab: FakeTab = {
      path: 'workflows/current.json',
      directory: 'workflows',
      filename: 'current',
      isTemporary: false,
      isModified: false,
      activeState: id === undefined ? null : { id }
    }
    hostStores.workflow.tabs.set(tab.path, tab)
    hostStores.workflow.activeWorkflow = tab
    if (id !== undefined) useAgentWorkflowTabBindingStore().bind(id, tab.path)
    return tab
  }

  function mockMessagesEndpoint(
    ackWorkflowId: string,
    draft: { status: number; body: unknown } = {
      status: 200,
      body: { content: { version: 0.4, nodes: [{ id: 1 }] }, version: 3 }
    },
    cloudWorkflows: { id: string; name: string }[] = []
  ): unknown[] {
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages')) {
          bodies.push(JSON.parse(String(init?.body)))
          return json(202, ack(ackWorkflowId, `m-${bodies.length}`))
        }
        if (url.includes('/agent/threads')) {
          return json(200, { threads: [], pagination: { page: 1 } })
        }
        if (url.includes('/agent/draft')) {
          return json(draft.status, draft.body)
        }
        if (url.includes('/workflows')) {
          return json(200, {
            data: cloudWorkflows,
            pagination: {
              offset: 0,
              limit: 100,
              total: cloudWorkflows.length,
              has_more: false
            }
          })
        }
        return new Response('{}', { status: 200 })
      })
    )
    return bodies
  }

  const patch = (version: number, content: unknown): void =>
    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: version - 1,
      version,
      content
    })

  it('names the active tab in the panel strip', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findAllByText('current')).not.toHaveLength(0)

    const other = addTab('workflows/other.json')
    hostStores.workflow.activeWorkflow = other
    expect(await screen.findAllByText('other')).not.toHaveLength(0)
    expect(screen.queryAllByText('current')).toHaveLength(0)
  })

  it('keeps the active-tab strip visible in the history view', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(await screen.findAllByText('current')).not.toHaveLength(0)

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChatTitle') })
    )
    expect(
      await screen.findByText(i18n.global.t('agent.historyEmpty'))
    ).toBeInTheDocument()
    expect(screen.getByText('current')).toBeInTheDocument()
  })

  it('activates the tab picked from the workflow selector via the service', async () => {
    makeTab('wf-42')
    const other = addTab('workflows/other.json')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(await screen.findByText('other'))

    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(other)
    )
  })

  it('flags the bound tab as agent-edited for exactly the turn duration', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })
    expect(activity.editingTabPath).toBeNull()
  })

  it('marks a backgrounded bound tab modified without touching the canvas', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    const other = addTab('workflows/other.json')
    hostStores.workflow.activeWorkflow = other
    await nextTick()

    patch(1, { version: 0.4, nodes: [{ id: 3 }] })
    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() =>
      expect(activity.unseenModifiedPaths.has('workflows/current.json')).toBe(
        true
      )
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('clears the spinner and creating flags when the panel unmounts mid-turn', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await sendFromComposer('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')
    activity.setCreating(true)

    unmount()

    expect(activity.editingTabPath).toBeNull()
    expect(activity.creatingTab).toBe(false)
  })

  it('raises the creating flag only while an unbound agent tab materializes', async () => {
    makeTab('wf-42')
    let resolveDraft: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/messages')) return json(202, ack('wf-42', 'm-1'))
        if (url.includes('/agent/threads'))
          return json(200, { threads: [], pagination: { page: 1 } })
        if (url.includes('workflow_id=wf-new')) {
          return new Promise<Response>((resolve) => {
            resolveDraft = resolve
          })
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('work here')

    const activity = useWorkflowTabActivityStore()
    expect(activity.creatingTab).toBe(false)

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'Fresh',
      thread_id: 'th-1'
    })
    await vi.waitFor(() => expect(activity.creatingTab).toBe(true))

    resolveDraft?.(json(404, { error: 'none' }))
    await vi.waitFor(() => expect(activity.creatingTab).toBe(false))
    expect(hostStores.workflow.tabs.get('workflows/Fresh.json')).toBeDefined()
  })

  it('lowers the creating flag when the draft fetch for a fresh tab fails', async () => {
    makeTab('wf-42')
    let rejectDraft: ((error: Error) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/messages')) return json(202, ack('wf-42', 'm-1'))
        if (url.includes('/agent/threads'))
          return json(200, { threads: [], pagination: { page: 1 } })
        if (url.includes('workflow_id=wf-new')) {
          return new Promise<Response>((_resolve, reject) => {
            rejectDraft = reject
          })
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'Fresh',
      thread_id: 'th-1'
    })
    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() => expect(activity.creatingTab).toBe(true))

    rejectDraft?.(new Error('network down'))
    await vi.waitFor(() => expect(activity.creatingTab).toBe(false))
    expect(hostStores.workflow.tabs.get('workflows/Fresh.json')).toBe(undefined)
  })

  it('lowers the creating flag when a newer focus event supersedes the fetch', async () => {
    const bound = makeTab('wf-42')
    let resolveDraft: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/messages')) return json(202, ack('wf-42', 'm-1'))
        if (url.includes('/agent/threads'))
          return json(200, { threads: [], pagination: { page: 1 } })
        if (url.includes('workflow_id=wf-new')) {
          return new Promise<Response>((resolve) => {
            resolveDraft = resolve
          })
        }
        if (url.includes('/agent/draft')) return json(404, { error: 'none' })
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'Fresh',
      thread_id: 'th-1'
    })
    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() => expect(activity.creatingTab).toBe(true))

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    resolveDraft?.(json(404, { error: 'none' }))

    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(bound)
    )
    expect(activity.creatingTab).toBe(false)
    expect(hostStores.workflow.tabs.get('workflows/Fresh.json')).toBe(undefined)
  })

  it('pins the spinner to the tab that sent the turn, not the tab active at ack', async () => {
    makeTab('wf-42')
    const other = addTab('workflows/other.json')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/messages')) {
          hostStores.workflow.activeWorkflow = other
          return json(202, ack('wf-42', 'm-1'))
        }
        if (url.includes('/agent/threads'))
          return json(200, { threads: [], pagination: { page: 1 } })
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')
  })

  it('moves the spinner to the tab the agent creates mid-turn', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    await renderAndSend('work here')
    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(activity.editingTabPath).toBe('workflows/Video test.json')
    )
  })

  it('keeps the spinner on a tab renamed by the first-draft autosave', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })
    const renamedPath = 'workflows/Video test.app.json'
    workflowService.saveWorkflowAs.mockImplementationOnce(async (tab) => {
      const entry = hostStores.workflow.tabs.get(tab.path)
      hostStores.workflow.tabs.delete(tab.path)
      tab.isTemporary = false
      tab.isModified = false
      tab.path = renamedPath
      if (entry) hostStores.workflow.tabs.set(tab.path, entry)
      return true
    })

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })

    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() => expect(activity.editingTabPath).toBe(renamedPath))
  })

  it('re-arms a resumed turn spinner on the bound tab, not the active tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await sendFromComposer('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')

    unmount()
    expect(activity.editingTabPath).toBeNull()

    const other = addTab('workflows/other.json')
    useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
    hostStores.workflow.activeWorkflow = other
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/messages')) return json(200, [])
        if (url.includes('/agent/threads'))
          return json(200, { threads: [], pagination: { page: 1 } })
        return new Response('{}', { status: 200 })
      })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await vi.waitFor(() =>
      expect(activity.editingTabPath).toBe('workflows/current.json')
    )

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await vi.waitFor(() => expect(activity.editingTabPath).toBeNull())
  })

  it('pins the spinner via the snapshot tab when adoption has no sent context', async () => {
    makeTab()
    appMock.graph.nodes = [{ id: 1 }]
    mockMessagesEndpoint('wf-new', { status: 404, body: { error: 'none' } })

    await renderAndSend('build something')

    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() =>
      expect(activity.editingTabPath).toBe('workflows/current.json')
    )
  })

  it("sends the active tab's saved workflow id and applies patches in place", async () => {
    const tab = makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })

    tab.isModified = false
    const graph = { version: 0.4, nodes: [{ id: 1 }] }
    patch(1, graph)
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
    await vi.waitFor(() =>
      expect(workflowService.saveWorkflow).toHaveBeenCalledWith(tab)
    )
    expect(workflowService.saveWorkflowAs).not.toHaveBeenCalled()
    expect(vi.mocked(validateComfyWorkflow)).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
      workflow_id: 'wf-42',
      target: 'existing_tab'
    })
  })

  it('autosaves a minted tab so the next patch applies without a conflict', async () => {
    mockMessagesEndpoint('wf-42')
    const mintedPath = 'workflows/Unsaved Workflow.json'
    vi.mocked(app.loadGraphData).mockImplementation(
      async (_graph, _clean, _restore, workflowTab) => {
        if (workflowTab !== null) return
        const minted: FakeTab = {
          path: mintedPath,
          directory: 'workflows',
          filename: 'Unsaved Workflow',
          isTemporary: true,
          isModified: true,
          activeState: null
        }
        hostStores.workflow.tabs.set(minted.path, minted)
        hostStores.workflow.activeWorkflow = minted
      }
    )

    await renderAndSend('build me a workflow')

    patch(1, { version: 0.4, nodes: [{ id: 1 }] })
    await vi.waitFor(() => {
      expect(hostStores.workflow.tabs.get(mintedPath)?.isModified).toBe(false)
    })
    const minted = hostStores.workflow.tabs.get(mintedPath)
    expect(workflowService.saveWorkflowAs).toHaveBeenCalledWith(minted, {
      filename: 'Unsaved Workflow'
    })
    expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
      workflow_id: 'wf-42',
      target: 'new_tab'
    })

    const graph = { version: 0.4, nodes: [{ id: 1 }, { id: 2 }] }
    patch(2, graph)
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, minted)
    )
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()
  })

  it('a failed autosave keeps the applied draft and surfaces no apply error', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    executionErrors.showErrorOverlay.mockClear()
    workflowService.saveWorkflow.mockRejectedValueOnce(new Error('offline'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await renderAndSend('add an upscaler')

    tab.isModified = false
    patch(1, { version: 0.4, nodes: [{ id: 1 }] })
    await vi.waitFor(() =>
      expect(workflowService.saveWorkflow).toHaveBeenCalledWith(tab)
    )
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        `Agent draft autosave failed for ${tab.path}:`,
        expect.any(Error)
      )
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-42')).toBe(tab.path)
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()
  })

  it('autosave dodges an occupied app-mode save path and rebinds the renamed tab', async () => {
    mockMessagesEndpoint('wf-42')
    const occupant: FakeTab = {
      path: 'workflows/Unsaved Workflow.app.json',
      directory: 'workflows',
      filename: 'Unsaved Workflow',
      isTemporary: false,
      isModified: false,
      activeState: null
    }
    hostStores.workflow.tabs.set(occupant.path, occupant)
    const mintedPath = 'workflows/Unsaved Workflow.json'
    const renamedPath = 'workflows/Unsaved Workflow (2).app.json'
    workflowService.saveWorkflowAs.mockImplementationOnce(
      async (tab, options) => {
        const renamed = hostStores.workflow.tabs.get(tab.path)
        hostStores.workflow.tabs.delete(tab.path)
        tab.isTemporary = false
        tab.isModified = false
        tab.path = `workflows/${options?.filename}.app.json`
        if (renamed) hostStores.workflow.tabs.set(tab.path, renamed)
        return true
      }
    )
    vi.mocked(app.loadGraphData).mockImplementation(
      async (_graph, _clean, _restore, workflowTab) => {
        if (workflowTab !== null) return
        const minted: FakeTab = {
          path: mintedPath,
          directory: 'workflows',
          filename: 'Unsaved Workflow',
          isTemporary: true,
          isModified: true,
          activeState: null,
          initialMode: 'app'
        }
        hostStores.workflow.tabs.set(minted.path, minted)
        hostStores.workflow.activeWorkflow = minted
      }
    )

    await renderAndSend('build me a workflow')

    patch(1, { version: 0.4, nodes: [{ id: 1 }] })
    await vi.waitFor(() =>
      expect(workflowService.saveWorkflowAs).toHaveBeenCalledWith(
        hostStores.workflow.tabs.get(renamedPath),
        { filename: 'Unsaved Workflow (2)' }
      )
    )
    await vi.waitFor(() =>
      expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-42')).toBe(
        renamedPath
      )
    )
  })

  it('a save that fails after the service renames still rebinds the tab', async () => {
    mockMessagesEndpoint('wf-42')
    const mintedPath = 'workflows/Unsaved Workflow.json'
    const renamedPath = 'workflows/Unsaved Workflow.app.json'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    workflowService.saveWorkflowAs.mockImplementationOnce(async (tab) => {
      const renamed = hostStores.workflow.tabs.get(tab.path)
      hostStores.workflow.tabs.delete(tab.path)
      tab.path = renamedPath
      if (renamed) hostStores.workflow.tabs.set(tab.path, renamed)
      throw new Error('offline')
    })
    vi.mocked(app.loadGraphData).mockImplementation(
      async (_graph, _clean, _restore, workflowTab) => {
        if (workflowTab !== null) return
        const minted: FakeTab = {
          path: mintedPath,
          directory: 'workflows',
          filename: 'Unsaved Workflow',
          isTemporary: true,
          isModified: true,
          activeState: null,
          initialMode: 'app'
        }
        hostStores.workflow.tabs.set(minted.path, minted)
        hostStores.workflow.activeWorkflow = minted
      }
    )

    await renderAndSend('build me a workflow')

    patch(1, { version: 0.4, nodes: [{ id: 1 }] })
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        `Agent draft autosave failed for ${renamedPath}:`,
        expect.any(Error)
      )
    )
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-42')).toBe(
      renamedPath
    )
  })

  it('agent_active_tab activates the bound tab', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(tab)
    )
    expect(workflowService.saveWorkflowAs).not.toHaveBeenCalled()

    const draftStore = useAgentDraftStore()
    await vi.waitFor(() => expect(draftStore.version).toBe(3))
    expect(draftStore.workflowId).toBe('wf-42')
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        { version: 0.4, nodes: [{ id: 1 }] },
        true,
        true,
        tab
      )
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)

    const nextGraph = { version: 0.4, nodes: [{ id: 1 }, { id: 2 }] }
    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 3,
      version: 4,
      content: nextGraph
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(nextGraph, true, true, tab)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(2)
    expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
      workflow_id: 'wf-42',
      target: 'active_tab_switch'
    })
  })

  it('agent_active_tab opens an unknown workflow as a named tab and adopts its draft base', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalled()
    )
    const minted = hostStores.workflow.tabs.get('workflows/Video test.json')
    expect(minted?.filename).toBe('Video test')
    await vi.waitFor(() =>
      expect(workflowService.saveWorkflowAs).toHaveBeenCalledWith(minted, {
        filename: 'Video test'
      })
    )

    const draftStore = useAgentDraftStore()
    await vi.waitFor(() => expect(draftStore.version).toBe(3))
    expect(app.loadGraphData).not.toHaveBeenCalled()

    const nextGraph = { version: 0.4, nodes: [{ id: 1 }, { id: 2 }] }
    ws.emit('draft_patch', {
      workflow_id: 'wf-77',
      base_version: 3,
      version: 4,
      content: nextGraph
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        nextGraph,
        true,
        true,
        minted
      )
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
      workflow_id: 'wf-77',
      target: 'active_tab_open'
    })
  })

  it('agent_active_tab sanitizes slashes and falls back on empty names', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-88',
      name: 'a/b',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(hostStores.workflow.tabs.get('workflows/a-b.json')).toBeDefined()
    )

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-89',
      name: '  ',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Unsaved Workflow.json')
      ).toBeDefined()
    )
  })

  it('agent_active_tab with no stored draft opens a blank named tab without an error', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'not found' } })
    executionErrors.showErrorOverlay.mockClear()

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-90',
      name: 'Fresh tab',
      thread_id: 'th-1'
    })

    await vi.waitFor(() => {
      const minted = hostStores.workflow.tabs.get('workflows/Fresh tab.json')
      expect(minted).toBeDefined()
      expect(workflowService.saveWorkflowAs).toHaveBeenCalledWith(minted, {
        filename: 'Fresh tab'
      })
    })
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useAgentDraftStore().workflowId).toBe('wf-90')
  })

  it('agent_active_tab surfaces a draft fetch failure, opens nothing, and rebinds for self-heal', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 500, body: { error: 'boom' } })
    executionErrors.showErrorOverlay.mockClear()

    await renderAndSend('work here')

    const tabsBefore = hostStores.workflow.tabs.size
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-91',
      name: 'Broken',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalled()
    )
    expect(hostStores.workflow.tabs.size).toBe(tabsBefore)
    expect(useAgentDraftStore().workflowId).toBe('wf-91')
  })

  it('agent_active_tab rejects an invalid draft without minting a tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    executionErrors.showErrorOverlay.mockClear()
    vi.mocked(validateComfyWorkflow).mockImplementationOnce(
      async (_content, onError) => {
        onError?.('bad graph')
        return null
      }
    )

    await renderAndSend('work here')

    const tabsBefore = hostStores.workflow.tabs.size
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-92',
      name: 'Invalid',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalled()
    )
    expect(hostStores.workflow.tabs.size).toBe(tabsBefore)
  })

  it('agent_active_tab opens an empty draft as a blank named tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', {
      status: 200,
      body: { content: { version: 0.4, nodes: [] }, version: 1 }
    })
    executionErrors.showErrorOverlay.mockClear()

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-93',
      name: 'Blank slate',
      thread_id: 'th-1'
    })

    await vi.waitFor(() => {
      const minted = hostStores.workflow.tabs.get('workflows/Blank slate.json')
      expect(minted).toBeDefined()
      expect(hostStores.workflow.activeWorkflow).toBe(minted)
    })
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useAgentDraftStore().version).toBe(1)
  })

  it('switching back to a tab that missed a patch renders the fetched newer draft once', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42', {
      status: 200,
      body: {
        content: { version: 0.4, nodes: [{ id: 1 }, { id: 9 }] },
        version: 4
      }
    })

    await renderAndSend('work here')

    const draftStore = useAgentDraftStore()
    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 2,
      version: 3,
      content: { version: 0.4, nodes: [{ id: 1 }] }
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        { version: 0.4, nodes: [{ id: 1 }] },
        true,
        true,
        tab
      )
    )
    vi.mocked(app.loadGraphData).mockClear()

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        { version: 0.4, nodes: [{ id: 1 }, { id: 9 }] },
        true,
        true,
        tab
      )
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
    expect(draftStore.version).toBe(4)
  })

  it('a failed unbound fetch still moves the binding so the next patch self-heals', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 500, body: { error: 'boom' } })
    executionErrors.showErrorOverlay.mockClear()

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-94',
      name: 'Recovers',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalled()
    )
    expect(useAgentDraftStore().workflowId).toBe('wf-94')

    const graph = { version: 0.4, nodes: [{ id: 5 }] }
    ws.emit('draft_patch', {
      workflow_id: 'wf-94',
      base_version: 0,
      version: 1,
      content: graph
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, null)
    )
  })

  it('agent_active_tab strips dotfile prefixes hidden behind whitespace', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-95',
      name: ' .hidden',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/hidden.json')
      ).toBeDefined()
    )
  })

  it('returning to a workflow whose draft matches the rendered version does not re-render', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42', {
      status: 200,
      body: { content: { version: 0.4, nodes: [{ id: 1 }] }, version: 3 }
    })

    await renderAndSend('work here')

    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 2,
      version: 3,
      content: { version: 0.4, nodes: [{ id: 1 }] }
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        { version: 0.4, nodes: [{ id: 1 }] },
        true,
        true,
        tab
      )
    )

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-away',
      name: 'Detour',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Detour.json')
      ).toBeDefined()
    )
    vi.mocked(app.loadGraphData).mockClear()

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(tab)
    )
    await new Promise((resolve) => setTimeout(resolve))
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('two unnamed agent tabs mint distinct tabs with distinct bindings', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    await renderAndSend('work here')

    ws.emit('agent_active_tab', { workflow_id: 'wf-a', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Unsaved Workflow.json')
      ).toBeDefined()
    )
    ws.emit('agent_active_tab', { workflow_id: 'wf-b', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Unsaved Workflow (2).json')
      ).toBeDefined()
    )
    expect(workflowService.saveWorkflowAs).toHaveBeenCalledTimes(2)

    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() =>
      expect(activity.editingTabPath).toBe(
        'workflows/Unsaved Workflow (2).json'
      )
    )
    ws.emit('agent_active_tab', { workflow_id: 'wf-a', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(activity.editingTabPath).toBe('workflows/Unsaved Workflow.json')
    )
  })

  it('a bound-branch draft fetch failure keeps the switch and moves the binding', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 500, body: { error: 'boom' } })
    executionErrors.showErrorOverlay.mockClear()

    await renderAndSend('work here')

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(tab)
    )
    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalled()
    )
    expect(useAgentDraftStore().workflowId).toBe('wf-42')

    const nextGraph = { version: 0.4, nodes: [{ id: 1 }, { id: 2 }] }
    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 0,
      version: 1,
      content: nextGraph
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(nextGraph, true, true, tab)
    )
  })

  it('a slow tab activation cannot finish after a newer focus event', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    let resolveSlowOpen: (() => void) | undefined
    workflowService.openWorkflow.mockImplementationOnce(
      async (slow: { path: string }) => {
        await new Promise<void>((resolve) => {
          resolveSlowOpen = resolve
        })
        const known = hostStores.workflow.tabs.get(slow.path)
        if (known) hostStores.workflow.activeWorkflow = known
      }
    )

    await renderAndSend('work here')

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() => expect(resolveSlowOpen).toBeDefined())
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-quick',
      name: 'Quick tab',
      thread_id: 'th-1'
    })

    await new Promise((resolve) => setTimeout(resolve))
    expect(workflowService.openWorkflow).toHaveBeenCalledTimes(1)
    expect(hostStores.workflow.tabs.get('workflows/Quick tab.json')).toBe(
      undefined
    )
    resolveSlowOpen?.()
    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Quick tab.json')
      ).toBeDefined()
    )
    await new Promise((resolve) => setTimeout(resolve))

    expect(hostStores.workflow.activeWorkflow?.filename).toBe('Quick tab')
    expect(tab).not.toBe(hostStores.workflow.activeWorkflow)
  })

  it('a stale agent_active_tab resolving late cannot steal focus from the newest', async () => {
    makeTab('wf-42')
    const bodies: unknown[] = []
    let resolveSlowDraft: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages')) {
          bodies.push(JSON.parse(String(init?.body)))
          return new Response(
            JSON.stringify(ack('wf-42', `m-${bodies.length}`)),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (url.includes('/agent/threads')) {
          return json(200, { threads: [], pagination: { page: 1 } })
        }
        if (url.includes('workflow_id=wf-slow')) {
          return new Promise<Response>((resolve) => {
            resolveSlowDraft = resolve
          })
        }
        if (url.includes('/agent/draft')) {
          return new Response(
            JSON.stringify({
              content: { version: 0.4, nodes: [{ id: 1 }] },
              version: 3
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-slow',
      name: 'Slow tab',
      thread_id: 'th-1'
    })
    await vi.waitFor(() => expect(resolveSlowDraft).toBeDefined())
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-fast',
      name: 'Fast tab',
      thread_id: 'th-1'
    })
    resolveSlowDraft?.(
      new Response(
        JSON.stringify({
          content: { version: 0.4, nodes: [{ id: 1 }] },
          version: 3
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Fast tab.json')
      ).toBeDefined()
    )
    await new Promise((resolve) => setTimeout(resolve))

    expect(hostStores.workflow.tabs.get('workflows/Slow tab.json')).toBe(
      undefined
    )
    expect(hostStores.workflow.activeWorkflow?.filename).toBe('Fast tab')
    expect(useAgentDraftStore().workflowId).toBe('wf-fast')
  })

  it('an activation superseded before it starts does nothing at all', async () => {
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-a',
      name: 'A tab',
      thread_id: 'th-1'
    })
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-b',
      name: 'B tab',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(hostStores.workflow.tabs.get('workflows/B tab.json')).toBeDefined()
    )
    await new Promise((resolve) => setTimeout(resolve))

    expect(hostStores.workflow.tabs.get('workflows/A tab.json')).toBe(undefined)
    expect(useAgentDraftStore().workflowId).toBe('wf-b')
  })

  it('a newer focus event during autosave stops the older activation before binding', async () => {
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    let resolveSlowSave: (() => void) | undefined
    workflowService.saveWorkflowAs.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        resolveSlowSave = resolve
      })
      return true
    })

    await renderAndSend('work here')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-old',
      name: 'Old tab',
      thread_id: 'th-1'
    })
    await vi.waitFor(() => expect(resolveSlowSave).toBeDefined())
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'New tab',
      thread_id: 'th-1'
    })
    resolveSlowSave?.()

    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/New tab.json')
      ).toBeDefined()
    )
    await new Promise((resolve) => setTimeout(resolve))

    expect(useAgentDraftStore().workflowId).toBe('wf-new')
    expect(hostStores.workflow.activeWorkflow?.filename).toBe('New tab')
    expect(telemetry.trackAgentWorkflowApplied).not.toHaveBeenCalledWith({
      workflow_id: 'wf-old',
      target: 'active_tab_open'
    })
  })

  it('a bound activation whose draft fetch resolves after a newer focus event adopts nothing', async () => {
    const tab = makeTab('wf-42')
    let resolveSlowDraft: ((response: Response) => void) | undefined
    let deferDraft = false
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages')) {
          bodies.push(JSON.parse(String(init?.body)))
          return new Response(
            JSON.stringify(ack('wf-42', `m-${bodies.length}`)),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (url.includes('/agent/threads')) {
          return json(200, { threads: [], pagination: { page: 1 } })
        }
        if (deferDraft && url.includes('workflow_id=wf-42')) {
          return new Promise<Response>((resolve) => {
            resolveSlowDraft = resolve
          })
        }
        if (url.includes('/agent/draft')) {
          return json(404, { error: 'none' })
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('work here')

    deferDraft = true
    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() => expect(resolveSlowDraft).toBeDefined())
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-quick',
      name: 'Quick tab',
      thread_id: 'th-1'
    })
    resolveSlowDraft?.(
      new Response(
        JSON.stringify({
          content: { version: 0.4, nodes: [{ id: 99 }] },
          version: 5
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Quick tab.json')
      ).toBeDefined()
    )
    await new Promise((resolve) => setTimeout(resolve))

    expect(app.loadGraphData).not.toHaveBeenCalledWith(
      { version: 0.4, nodes: [{ id: 99 }] },
      true,
      true,
      tab
    )
    expect(telemetry.trackAgentWorkflowApplied).not.toHaveBeenCalledWith({
      workflow_id: 'wf-42',
      target: 'active_tab_switch'
    })
    expect(hostStores.workflow.activeWorkflow?.filename).toBe('Quick tab')
  })

  it('re-activating the current tab with no newer server draft keeps the rendered state', async () => {
    makeTab('wf-42')
    const patchContent = { version: 0.4, nodes: [{ id: 1 }] }
    mockMessagesEndpoint('wf-42', {
      status: 200,
      body: {
        content: { version: 0.4, nodes: [{ id: 1 }, { id: 2 }] },
        version: 3
      }
    })

    await renderAndSend('work here')

    patch(3, patchContent)
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(1))
    vi.mocked(app.loadGraphData).mockClear()

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
        workflow_id: 'wf-42',
        target: 'active_tab_switch'
      })
    )
    await new Promise((resolve) => setTimeout(resolve))

    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(useAgentDraftStore().version).toBe(3)
    expect(useAgentDraftStore().content).toEqual(patchContent)
  })

  it('a bound activation with no server draft switches without adopting or erroring', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42', { status: 404, body: { error: 'none' } })

    await renderAndSend('work here')

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
        workflow_id: 'wf-42',
        target: 'active_tab_switch'
      })
    )

    expect(workflowService.openWorkflow).toHaveBeenCalledWith(tab)
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useAgentDraftStore().workflowId).toBe('wf-42')
    expect(useAgentDraftStore().version).toBe(null)
  })

  it('reports only the bound tab in the snapshot when a second tab is unbound', async () => {
    makeTab('wf-42')
    addTab('workflows/scratch.json', {
      activeState: { id: 'graph-internal-id-not-a-cloud-id' }
    })
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }],
      current_tab: 'wf-42'
    })
  })

  it('a bound workflow follows its unchanged content to a renamed tab', async () => {
    makeTab('wf-42')
    appMock.graph.nodes = [{ id: 1 }]
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')
    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    const duck = addTab('workflows/duck.json')
    hostStores.workflow.activeWorkflow = duck

    await sendFromComposer('second message')

    expect(bodies[1]).toMatchObject({
      workflow_id: 'wf-42',
      open_tabs: [{ workflow_id: 'wf-42', name: 'duck' }],
      current_tab: 'wf-42'
    })
    expect(bodies[1]).toHaveProperty('draft')
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-42')).toBe(
      'workflows/duck.json'
    )
  })

  it('a changed graph does not reclaim the binding for a new tab', async () => {
    makeTab('wf-42')
    appMock.graph.nodes = [{ id: 1 }]
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')
    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    const scratch = addTab('workflows/scratch.json')
    hostStores.workflow.activeWorkflow = scratch
    appMock.graph.nodes = [{ id: 2 }]

    await sendFromComposer('second message')

    expect(bodies[1]).not.toHaveProperty('workflow_id')
    expect(bodies[1]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
    expect(bodies[1]).not.toHaveProperty('current_tab')
  })

  it('retries without the draft when the server rejects the upload, then re-arms it', async () => {
    makeTab('wf-42')
    appMock.graph.nodes = [{ id: 1 }]
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!url.includes('/messages'))
          return new Response('{}', { status: 200 })
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (body.draft !== undefined) {
          return new Response(
            JSON.stringify({ error: 'internal server error' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
        return new Response(
          JSON.stringify(ack('wf-42', `m-${bodies.length}`)),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    await renderAndSend('first message')

    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toHaveProperty('draft')
    expect(bodies[1]).not.toHaveProperty('draft')

    await settleTurnAndSend('m-2', 'second message')

    expect(bodies[2]).toHaveProperty('draft')
  })

  it('refreshes the cloud index before each send, not just on mount', async () => {
    makeTab()
    const bodies: unknown[] = []
    let workflowsCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init?.body)))
          return new Response(JSON.stringify(ack('wf-cloud-current', 'm-1')), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        if (url.includes('/workflows')) {
          workflowsCalls += 1
          const data =
            workflowsCalls === 1
              ? []
              : [{ id: 'wf-cloud-current', name: 'current' }]
          return new Response(
            JSON.stringify({
              data,
              pagination: {
                offset: 0,
                limit: 100,
                total: data.length,
                has_more: false
              }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-cloud-current' })
  })

  it('does not resolve two same-named open saved tabs to one cloud id', async () => {
    makeTab()
    addTab('workflows/archive/current.json')
    const bodies = mockMessagesEndpoint(
      'wf-fresh',
      { status: 404, body: { error: 'none' } },
      [{ id: 'wf-cloud-current', name: 'current' }]
    )

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
  })

  it('excludes ambiguous and nameless cloud records from resolution', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint(
      'wf-fresh',
      { status: 404, body: { error: 'none' } },
      [
        { id: 'wf-a', name: 'current' },
        { id: 'wf-b', name: 'current' },
        { id: 'wf-nameless' } as { id: string; name: string }
      ]
    )

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
  })

  it('falls back to bindings when the cloud index request fails', async () => {
    makeTab('wf-42')
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init?.body)))
          return new Response(JSON.stringify(ack('wf-42', 'm-1')), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        if (url.includes('/workflows')) {
          return json(500, { error: 'internal server error' })
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
  })

  it('resolves saved tabs to their cloud workflow ids by name', async () => {
    makeTab()
    addTab('workflows/side.json')
    const bodies = mockMessagesEndpoint(
      'wf-cloud-current',
      { status: 404, body: { error: 'none' } },
      [
        { id: 'wf-cloud-current', name: 'current' },
        { id: 'wf-cloud-side', name: 'side' }
      ]
    )

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-cloud-current',
      open_tabs: [
        { workflow_id: 'wf-cloud-current', name: 'current' },
        { workflow_id: 'wf-cloud-side', name: 'side' }
      ],
      current_tab: 'wf-cloud-current'
    })
  })

  it('does not resolve temporary tabs through the cloud workflow index', async () => {
    const tab = makeTab()
    tab.isTemporary = true
    const bodies = mockMessagesEndpoint(
      'wf-fresh',
      { status: 404, body: { error: 'none' } },
      [{ id: 'wf-cloud-current', name: 'current' }]
    )

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
  })

  it('agent_active_tab with a cloud id activates the open saved tab without minting', async () => {
    makeTab()
    addTab('workflows/temp/duck.json', { isTemporary: true })
    const duck = addTab('workflows/duck.json')
    mockMessagesEndpoint(
      'wf-cloud-current',
      { status: 404, body: { error: 'none' } },
      [
        { id: 'wf-cloud-current', name: 'current' },
        { id: 'wf-cloud-duck', name: 'duck' }
      ]
    )

    await renderAndSend('first message')

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-cloud-duck',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(duck)
    )
    expect(hostStores.workflow.tabs.get('workflows/duck (2).json')).toBe(
      undefined
    )
  })

  it('sends every open tab that has a cloud id with the message', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }],
      current_tab: 'wf-42'
    })
  })

  it('includes a backgrounded tab whose binding was persisted before a reload', async () => {
    localStorage.setItem(
      'Comfy.Agent.WorkflowTabBindings',
      JSON.stringify({ 'wf-old': 'workflows/mountain.json' })
    )
    makeTab('wf-42')
    addTab('workflows/mountain.json')
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [
        { workflow_id: 'wf-42', name: 'current' },
        { workflow_id: 'wf-old', name: 'mountain' }
      ],
      current_tab: 'wf-42'
    })
  })

  it('omits the snapshot entirely when no open tab has a cloud id', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('open_tabs')
    expect(bodies[0]).not.toHaveProperty('current_tab')
  })

  it('omits current_tab from the snapshot when the active tab has no cloud id', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42', {
      status: 404,
      body: { error: 'none' }
    })

    await renderAndSend('first message')
    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    const scratch = addTab('workflows/Scratch.json', { isTemporary: true })
    hostStores.workflow.activeWorkflow = scratch

    await sendFromComposer('second message')

    expect(bodies[1]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
    expect(bodies[1]).not.toHaveProperty('current_tab')
  })

  it('stages a mention pick once and reports the tag gesture', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    appMock.graph.nodes = [{ id: 7, title: 'KSampler' }]

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.mention') })
    )
    await userEvent.click(await screen.findByText('KSampler'))

    expect(await screen.findByText('KSampler')).toBeInTheDocument()
    expect(telemetry.trackAgentNodeTagged).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentNodeTagged).toHaveBeenCalledWith({
      source: 'mention_picker'
    })
  })

  it('does not report a mention pick that stages nothing', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    appMock.graph.nodes = [{ id: 7, title: 'KSampler' }]

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    useAgentPanelStore().isOpen = true
    hostStores.canvas.selectedItems = [
      { isNodeFake: true, id: 7, title: 'KSampler' }
    ]
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.mention') })
    )
    const matches = await screen.findAllByText('KSampler')
    await userEvent.click(matches[matches.length - 1])

    expect(telemetry.trackAgentNodeTagged).not.toHaveBeenCalled()
  })

  it('sends no workflow id for an unbound tab and posts exactly once', async () => {
    const tab = makeTab()
    tab.activeState = { id: 'graph-internal-id-not-a-cloud-id' }
    appMock.graph.nodes = [{ id: 1 }]
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!url.includes('/messages'))
          return new Response('{}', { status: 200 })
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        if (body.workflow_id !== undefined) {
          return json(403, { error: 'workflow not found or access denied' })
        }
        return new Response(JSON.stringify(ack('wf-fresh', 'm-1')), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    await renderAndSend('build a graph')

    expect(bodies).toHaveLength(1)
    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
    expect(bodies[0]).not.toHaveProperty('current_tab')

    const graph = { version: 0.4, nodes: [{ id: 9 }] }
    ws.emit('draft_patch', {
      workflow_id: 'wf-fresh',
      base_version: 0,
      version: 1,
      content: graph
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
  })

  it('parks a patch for a backgrounded bound tab and applies it on refocus', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    const other = addTab('workflows/other.json')
    hostStores.workflow.activeWorkflow = other

    const graph = { version: 0.4, nodes: [{ id: 3 }] }
    patch(1, graph)
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()

    hostStores.workflow.activeWorkflow = tab
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)
  })

  it("leaves the edited tab alone when the user picks 'Open new tab'", async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    tab.isModified = true
    const graph = { version: 0.4, nodes: [{ id: 4 }] }
    patch(1, graph)
    await screen.findByText(i18n.global.t('agent.conflictTitle'))

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

    await renderAndSend('add an upscaler')

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [{ id: 2 }] })
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('g.close') })
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    await userEvent.type(screen.getByRole('textbox'), 'go ahead')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(
      await screen.findByText(i18n.global.t('agent.conflictTitle'))
    ).toBeInTheDocument()
  })

  it('drops the parked draft when a new chat starts', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [{ id: 2 }] })
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('g.cancel') })
    )

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    patch(2, { version: 0.4, nodes: [{ id: 6 }] })
    await nextTick()
    await nextTick()
    tab.isModified = false

    await sendFromComposer('fresh start')
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()

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

    await userEvent.click(
      screen.getAllByRole('button', { name: i18n.global.t('agent.remove') })[0]
    )
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()

    await sendFromComposer('decode it')

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['7'] } })
    expect(telemetry.trackAgentMessageSent).toHaveBeenCalledWith({
      attachment_count: 0,
      node_tag_count: 1
    })
    expect(screen.getByText('VAEDecode')).toBeInTheDocument()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
  })

  it('raises the conflict dialog on a user-edited bound tab and honors the choice', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [{ id: 1 }] })
    expect(
      await screen.findByText(i18n.global.t('agent.conflictTitle'))
    ).toBeInTheDocument()
    expect(app.loadGraphData).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('g.cancel') })
    )
    patch(2, { version: 0.4, nodes: [{ id: 1 }] })
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
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

    await renderAndSend('add an upscaler')

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [{ id: 1 }] })
    await screen.findByText(i18n.global.t('agent.conflictTitle'))
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.keepMine') })
    )

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })
    await userEvent.type(screen.getByRole('textbox'), 'something else')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await nextTick()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()

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

    await sendFromComposer('tweak the sampler')

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['5'] } })
    expect(
      screen.queryByRole('button', { name: i18n.global.t('agent.remove') })
    ).not.toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })
  it('coalesces patches that stream faster than the canvas apply settles', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

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

    patch(2, { version: 0.4, nodes: [{ id: 2 }] })
    await nextTick()
    patch(3, { version: 0.4, nodes: [{ id: 3 }] })
    await nextTick()
    expect(app.loadGraphData).toHaveBeenCalledTimes(1)

    releaseApply()
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(2))
    expect(vi.mocked(app.loadGraphData).mock.calls[1][0]).toEqual({
      version: 0.4,
      nodes: [{ id: 3 }]
    })
    expect(vi.mocked(app.loadGraphData).mock.calls[1][3]).toBe(tab)
  })
  it('parks an empty minted draft, then applies the first real patch to the uploading tab', async () => {
    const tab = makeTab()
    appMock.graph.nodes = [{ id: 1 }]
    mockMessagesEndpoint('wf-42')

    await renderAndSend('hi')

    patch(1, { version: 0.4, nodes: [] })
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()

    const graph = { version: 0.4, nodes: [{ id: 1 }] }
    patch(2, graph)
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
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
    expect(
      screen.getByRole('button', { name: i18n.global.t('agent.remove') })
    ).toBeInTheDocument()

    await sendFromComposer('explain this')

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['9'] } })
  })

  it('resolves @ picker nodes from the viewed subgraph, not the root graph', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.canvas = {
      graph: { nodes: [{ id: 12, title: 'KSampler' }] }
    }

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.mention') })
    )
    await userEvent.click(await screen.findByText('KSampler'))
    await sendFromComposer('explain this')

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['12'] } })
  })

  it('uploads the canvas once per change and binds the minted id for in-place applies', async () => {
    const tab = makeTab()
    const bodies = mockMessagesEndpoint('wf-mint')
    appMock.graph.nodes = [{ id: 1 }]

    await renderAndSend('help me')

    expect(bodies[0]).toMatchObject({
      draft: {
        content: { version: 0.4, nodes: [{ id: 1 }] },
        version: null
      }
    })
    expect(bodies[0]).not.toHaveProperty('workflow_id')

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    await userEvent.type(screen.getByRole('textbox'), 'and more')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).not.toHaveProperty('draft')

    const graph = { version: 0.4, nodes: [{ id: 2 }] }
    ws.emit('draft_patch', {
      workflow_id: 'wf-mint',
      base_version: 0,
      version: 1,
      content: graph
    })
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(graph, true, true, tab)
    )
  })

  it('parks an empty draft even for the bound tab', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('help me')

    tab.isModified = true
    patch(1, { version: 0.4, nodes: [] })
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(
      screen.queryByText(i18n.global.t('agent.conflictTitle'))
    ).not.toBeInTheDocument()
  })

  it('re-uploads the canvas after a failed send', async () => {
    makeTab()
    appMock.graph.nodes = [{ id: 1 }]
    const bodies: unknown[] = []
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!url.includes('/messages') || init?.method !== 'POST')
          return new Response('{}', { status: 200 })
        calls += 1
        bodies.push(JSON.parse(String(init?.body)))
        if (calls <= 2) return new Response('{}', { status: 500 })
        return new Response(JSON.stringify(ack('wf-mint', 'm-1')), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.type(screen.getByRole('textbox'), 'one')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[0]).toHaveProperty('draft')
    expect(bodies[1]).not.toHaveProperty('draft')

    await userEvent.type(screen.getByRole('textbox'), 'two')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(bodies).toHaveLength(3))
    expect(bodies[2]).toHaveProperty('draft')
  })
})
