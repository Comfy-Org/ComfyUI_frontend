import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

vi.mock('./components/agent/message/AgentMessage.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: { message: { type: Object, required: true } },
      emits: ['feedback'],
      setup(_props, { emit }) {
        return () =>
          h(
            'button',
            { type: 'button', onClick: () => emit('feedback', 'up') },
            'Helpful'
          )
      }
    })
  }
})

vi.mock('./components/agent/OnboardingCoach.vue', () => ({
  default: { template: '<div />' }
}))

vi.mock('./crdt/CrdtDevPanel.vue', () => ({
  default: { template: '<div />' }
}))

vi.mock('./crdt/mintPortWiring', () => ({
  attachMintPortWiring: () => ({ detach: vi.fn() })
}))

vi.mock('./crdt/useAgentCrdtFollower', async () => {
  const { reactive } = await import('vue')
  return {
    useAgentCrdtFollower: () => ({
      status: reactive({
        enabled: false,
        connected: false,
        workflowId: null,
        updatesApplied: 0,
        lastFrameType: null
      }),
      enqueueHumanOperations: vi.fn()
    })
  }
})

import { i18n } from '@/i18n'
import { app } from '@/scripts/app'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

const getServerFeature = vi.hoisted(() =>
  vi.fn((_name: string, defaultValue?: unknown) => defaultValue)
)
const focusNodeInstance = vi.hoisted(() => vi.fn())
const MockLGraphNode = vi.hoisted(
  () =>
    class MockLGraphNode {
      readonly boundingRect = {}
      readonly type: string
      graph?: { id?: string }

      constructor(
        public id: number | string,
        public title: string
      ) {
        this.type = title
      }
    }
)

vi.mock('@/composables/canvas/useFocusNode', () => ({
  useFocusNode: () => ({ focusNodeInstance })
}))

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
    apiURL: (route: string) => `/api${route}`,
    fetchApi: (route: string, options?: RequestInit) =>
      fetch(route.startsWith('/api') ? route : `/api${route}`, options),
    getServerFeature,
    socket: { readyState: 1 },
    addEventListener: ws.add,
    removeEventListener: ws.remove,
    addCustomEventListener: ws.add,
    removeCustomEventListener: ws.remove
  }
}))

type MockCanvas = {
  graph: {
    nodes: unknown[]
    getNodeById: (id: string) => unknown | null
  }
  selectedItems: Set<unknown>
  selectItems: ReturnType<typeof vi.fn>
  deselect: (node: unknown) => void
  deselectAll: ReturnType<typeof vi.fn>
  multi_select: boolean
  allow_dragnodes: boolean
  selectOnly: boolean
  canvas: { focus: ReturnType<typeof vi.fn> }
}

type MockGraph = {
  nodes: unknown[]
  getNodeById: (id: string | number) => unknown | null
}

type AppMock = {
  loadGraphData: ReturnType<typeof vi.fn>
  graph: MockGraph
  rootGraph: MockGraph
  canvas: MockCanvas | undefined
}

const appMock = vi.hoisted((): AppMock => {
  const nodes: unknown[] = []
  const graph = {
    nodes,
    getNodeById: (id: string | number) =>
      graph.nodes.find(
        (node) =>
          typeof node === 'object' &&
          node !== null &&
          'id' in node &&
          String(node.id) === String(id)
      ) ?? null
  }
  return {
    loadGraphData: vi.fn(),
    graph,
    rootGraph: graph,
    canvas: undefined
  }
})

vi.mock('@/scripts/app', () => ({ app: appMock }))

const assetsStore = vi.hoisted(() => ({
  updateInputs: vi.fn(async () => [])
}))
vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => assetsStore
}))

const sidebarStore = vi.hoisted(() => ({
  activeSidebarTabId: null
}))
vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => sidebarStore
}))

const toastStore = vi.hoisted(() => {
  const messagesToAdd: unknown[] = []
  return {
    messagesToAdd,
    add: vi.fn((message: unknown) => messagesToAdd.push(message))
  }
})
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => toastStore
}))

type FakeTab = {
  path: string
  directory: string
  filename: string
  isTemporary: boolean
  isPersisted: boolean
  isModified: boolean
  activeState: { id?: string } | null
}
type HostStores = {
  workflow: {
    activeWorkflow: FakeTab | null
    openWorkflows: FakeTab[]
    tabs: Map<string, FakeTab>
    getWorkflowByPath: (path: string) => FakeTab | null
    nodeToNodeLocatorId: (node: {
      graph?: { id?: string }
      id: string | number
    }) => string
  }
  canvas: {
    selectedItems: unknown[]
    updateSelectedItems: () => void
    currentGraph: unknown | null
    canvas: unknown
  }
}
const hostStores: HostStores = vi.hoisted(() => ({
  workflow: {
    activeWorkflow: null,
    openWorkflows: [],
    tabs: new Map(),
    getWorkflowByPath: () => null,
    nodeToNodeLocatorId: (node) => String(node.id)
  },
  canvas: {
    selectedItems: [],
    updateSelectedItems: () => {},
    currentGraph: null,
    canvas: undefined
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { reactive } = await import('vue')
  const tabs = new Map<string, FakeTab>()
  const activeWorkflow: FakeTab | null = null
  const store = reactive({
    activeWorkflow,
    get openWorkflows() {
      return Array.from(tabs.values())
    },
    tabs,
    getWorkflowByPath: (path: string) => tabs.get(path) ?? null,
    nodeToNodeLocatorId: (node: {
      graph?: { id?: string }
      id: string | number
    }) => (node.graph?.id ? `${node.graph.id}:${node.id}` : String(node.id)),
    closeWorkflow: vi.fn(async (tab: FakeTab) => {
      tabs.delete(tab.path)
    }),
    createTemporary: (path?: string, data?: { id?: string }) => {
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
        isPersisted: false,
        isModified: false,
        activeState: data ?? null
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
  const updateSelectedItems = () => {
    hostStores.canvas.selectedItems = [...(appMock.canvas?.selectedItems ?? [])]
  }
  const selectedItems: unknown[] = []
  const currentGraph: unknown | null = null
  const canvas: unknown = undefined
  const store = reactive({
    selectedItems,
    updateSelectedItems,
    currentGraph,
    canvas
  })
  hostStores.canvas = store
  return { useCanvasStore: () => store }
})

const workflowService = vi.hoisted(() => ({
  openWorkflow: vi.fn(async (tab: { path: string }) => {
    const known = hostStores.workflow.tabs.get(tab.path)
    if (known) hostStores.workflow.activeWorkflow = known
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => workflowService
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: (item: unknown) => item instanceof MockLGraphNode
}))

type MockPromptError = {
  type: string
  message: string
  details: string
}
type ExecutionErrors = {
  lastPromptError: MockPromptError | null
  recordPromptError: (error: MockPromptError) => void
  showErrorOverlay: ReturnType<typeof vi.fn>
}
const executionErrors = vi.hoisted((): ExecutionErrors => {
  const lastPromptError: MockPromptError | null = null
  const store: ExecutionErrors = {
    lastPromptError,
    recordPromptError(error: MockPromptError) {
      store.lastPromptError = error
    },
    showErrorOverlay: vi.fn()
  }
  return store
})

vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => executionErrors
}))

const currentUser = vi.hoisted(() => ({
  resolvedUserInfo: { value: { id: 'user-1' } },
  userDisplayName: { value: 'Jo Rivera' }
}))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => currentUser
}))

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
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'

import AgentPanelRoot from './AgentPanelRoot.vue'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  ws.clear()
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  localStorage.clear()
  hostStores.workflow.tabs.clear()
  hostStores.workflow.activeWorkflow = null
  hostStores.canvas.selectedItems = []
  hostStores.canvas.currentGraph = null
  sidebarStore.activeSidebarTabId = null
  executionErrors.lastPromptError = null
  toastStore.messagesToAdd.length = 0
  appMock.graph.nodes = []
  Object.assign(appMock.rootGraph, { subgraphs: new Map() })
  appMock.canvas = undefined
})

const zAgentWsEventForTest = (raw: unknown): AgentChatEvent =>
  zAgentWsEvent.parse(raw)

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

function addTab(path: string, overrides: Partial<FakeTab> = {}): FakeTab {
  const slash = path.lastIndexOf('/')
  const tab: FakeTab = {
    path,
    directory: path.slice(0, slash),
    filename: path.slice(slash + 1).replace(/\.json$/, ''),
    isTemporary: false,
    isPersisted: true,
    isModified: false,
    activeState: null,
    ...overrides
  }
  hostStores.workflow.tabs.set(tab.path, tab)
  return tab
}

describe('AgentPanelRoot session notices', () => {
  it('surfaces a session error notice via the host error modal, not a toast', async () => {
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
    ws.emit('agent_message_done', {})
    await nextTick()

    expect(toastStore.messagesToAdd).toHaveLength(0)
    expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_api_failed',
      details: i18n.global.t('agent.malformedEvent')
    })
  })
})

// happy-dom aliases DragEvent to Event, dropping any dataTransfer init, and its
// DataTransfer.types reports item MIME types rather than the browser's 'Files'
// marker the panel tests for, so the payload is hand-built.
// Returns whether the panel claimed the event, which is what the graph loader
// checks before opening a dropped workflow.
function dispatchDrag(
  target: Element,
  type: 'dragenter' | 'dragleave' | 'dragover' | 'drop',
  data: { files?: File[]; types?: string[]; getData?: (t: string) => string }
): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: data.files ?? [],
      types: data.types ?? ['Files'],
      getData: data.getData ?? (() => '')
    }
  })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

function fileOfSize(name: string, size: number, type: string): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// DES-527 replaced the paperclip and @ buttons with a single + menu, so every
// attach or node-mention gesture now starts by opening it.
async function openAddMenu(): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: i18n.global.t('agent.addToPrompt') })
  )
}

async function openMentionPicker(): Promise<void> {
  await userEvent.type(screen.getByRole('textbox'), '@')
}

type SelectionTestNode = InstanceType<typeof MockLGraphNode>

function setupNodeSelectionCanvas() {
  const focus = vi.fn()
  const nodes: SelectionTestNode[] = [
    new MockLGraphNode(9, 'VAE Decode'),
    new MockLGraphNode(12, 'KSampler')
  ]
  const selectedItems = new Set<unknown>()
  const selectItems = vi.fn((items: unknown[], add = false) => {
    if (!add) selectedItems.clear()
    for (const item of items) selectedItems.add(item)
  })
  const deselect = vi.fn((node: unknown) => selectedItems.delete(node))
  const deselectAll = vi.fn(() => selectedItems.clear())
  const graph = {
    nodes,
    getNodeById: (id: string | number) =>
      nodes.find((node) => String(node.id) === String(id)) ?? null
  }
  appMock.graph.nodes = nodes
  const canvas = {
    graph,
    selectedItems,
    selectItems,
    deselect,
    deselectAll,
    multi_select: false,
    allow_dragnodes: true,
    selectOnly: false,
    canvas: { focus }
  }
  appMock.canvas = canvas
  hostStores.canvas.currentGraph = graph
  return {
    canvas,
    focus,
    nodes,
    selectedItems,
    selectItems,
    deselect,
    deselectAll
  }
}

const SUBGRAPH_UUID = '12345678-1234-1234-1234-123456789abc'

function nestSelectionCanvasInSubgraph(
  state: ReturnType<typeof setupNodeSelectionCanvas>
) {
  Object.assign(state.canvas.graph, { id: SUBGRAPH_UUID })
  for (const node of state.nodes) node.graph = { id: SUBGRAPH_UUID }
  const subgraphNode = {
    id: 1,
    title: 'Subgraph',
    isSubgraphNode: () => true,
    subgraph: state.canvas.graph
  }
  appMock.graph.nodes = [subgraphNode]
  Object.assign(appMock.rootGraph, {
    subgraphs: new Map([[SUBGRAPH_UUID, state.canvas.graph]])
  })
  return subgraphNode
}

function showRootGraph(
  state: ReturnType<typeof setupNodeSelectionCanvas>,
  nodes: SelectionTestNode[] = []
) {
  const graph = {
    nodes,
    getNodeById: (id: string | number) =>
      nodes.find((node) => String(node.id) === String(id)) ?? null
  }
  state.canvas.graph = graph
  hostStores.canvas.currentGraph = graph
}

function renderCanvasNodeButtons(
  nodes: SelectionTestNode[],
  onClick: (node: SelectionTestNode) => void
): void {
  const CanvasNodes = defineComponent({
    setup: () => () =>
      h(
        'div',
        nodes.map((node) =>
          h('button', {
            type: 'button',
            class: 'lg-node',
            'data-node-id': String(node.id),
            tabindex: 0,
            'aria-label': `Canvas ${node.title}`,
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              onClick(node)
            }
          })
        )
      )
  })
  render(CanvasNodes)
}

async function enterNodeSelectionMode(): Promise<void> {
  await openAddMenu()
  await userEvent.click(
    await screen.findByRole('menuitem', {
      name: i18n.global.t('agent.addNodesFromGraph')
    })
  )
}

async function startVueNodeSelection() {
  const state = setupNodeSelectionCanvas()
  const selectClickedNode = vi.fn((node: SelectionTestNode) => {
    if (!state.canvas.multi_select) state.selectedItems.clear()
    if (state.selectedItems.has(node)) state.selectedItems.delete(node)
    else state.selectedItems.add(node)
    hostStores.canvas.updateSelectedItems()
  })
  const view = render(AgentPanelRoot, { global: { plugins: [i18n] } })
  renderCanvasNodeButtons(state.nodes, selectClickedNode)
  useAgentPanelStore().isOpen = true

  await enterNodeSelectionMode()
  const buttons = state.nodes.map((node) =>
    screen.getByRole('button', { name: `Canvas ${node.title}` })
  )
  await userEvent.click(buttons[0])
  await userEvent.click(buttons[1])
  expect(state.selectItems).not.toHaveBeenCalled()
  expect(hostStores.canvas.selectedItems).toEqual(state.nodes)

  return { ...state, ...view, buttons, selectClickedNode }
}

async function expectLaterClickCannotRestoreAccumulatedNodes(
  state: Awaited<ReturnType<typeof startVueNodeSelection>>
): Promise<void> {
  state.selectItems.mockClear()
  await userEvent.click(state.buttons[0])
  expect(state.selectItems).not.toHaveBeenCalled()
  expect([...state.selectedItems]).toEqual([state.nodes[0]])
}

// Records what actually reached the upload endpoint, so an exclusion can be
// asserted on the request rather than on a chip that has not rendered yet.
function stubUploadFetch(uploaded: string[] = []): string[] {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes('/upload/')) return json(200, { threads: [] })
      const body = init?.body
      if (body instanceof FormData) {
        const file = body.get('image')
        if (file instanceof File) uploaded.push(file.name)
      }
      return json(200, { name: 'uploaded', subfolder: '', type: 'input' })
    })
  )
  return uploaded
}

describe('AgentPanelRoot attach flow', () => {
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

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.attachFiles')
      })
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
    expect(assetsStore.updateInputs).toHaveBeenCalled()

    expect(screen.getByAltText('cat.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cat.png' })).toBeInTheDocument()
  })

  it('warns with the configured server limit when a video exceeds it', async () => {
    // PM-118: dropping a movie showed "Comfy Agent hit a server error" because a
    // size rejection was routed through the agent-failure overlay.
    getServerFeature.mockReturnValue(24 * 1024 * 1024)
    stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    const movie = fileOfSize('movie.mp4', 25 * 1024 * 1024, 'video/mp4')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [movie] })
    await nextTick()

    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(toastStore.messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'warn',
        detail: 'movie.mp4 is larger than 24MB'
      })
    )
    expect(screen.queryByText('movie.mp4')).not.toBeInTheDocument()
  })

  it('rejects URI-only drags without showing or claiming the asset target', async () => {
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const target = screen.getByRole('textbox')
    const data = {
      types: ['text/uri-list'],
      getData: () => 'https://example.com/image.png'
    }

    expect(dispatchDrag(target, 'dragenter', data)).toBe(false)
    await nextTick()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(dispatchDrag(target, 'dragover', data)).toBe(false)
    expect(dispatchDrag(target, 'drop', data)).toBe(false)
    expect(uploaded).toEqual([])
  })

  it('claims a mixed drop for its attachable files and leaves JSON-only drops unclaimed', async () => {
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const target = screen.getByRole('textbox')
    const workflow = new File(['{}'], 'workflow.json', {
      type: 'application/json'
    })
    const image = new File(['image'], 'reference.png', { type: 'image/png' })

    expect(dispatchDrag(target, 'drop', { files: [workflow, image] })).toBe(
      true
    )
    await vi.waitFor(() => expect(uploaded).toEqual(['reference.png']))

    expect(dispatchDrag(target, 'drop', { files: [workflow] })).toBe(false)
    await nextTick()
    expect(uploaded).toEqual(['reference.png'])
  })

  it('attaches a Media-card URI and forwards its uploaded ref', async () => {
    const messageBodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/view'))
          return new Response(new Blob(['asset']), {
            headers: { 'Content-Type': 'image/png' }
          })
        if (url.endsWith('/api/upload/image'))
          return json(200, {
            name: 'uploaded_gen.png',
            subfolder: '',
            type: 'input'
          })
        if (init?.method === 'POST' && url.includes('/messages')) {
          messageBodies.push(JSON.parse(String(init.body)))
          return json(202, { thread_id: 'th-1', message_id: 'm-1' })
        }
        return json(200, { threads: [] })
      })
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const target = screen.getByRole('textbox')
    const dragData = {
      types: ['application/x-comfy-asset-info', 'text/uri-list'],
      getData: (type: string) =>
        type === 'application/x-comfy-asset-info'
          ? JSON.stringify({ filename: 'gen.png', type: 'input' })
          : 'http://localhost/api/view?filename=gen.png'
    }

    dispatchDrag(target, 'dragenter', dragData)
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Drag and drop assets here'
    )
    expect(dispatchDrag(target, 'dragover', dragData)).toBe(true)
    expect(dispatchDrag(target, 'drop', dragData)).toBe(true)
    expect(await screen.findByText('gen.png')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'describe this')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({
      content: 'describe this',
      attachments: ['uploaded_gen.png']
    })
  })
})

describe('AgentPanelRoot history', () => {
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
})

describe('AgentPanelRoot feedback capture', () => {
  it('forwards a thumbs vote to telemetry with the message id and vote', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

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

    expect(telemetry.trackAgentMessageFeedback.mock.calls).toEqual([
      [{ message_id: 'turn-9', vote: 'up', workflow_id: null }]
    ])
  })
})

describe('AgentPanelRoot lifecycle', () => {
  it('reports the header close click and attributes the panel close to it', async () => {
    const selection = await startVueNodeSelection()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.close') })
    )

    expect(selection.canvas.multi_select).toBe(false)
    expect(telemetry.trackAgentCloseButtonClicked).toHaveBeenCalled()
    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: null
    })
    expect(useAgentPanelStore().isOpen).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('does not cancel the in-flight turn when the panel unmounts', async () => {
    const tab = addTab('workflows/current.json', {
      activeState: { id: 'wf-42' }
    })
    hostStores.workflow.activeWorkflow = tab
    useAgentWorkflowTabBindingStore().bind('wf-42', tab.path)
    const urls: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url)
      return json(202, { thread_id: 'th-1', message_id: 'm-1' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await sendFromComposer('hello')
    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe(tab.path)
    activity.setCreating(true)

    unmount()
    await nextTick()

    expect(urls.some((url) => url.endsWith('/cancel'))).toBe(false)
    expect(activity.editingTabPath).toBeNull()
    expect(activity.creatingTab).toBe(false)
  })

  it('exits selection on graph changes and restores canvas behavior on unmount', async () => {
    const selection = await startVueNodeSelection()

    hostStores.canvas.currentGraph = { id: 'next-graph' }
    await nextTick()

    expect(selection.canvas.multi_select).toBe(false)
    expect(selection.canvas.allow_dragnodes).toBe(true)
    expect(selection.canvas.selectOnly).toBe(false)

    await enterNodeSelectionMode()
    expect(selection.canvas.multi_select).toBe(true)

    selection.unmount()
    await nextTick()

    expect(selection.canvas.multi_select).toBe(false)
    expect(selection.canvas.allow_dragnodes).toBe(true)
    expect(selection.canvas.selectOnly).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })
})

describe('AgentPanelRoot workflow binding', () => {
  function makeTab(id?: string): FakeTab {
    const tab: FakeTab = {
      path: 'workflows/current.json',
      directory: 'workflows',
      filename: 'current',
      isTemporary: false,
      isPersisted: true,
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
    cloudWorkflows: { id: string; name: string }[] = []
  ): { bodies: unknown[]; messageUrls: string[] } {
    const bodies: unknown[] = []
    const messageUrls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages') && init?.method === 'POST') {
          messageUrls.push(url)
          bodies.push(JSON.parse(String(init.body)))
          return json(202, ack(ackWorkflowId, `m-${bodies.length}`))
        }
        if (url.includes('/messages')) return json(200, [])
        if (url.includes('/agent/threads')) {
          return json(200, { threads: [], pagination: { page: 1 } })
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
    return { bodies, messageUrls }
  }

  it('transitions the bound tab from editing to modified when the turn completes', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })
    expect(activity.editingTabPath).toBeNull()
    expect(activity.unseenModifiedPaths.has('workflows/current.json')).toBe(
      true
    )
  })

  it('holds the creating flag for 500 ms before an unbound agent tab materializes', async () => {
    makeTab('wf-42')
    let resolveLookup: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/messages')) return json(202, ack('wf-42', 'm-1'))
        if (url.includes('/agent/threads'))
          return json(200, { threads: [], pagination: { page: 1 } })
        if (url.includes('workflow_id=wf-new')) {
          return new Promise<Response>((resolve) => {
            resolveLookup = resolve
          })
        }
        return new Response('{}', { status: 200 })
      })
    )

    await renderAndSend('work here')

    const activity = useWorkflowTabActivityStore()
    expect(activity.creatingTab).toBe(false)

    vi.useFakeTimers()
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'Fresh',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(activity.creatingTab).toBe(true)

    resolveLookup?.(json(404, { error: 'none' }))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(499)
    expect(activity.creatingTab).toBe(true)
    expect(hostStores.workflow.tabs.get('workflows/Fresh.json')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(activity.creatingTab).toBe(false)
    expect(hostStores.workflow.tabs.get('workflows/Fresh.json')).toBeDefined()
    vi.useRealTimers()
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

  it('chip X detaches the chat so the next send carries no workflow context', async () => {
    makeTab('wf-42')
    const { bodies } = mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.dontWorkInWorkflow')
      })
    )
    expect(
      await screen.findAllByText(i18n.global.t('agent.chooseWorkflow'))
    ).not.toHaveLength(0)

    await sendFromComposer('work without a canvas')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('current_tab')
    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
    expect(useWorkflowTabActivityStore().editingTabPath).toBeNull()
  })

  it('starts workflow-detached fresh sessions from New Chat and active-chat deletion', async () => {
    makeTab('wf-42')
    const { bodies, messageUrls } = mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await sendFromComposer('first thread')
    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',
      current_tab: 'wf-42'
    })
    ws.emit('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )
    await sendFromComposer('after new chat')
    expect(messageUrls[1]).toContain('/agent/threads/new/messages')
    expect(bodies[1]).not.toHaveProperty('workflow_id')
    expect(bodies[1]).not.toHaveProperty('current_tab')
    ws.emit('agent_message_done', {
      message_id: 'm-2',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
    )
    await sendFromComposer('after delete')

    expect(messageUrls[2]).toContain('/agent/threads/new/messages')
    expect(bodies[2]).not.toHaveProperty('workflow_id')
    expect(bodies[2]).not.toHaveProperty('current_tab')
  })

  it('includes active and background tabs restored from persisted bindings', async () => {
    localStorage.setItem(
      'Comfy.Agent.WorkflowTabBindings',
      JSON.stringify({
        'wf-current': 'workflows/current.json',
        'wf-background': 'workflows/background.json'
      })
    )
    makeTab()
    addTab('workflows/background.json')
    const { bodies } = mockMessagesEndpoint('wf-current')

    await renderAndSend('use my open workflows')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-current',
      current_tab: 'wf-current',
      open_tabs: [
        { workflow_id: 'wf-current', name: 'current' },
        { workflow_id: 'wf-background', name: 'background' }
      ]
    })
  })

  it('agent_active_tab activates the bound tab', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(tab)
    )
    // Content sync rides the CRDT follower; activation never reloads the
    // canvas itself.
    expect(app.loadGraphData).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
        workflow_id: 'wf-42',
        target: 'active_tab_switch'
      })
    )
  })

  it('agent_active_tab opens an unknown workflow as a blank named tab', async () => {
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
    // The host minted the doc server-side; the follower fills the canvas.
    // Nothing loads, saves, or adopts here.
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-77')).toBe(
      'workflows/Video test.json'
    )
    expect(useWorkflowTabActivityStore().editingTabPath).toBe(
      'workflows/Video test.json'
    )
    expect(telemetry.trackAgentWorkflowApplied).toHaveBeenCalledWith({
      workflow_id: 'wf-77',
      target: 'active_tab_open'
    })
  })

  it('a stale agent_active_tab resolving late cannot steal focus from the newest', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')

    // Hold the SLOW tab's open so the newer activation lands mid-flight.
    let releaseSlowOpen: (() => void) | undefined
    vi.mocked(workflowService.openWorkflow).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseSlowOpen = resolve
        })
    )
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-slow',
      name: 'Slow tab',
      thread_id: 'th-1'
    })
    await vi.waitFor(() => expect(releaseSlowOpen).toBeDefined())
    ws.emit('agent_active_tab', {
      workflow_id: 'wf-fast',
      name: 'Fast tab',
      thread_id: 'th-1'
    })
    releaseSlowOpen?.()

    await vi.waitFor(() =>
      expect(
        hostStores.workflow.tabs.get('workflows/Fast tab.json')
      ).toBeDefined()
    )
    await vi.waitFor(() => {
      expect(hostStores.workflow.tabs.get('workflows/Slow tab.json')).toBe(
        undefined
      )
      expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-slow')).toBe(
        undefined
      )
      expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-fast')).toBe(
        'workflows/Fast tab.json'
      )
    })
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

  it('stages a mention pick once and reports the tag gesture', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    expect(await screen.findByText('KSampler')).toBeInTheDocument()
    expect([...state.selectedItems]).toEqual([state.nodes[1]])
    expect(state.selectItems).toHaveBeenCalledWith([state.nodes[1]], true)
    expect(telemetry.trackAgentNodeTagged).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentNodeTagged).toHaveBeenCalledWith({
      source: 'mention_picker'
    })
  })

  it('uses graph-scoped identity for focus, removal, and picker exclusion', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    const subgraphNode = nestSelectionCanvasInSubgraph(state)
    const referencedNode = state.nodes[1]
    referencedNode.id = 'shared'
    referencedNode.title = 'Subgraph twin'
    const rootTwin = new MockLGraphNode('shared', 'Root twin')
    appMock.graph.nodes = [subgraphNode, rootTwin]

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('Subgraph twin'))

    showRootGraph(state, [rootTwin])
    state.selectedItems.add(rootTwin)
    hostStores.canvas.updateSelectedItems()
    await nextTick()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Show Subgraph twin #shared on canvas'
      })
    )
    expect(focusNodeInstance).toHaveBeenCalledWith(referencedNode)

    await openMentionPicker()
    expect(
      within(screen.getByRole('listbox')).getByText('Root twin')
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove Subgraph twin #shared reference'
      })
    )
    expect(state.deselect).toHaveBeenCalledWith(referencedNode)
    expect([...state.selectedItems]).toEqual([rootTwin])
  })

  it('keeps additive Vue-node selections and sends every node id', async () => {
    makeTab()
    const { bodies } = mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()

    expect(selection.canvas.multi_select).toBe(true)
    expect(selection.canvas.allow_dragnodes).toBe(false)
    expect(selection.canvas.selectOnly).toBe(true)
    expect(selection.focus).toHaveBeenCalledOnce()
    expect(selection.selectClickedNode).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()

    await sendFromComposer('explain this')

    expect(selection.canvas.multi_select).toBe(false)
    expect(selection.canvas.allow_dragnodes).toBe(true)
    expect(selection.canvas.selectOnly).toBe(false)
    expect(bodies[0]).toMatchObject({
      selection: { node_ids: ['9', '12'] }
    })
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })
})
