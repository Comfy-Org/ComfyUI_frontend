// @vitest-environment jsdom
import { fromPartial } from '@total-typescript/shoehorn'

import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

// jsdom does not implement ResizeObserver (happy-dom does); stub it before the
// Vue node preview chain constructs its module-level observer at import time.
vi.hoisted(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

import { i18n } from '@/i18n'
import { assetService } from '@/platform/assets/services/assetService'
import { app } from '@/scripts/app'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'

const getServerFeature = vi.hoisted(() =>
  vi.fn((_name: string, defaultValue?: unknown) => defaultValue)
)
const focusNodeInstance = vi.hoisted(() => vi.fn())

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
    socket: { readyState: 1, send: vi.fn() },
    addEventListener: ws.add,
    removeEventListener: ws.remove,
    addCustomEventListener: ws.add,
    removeCustomEventListener: ws.remove
  }
}))

const appMock = vi.hoisted(() => {
  const graph = {
    nodes: [] as unknown[],
    arrange: vi.fn(),
    serialize: () => ({ version: 0.4, nodes: graph.nodes }),
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
    canvas: undefined as
      | {
          graph: {
            nodes: unknown[]
            getNodeById: (id: string) => unknown | null
          }
          selectedItems: Set<unknown>
          selectItems: ReturnType<typeof vi.fn>
          deselect: (node: unknown) => void
          multi_select: boolean
          allow_dragnodes: boolean
          selectOnly: boolean
          canvas: { focus: ReturnType<typeof vi.fn> }
        }
      | undefined
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
  activeMode?: 'builder:inputs'
}
const hostStores = vi.hoisted(() => ({
  workflow: null as unknown as {
    activeWorkflow: FakeTab | null
    openWorkflows: FakeTab[]
    tabs: Map<string, FakeTab>
    getWorkflowByPath: (path: string) => FakeTab | null
    nodeToNodeLocatorId: (node: {
      graph?: { id?: string }
      id: string | number
    }) => string
  },
  canvas: null as unknown as {
    selectedItems: unknown[]
    updateSelectedItems: () => void
    currentGraph: unknown | null
    canvas: unknown
  }
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
    nodeToNodeLocatorId: (node: {
      graph?: { id?: string }
      id: string | number
    }) => (node.graph?.id ? `${node.graph.id}:${node.id}` : String(node.id)),
    closeWorkflow: vi.fn(async (tab: FakeTab) => {
      tabs.delete(tab.path)
    }),
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
  const updateSelectedItems = () => {
    hostStores.canvas.selectedItems = [...(appMock.canvas?.selectedItems ?? [])]
  }
  const store = reactive({
    selectedItems: [] as unknown[],
    updateSelectedItems,
    currentGraph: null as unknown | null,
    canvas: undefined as unknown
  })
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

type MockPromptError = {
  type: string
  message: string
  details: string
}
const executionErrors = vi.hoisted(() => {
  const store = {
    lastPromptError: null as MockPromptError | null,
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
import { MAX_ATTACHMENT_BYTES } from './composables/agent/useAttachment'
import type { AgentChatEvent } from './services/agent/agentEventTransport'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'

import AgentPanelRoot from './AgentPanelRoot.vue'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  localStorage.clear()
  getServerFeature.mockReset()
  getServerFeature.mockImplementation(
    (_name: string, defaultValue?: unknown) => defaultValue
  )
  hostStores.workflow.tabs.clear()
  hostStores.workflow.activeWorkflow = null
  hostStores.canvas.selectedItems = []
  hostStores.canvas.currentGraph = null
  appMock.graph.nodes = []
  appMock.graph.arrange.mockClear()
  Object.assign(appMock.rootGraph, { subgraphs: new Map() })
  appMock.canvas = undefined
  workflowService.saveWorkflow.mockClear()
  workflowService.saveWorkflowAs.mockClear()
  workflowService.openWorkflow.mockClear()
  focusNodeInstance.mockReset()
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

type SelectionTestNode = {
  isNodeFake: true
  id: number | string
  title: string
  boundingRect: object
  graph?: { id?: string }
}

function setupNodeSelectionCanvas() {
  const focus = vi.fn()
  const nodes: SelectionTestNode[] = [
    { isNodeFake: true, id: 9, title: 'VAE Decode', boundingRect: {} },
    { isNodeFake: true, id: 12, title: 'KSampler', boundingRect: {} }
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
  const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
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

  return { ...state, buttons, selectClickedNode, unmount: panel.unmount }
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
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
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

    expect(screen.getByAltText('cat.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cat.png' })).toBeInTheDocument()
  })

  it('uploads a picked video above 20MB when the server permits it', async () => {
    getServerFeature.mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.attachFiles')
      })
    )
    const movie = fileOfSize('movie.mp4', MAX_ATTACHMENT_BYTES + 1, 'video/mp4')
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      movie
    )

    expect(await screen.findByText('movie.mp4')).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['movie.mp4']))
  })

  it('opens the assets sidebar from the add menu', async () => {
    stubUploadFetch()
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = 'workflows'

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.addFromAssets')
      })
    )

    expect(sidebar.activeSidebarTabId).toBe('assets')
  })

  it('leaves the assets sidebar open when it is already the active tab', async () => {
    stubUploadFetch()
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = 'assets'

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.addFromAssets')
      })
    )

    expect(sidebar.activeSidebarTabId).toBe('assets')
  })

  it('hides the assets entry in builder mode', async () => {
    stubUploadFetch()
    hostStores.workflow.activeWorkflow = {
      path: 'workflows/current.json',
      directory: 'workflows',
      filename: 'current',
      isTemporary: false,
      isModified: false,
      activeState: null,
      activeMode: 'builder:inputs'
    }

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await openAddMenu()
    expect(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.addNodesFromGraph')
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', {
        name: i18n.global.t('agent.addFromAssets')
      })
    ).toBeNull()
  })

  it('warns with the configured server limit when a video exceeds it', async () => {
    // PM-118: dropping a movie showed "Comfy Agent hit a server error" because a
    // size rejection was routed through the agent-failure overlay.
    getServerFeature.mockReturnValue(24 * 1024 * 1024)
    executionErrors.showErrorOverlay.mockClear()
    stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    const movie = fileOfSize('movie.mp4', 25 * 1024 * 1024, 'video/mp4')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [movie] })
    await nextTick()

    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'warn',
        detail: 'movie.mp4 is larger than 24MB'
      })
    )
    expect(screen.queryByText('movie.mp4')).not.toBeInTheDocument()
  })

  it('keeps the image limit at 20MB when the server permits more', async () => {
    getServerFeature.mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    const image = fileOfSize('huge.png', MAX_ATTACHMENT_BYTES + 1, 'image/png')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [image] })
    await nextTick()

    expect(uploaded).toEqual([])
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'warn',
        detail: 'huge.png is larger than 20MB'
      })
    )
  })

  it('uploads a dropped video above 20MB when the server permits it', async () => {
    getServerFeature.mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    const movie = fileOfSize('movie.mp4', MAX_ATTACHMENT_BYTES + 1, 'video/mp4')
    expect(
      dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [movie] })
    ).toBe(true)

    expect(await screen.findByText('movie.mp4')).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['movie.mp4']))
  })

  // Jo's FE-1323 expansion: every approved format attaches through drag-drop.
  // The MIME column mirrors what browsers actually report - glb, md, and wav
  // drops often carry no type at all, so claiming must go by file name.
  it.for([
    ['clip.mp4', 'video/mp4'],
    ['voice.m4a', ''],
    ['movie.mov', 'video/quicktime'],
    ['song.mp3', 'audio/mpeg'],
    ['sound.wav', ''],
    ['mesh.glb', ''],
    ['notes.md', ''],
    ['prompt.txt', 'text/plain']
  ])('attaches a dropped %s and uploads it', async ([name, type]) => {
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    expect(
      dispatchDrag(screen.getByRole('textbox'), 'drop', {
        files: [new File(['x'], name, { type })]
      })
    ).toBe(true)

    expect(await screen.findByText(name)).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual([name]))
  })

  it('names every approved format in the picker accept list', async () => {
    stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    const accept =
      screen
        .getByTestId<HTMLInputElement>('agent-file-input')
        .getAttribute('accept') ?? ''
    for (const extension of [
      '.mp4',
      '.m4a',
      '.mov',
      '.mp3',
      '.wav',
      '.glb',
      '.md',
      '.txt'
    ]) {
      expect(accept).toContain(extension)
    }
  })

  it('refreshes the input asset library after an upload', async () => {
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const refresh = vi
      .spyOn(useAssetsStore().inputAssets, 'loadNew')
      .mockResolvedValue(undefined)

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      files: [new File(['x'], 'cat.png', { type: 'image/png' })]
    })

    await vi.waitFor(() => expect(uploaded).toEqual(['cat.png']))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('keeps the 20MB limit for an oversize audio file', async () => {
    getServerFeature.mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    const song = fileOfSize('big.mp3', MAX_ATTACHMENT_BYTES + 1, 'audio/mpeg')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [song] })
    await nextTick()

    expect(uploaded).toEqual([])
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'warn',
        detail: 'big.mp3 is larger than 20MB'
      })
    )
  })

  it('claims a dragover carrying files so a drop can reach the panel', async () => {
    // Without cancelling dragover the browser fires no drop at all, so this is
    // what makes the advertised drag-and-drop work.
    stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const target = screen.getByRole('textbox')

    expect(dispatchDrag(target, 'dragover', { types: ['Files'] })).toBe(true)
    expect(dispatchDrag(target, 'dragover', { types: ['text/plain'] })).toBe(
      false
    )
  })

  it('shows the asset drop target during a trusted drag and clears it on leave', async () => {
    stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const target = screen.getByRole('textbox')
    const data = {
      types: ['application/x-comfy-asset-info', 'text/uri-list']
    }

    dispatchDrag(target, 'dragenter', data)
    await nextTick()

    const dropTarget = screen.getByRole('status')
    expect(dropTarget).toHaveTextContent('Drag and drop assets here')

    dispatchDrag(dropTarget, 'dragleave', data)
    await nextTick()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

  it.for([
    { mime: 'image/png', filename: 'gen.png' },
    { mime: 'video/mp4', filename: 'movie.mp4' }
  ])(
    'T-08 / PM-646 / FE-1314 attaches a Media-card $mime URI and forwards its uploaded ref',
    async ({ mime, filename }) => {
      // PM-116: MediaAssetCard.dragStart sets asset-info + text/uri-list on the
      // transfer and never a File, so the panel must claim and fetch the URI.
      const messageBodies: unknown[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('/api/view'))
            return new Response(new Blob(['asset']), {
              headers: { 'Content-Type': mime }
            })
          if (url.endsWith('/api/upload/image'))
            return new Response(
              JSON.stringify({
                name: `uploaded_${filename}`,
                subfolder: '',
                type: 'input'
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          if (init?.method === 'POST' && url.includes('/messages')) {
            messageBodies.push(JSON.parse(String(init.body)))
            return json(202, { thread_id: 'th-1', message_id: 'm-1' })
          }
          return new Response('{"threads":[]}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        })
      )
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await nextTick()
      const target = screen.getByRole('textbox')
      const dragData = {
        types: ['application/x-comfy-asset-info', 'text/uri-list'],
        getData: (type: string) =>
          type === 'application/x-comfy-asset-info'
            ? JSON.stringify({ filename, type: 'input' })
            : `http://localhost/api/view?filename=${filename}`
      }

      dispatchDrag(target, 'dragenter', dragData)
      await nextTick()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Drag and drop assets here'
      )

      expect(dispatchDrag(target, 'dragover', dragData)).toBe(true)

      const claimed = dispatchDrag(target, 'drop', dragData)
      expect(claimed).toBe(true)
      await nextTick()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      expect(await screen.findByText(filename)).toBeInTheDocument()

      await userEvent.type(screen.getByRole('textbox'), 'describe this')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(messageBodies).toHaveLength(1)
      expect(messageBodies[0]).toMatchObject({
        content: 'describe this',
        attachments: [`uploaded_${filename}`]
      })
    }
  )

  it.for([
    { mime: 'image/png', filename: 'gen.png' },
    { mime: 'video/mp4', filename: 'movie.mp4' }
  ])(
    'stages an existing Media-card $mime reference without uploading',
    async ({ mime, filename }) => {
      const messageBodies: unknown[] = []
      const fetchSpy = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (init?.method === 'POST' && url.includes('/messages')) {
            messageBodies.push(JSON.parse(String(init.body)))
            return json(202, { thread_id: 'th-1', message_id: 'm-1' })
          }
          return new Response('{"threads":[]}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      )
      vi.stubGlobal('fetch', fetchSpy)
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await nextTick()
      const target = screen.getByRole('textbox')
      const ref = `stored_${filename}`
      const dragData = {
        types: ['application/x-comfy-asset-info'],
        getData: () =>
          JSON.stringify({
            filename,
            type: 'input',
            attachment_ref: ref,
            media_kind: mime === 'image/png' ? 'image' : 'video',
            preview_url:
              mime === 'image/png'
                ? `http://localhost/api/assets/${filename}/content`
                : undefined
          })
      }

      expect(dispatchDrag(target, 'drop', dragData)).toBe(true)
      expect(dispatchDrag(target, 'drop', dragData)).toBe(true)
      expect(await screen.findByText(filename)).toBeInTheDocument()
      expect(screen.getAllByText(filename)).toHaveLength(1)
      expect(
        screen.queryByLabelText(i18n.global.t('agent.uploading'))
      ).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(messageBodies).toHaveLength(1)
      expect(messageBodies[0]).toMatchObject({ attachments: [ref] })
      expect(
        fetchSpy.mock.calls.some(([url]) =>
          /\/api\/(view|upload\/image)/.test(String(url))
        )
      ).toBe(false)
    }
  )

  it('shows an uploading chip while a Media-card URI is still loading', async () => {
    let resolveAsset: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/view'))
          return new Promise<Response>((resolve) => {
            resolveAsset = resolve
          })
        if (url.endsWith('/api/upload/image'))
          return Promise.resolve(
            new Response(JSON.stringify({ name: 'uploaded_gen.png' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          )
        return Promise.resolve(
          new Response('{"threads":[]}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
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

    expect(dispatchDrag(target, 'drop', dragData)).toBe(true)
    expect(await screen.findByText('gen.png')).toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.global.t('agent.uploading'))
    ).toBeInTheDocument()

    resolveAsset(new Response(new Blob(['asset'], { type: 'image/png' })))
    await vi.waitFor(() =>
      expect(
        screen.queryByLabelText(i18n.global.t('agent.uploading'))
      ).not.toBeInTheDocument()
    )
  })

  it('attaches dropped assets and leaves other files to the graph loader', async () => {
    // The graph loader only opens a dropped workflow while the drop is
    // unclaimed, so the panel must not claim files it cannot attach.
    stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()
    const target = screen.getByRole('textbox')

    const workflow = new File(['{}'], 'flow.json', {
      type: 'application/json'
    })
    expect(dispatchDrag(target, 'drop', { files: [workflow] })).toBe(false)
    expect(screen.queryByText('flow.json')).not.toBeInTheDocument()

    const asset = new File(['x'], 'cat.png', { type: 'image/png' })
    expect(dispatchDrag(target, 'drop', { files: [asset] })).toBe(true)
    expect(await screen.findByText('cat.png')).toBeInTheDocument()
  })

  it('attaches only the assets out of a mixed drop', async () => {
    const uploaded = stubUploadFetch()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    // The non-attachable file comes first: addFiles uploads sequentially, so a
    // regression that forwards the whole drop would upload flow.json before
    // cat.png and the settled assertion below could never latch a lucky
    // intermediate state.
    const files = [
      new File(['{}'], 'flow.json', { type: 'application/json' }),
      new File(['x'], 'cat.png', { type: 'image/png' })
    ]
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files })

    expect(await screen.findByText('cat.png')).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['cat.png']))
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

    executionErrors.showErrorOverlay.mockClear()
    failUpload()
    await vi.waitFor(() =>
      expect(screen.queryByText('cat.png')).not.toBeInTheDocument()
    )
    expect(revoke).toHaveBeenCalledTimes(1)
    // A rejected file is the user's to fix; raising the server-error overlay
    // told them the agent had broken instead.
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'warn',
        detail: 'cat.png could not be uploaded'
      })
    )
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

describe('AgentPanelRoot history', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
    localStorage.clear()
  })

  async function renderWithActiveThread(): Promise<void> {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/agent/threads')
          ? new Response(
              JSON.stringify({
                threads: [
                  {
                    id: 'th-active',
                    title: 'build a duck',
                    last_message_at: '2026-07-07T10:00:00Z'
                  }
                ]
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          : new Response('[]', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
      )
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().setThreadId('th-active')
    await nextTick()
  }

  it('renames the current chat from the title menu on Enter', async () => {
    await renderWithActiveThread()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    const menu = await screen.findByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([i18n.global.t('g.rename'), i18n.global.t('g.delete')])
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: i18n.global.t('g.rename') })
    )
    const input = await screen.findByRole<HTMLInputElement>('textbox', {
      name: i18n.global.t('g.rename')
    })
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    await userEvent.type(input, 'my masterpiece{Enter}')

    expect(await screen.findByText('my masterpiece')).toBeInTheDocument()
    expect(useAgentChatHistoryStore().grouped.current[0]).toMatchObject({
      id: 'th-active',
      title: 'my masterpiece'
    })
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.chatOptions')
      })
    ).toBeInTheDocument()
  })

  it('commits a rename when the input loses focus', async () => {
    await renderWithActiveThread()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.rename') })
    )
    const input = await screen.findByRole<HTMLInputElement>('textbox', {
      name: i18n.global.t('g.rename')
    })
    await userEvent.type(input, 'renamed by blur')
    input.blur()

    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().titleFor('th-active')).toBe(
        'renamed by blur'
      )
    )
  })

  it('starts renaming from a single click on the current title', async () => {
    await renderWithActiveThread()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.newChatTitle')
      })
    )

    const input = await screen.findByRole<HTMLInputElement>('textbox', {
      name: i18n.global.t('g.rename')
    })
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(
      screen.queryByRole('button', { name: i18n.global.t('agent.history') })
    ).toBeNull()
  })

  it('opens Chat History from its dedicated control', async () => {
    await renderWithActiveThread()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: i18n.global.t('agent.history')
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.backToPreviousChat')
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: i18n.global.t('g.rename') })
    ).toBeNull()
  })

  it('abandons a rename on Escape', async () => {
    await renderWithActiveThread()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.rename') })
    )
    const input = await screen.findByRole('textbox', {
      name: i18n.global.t('g.rename')
    })
    await userEvent.clear(input)
    await userEvent.type(input, 'discarded{Escape}')

    expect(
      screen.queryByRole('textbox', { name: i18n.global.t('g.rename') })
    ).toBeNull()
    expect(screen.queryByText('discarded')).toBeNull()
    expect(useAgentChatHistoryStore().titleFor('th-active')).toBeUndefined()
  })

  it('renames a conversation from Chat History', async () => {
    await renderWithActiveThread()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.chatOptions')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.rename') })
    )
    const input = await screen.findByRole<HTMLInputElement>('textbox', {
      name: i18n.global.t('g.rename')
    })
    expect(input.value).toBe('build a duck')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    await userEvent.type(input, 'Findable duck chat{Enter}', {
      skipClick: true
    })

    expect(await screen.findByText('Findable duck chat')).toBeInTheDocument()
    expect(useAgentChatHistoryStore().titleFor('th-active')).toBe(
      'Findable duck chat'
    )
  })

  it('deletes the current chat from the title menu and starts fresh', async () => {
    await renderWithActiveThread()
    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
    )

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
    )

    expect(useAgentChatHistoryStore().sessions).toHaveLength(0)
    // The fresh chat has no thread yet, so the menu disappears with it.
    expect(
      screen.queryByRole('button', { name: i18n.global.t('agent.chatOptions') })
    ).toBeNull()

    // The server has no delete endpoint yet, so the tombstone must hold the
    // thread out of the next refresh instead of letting it resurrect.
    useAgentChatHistoryStore().replaceAll([
      { id: 'th-active', title: 'build a duck', updatedAt: Date.now() }
    ])
    expect(useAgentChatHistoryStore().sessions).toHaveLength(0)
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
          tool_call_id: 'call-add-node',
          tool_name: 'add_node',
          status: 'success',
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

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
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
    await userEvent.click(
      await screen.findByRole('button', { name: 'Helpful' })
    )

    expect(telemetry.trackAgentMessageFeedback.mock.calls).toEqual([
      [{ message_id: 'turn-9', vote: 'up', workflow_id: null }],
      [{ message_id: 'turn-9', vote: null, workflow_id: null }]
    ])
  })
})

describe('AgentPanelRoot lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
  })

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

  it('ends node selection when the panel unmounts', async () => {
    const selection = await startVueNodeSelection()

    selection.unmount()

    expect(selection.canvas.multi_select).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
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

  it('clears workflow activity when the panel unmounts', () => {
    const activity = useWorkflowTabActivityStore()
    activity.setEditing('workflows/active.json')
    activity.setCreating(true)

    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })

    unmount()

    expect(activity.$state.editingTabPath).toBeNull()
    expect(activity.$state.creatingTab).toBe(false)
  })
})

describe('AgentPanelRoot greeting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ws.clear()
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
    useAgentPanelStore().enabled = true
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
    telemetry.trackAgentNodeTagged.mockClear()
    telemetry.trackAgentWorkflowApplied.mockClear()
    executionErrors.showErrorOverlay.mockClear()
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
    cloudWorkflows: { id: string; name: string }[] = []
  ): unknown[] {
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/messages') && init?.method === 'POST') {
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
    return bodies
  }

  it('names the active workflow in the selector', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findAllByText('current')).not.toHaveLength(0)

    const other = addTab('workflows/other.json')
    hostStores.workflow.activeWorkflow = other
    expect(await screen.findAllByText('other')).not.toHaveLength(0)
    expect(screen.queryAllByText('current')).toHaveLength(0)
  })

  it('hides the active workflow in history and restores it on return', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(await screen.findAllByText('current')).not.toHaveLength(0)

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    expect(
      await screen.findByText(i18n.global.t('agent.historyEmpty'))
    ).toBeInTheDocument()
    expect(screen.queryByText('current')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.backToPreviousChat')
      })
    )
    expect(await screen.findAllByText('current')).not.toHaveLength(0)
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
    expect(workflowService.openWorkflow).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByText('other'))

    await vi.waitFor(() =>
      expect(workflowService.openWorkflow).toHaveBeenCalledWith(other)
    )
    expect(workflowService.openWorkflow).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('other')
  })

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

  it('lowers the creating flag when a newer focus event supersedes the fetch', async () => {
    const bound = makeTab('wf-42')
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

    ws.emit('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'Fresh',
      thread_id: 'th-1'
    })
    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() => expect(activity.creatingTab).toBe(true))

    ws.emit('agent_active_tab', { workflow_id: 'wf-42', thread_id: 'th-1' })
    resolveLookup?.(json(404, { error: 'none' }))

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
    mockMessagesEndpoint('wf-42')

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

  it("sends the active tab's saved workflow id with the turn", async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })
    // Content sync is the CRDT follower's job now: no draft ever rides the
    // turn and nothing re-loads the canvas from the ack path.
    expect(bodies[0]).not.toHaveProperty('draft')
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('chip X detaches the chat so the next send carries no workflow context', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
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
  })

  it('re-attaches by picking a row so the next send carries the workflow again', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.dontWorkInWorkflow')
      })
    )
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /current/ })
    )

    await sendFromComposer('back on the canvas')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })
  })

  it('starts a new chat detached from the previously active workflow', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    expect(
      await screen.findAllByText(i18n.global.t('agent.chooseWorkflow'))
    ).not.toHaveLength(0)
    expect(screen.queryByText('current')).not.toBeInTheDocument()

    await sendFromComposer('fresh chat')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('current_tab')
    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
  })

  it('a detached send never re-arms the editing spinner on the old tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await sendFromComposer('attached turn')
    const activity = useWorkflowTabActivityStore()
    expect(activity.editingTabPath).toBe('workflows/current.json')

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await vi.waitFor(() => expect(activity.editingTabPath).toBeNull())

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.dontWorkInWorkflow')
      })
    )
    await sendFromComposer('detached turn')

    expect(activity.editingTabPath).toBeNull()
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
    // The whole FE-1310 chain: wire event -> session -> store -> rendered card.
    expect(
      await screen.findByRole('button', { name: /^Open / })
    ).toBeInTheDocument()

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
    // Blank, not the default template: the follower reconciles onto whatever
    // the tab holds and keeps template links it does not displace.
    expect(minted?.activeState).toMatchObject({ nodes: [], links: [] })
    // The host minted the doc server-side; the follower fills the canvas.
    // Nothing loads, saves, or adopts here.
    expect(workflowService.saveWorkflowAs).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-77')).toBe(
      'workflows/Video test.json'
    )
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

  it('agent_active_tab strips dotfile prefixes hidden behind whitespace', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

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

  it('two unnamed agent tabs mint distinct tabs with distinct bindings', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

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
    expect(workflowService.saveWorkflowAs).not.toHaveBeenCalled()

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

  it('a slow tab activation cannot finish after a newer focus event', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

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
    await new Promise((resolve) => setTimeout(resolve))

    // The superseded activation closed its own minted tab and bound nothing.
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
  it('an activation superseded before it starts does nothing at all', async () => {
    mockMessagesEndpoint('wf-42')

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
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-b')).toBe(
      'workflows/B tab.json'
    )
  })

  it('T-03 / PM-655 / FE-1311 sends the active canvas workflow in the agent snapshot', async () => {
    makeTab('wf-42')
    addTab('workflows/scratch.json', {
      activeState: { id: 'graph-internal-id-not-a-cloud-id' }
    })
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }],
      current_tab: 'wf-42'
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

  it('does not resolve two same-named open saved tabs to one cloud id', async () => {
    makeTab()
    addTab('workflows/archive/current.json')
    const bodies = mockMessagesEndpoint('wf-fresh', [
      { id: 'wf-cloud-current', name: 'current' }
    ])

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
  })

  it('excludes ambiguous and nameless cloud records from resolution', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-fresh', [
      { id: 'wf-a', name: 'current' },
      { id: 'wf-b', name: 'current' },
      { id: 'wf-nameless' } as { id: string; name: string }
    ])

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
    const bodies = mockMessagesEndpoint('wf-cloud-current', [
      { id: 'wf-cloud-current', name: 'current' },
      { id: 'wf-cloud-side', name: 'side' }
    ])

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
    const bodies = mockMessagesEndpoint('wf-fresh', [
      { id: 'wf-cloud-current', name: 'current' }
    ])

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
  })

  it('agent_active_tab with a cloud id activates the open saved tab without minting', async () => {
    makeTab()
    addTab('workflows/temp/duck.json', { isTemporary: true })
    const duck = addTab('workflows/duck.json')
    mockMessagesEndpoint('wf-cloud-current', [
      { id: 'wf-cloud-current', name: 'current' },
      { id: 'wf-cloud-duck', name: 'duck' }
    ])

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
    // Resolving by cloud name has to leave the binding behind, or the transcript
    // link renders nothing for the tab the user was just moved to.
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-cloud-duck')).toBe(
      duck.path
    )
    expect(
      await screen.findByRole('button', { name: 'Open duck' })
    ).toBeInTheDocument()
  })

  it('sends every open tab that has a cloud id with the message', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

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
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [
        { workflow_id: 'wf-42', name: 'current' },
        { workflow_id: 'wf-old', name: 'mountain' }
      ],
      current_tab: 'wf-42'
    })
  })

  it('skips the draft on first send from an unbound empty tab', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('draft')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
    expect(bodies[0]).not.toHaveProperty('current_tab')
  })

  it('omits current_tab from the snapshot when the active tab has no cloud id', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

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

  it('inserts an ArrowDown + Tab mention as a chip and clears its token', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.graph.nodes = [
      { id: 5, title: 'KSampler' },
      { id: 7, title: 'KSampler' }
    ]

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, '@')
    expect(screen.getByText('#5')).toBeInTheDocument()
    expect(screen.getByText('#7')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{Tab}')

    expect(textbox).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getAllByText('KSampler')).toHaveLength(1)
    expect(screen.getByText('#7')).toBeInTheDocument()
    await sendFromComposer('tune it')

    expect(bodies[0]).toMatchObject({
      content: 'tune it',
      selection: { node_ids: ['7'] }
    })
  })

  it('sends an existing @ asset reference without uploading it again', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    vi.spyOn(assetService, 'getInputAssetsIncludingPublic').mockResolvedValue([
      fromPartial({
        id: 'asset-1',
        name: 'sunset-original.png',
        hash: 'sunset-hash.png',
        tags: ['input'],
        display_name: 'Sunset.png',
        preview_url: '/api/assets/asset-1/content'
      })
    ])

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, '@sun')
    await userEvent.click(
      await screen.findByRole('option', { name: 'Sunset.png' })
    )

    expect(textbox).toHaveValue('')
    expect(screen.getByText('Sunset.png')).toBeInTheDocument()
    await sendFromComposer('use this asset')

    expect(bodies[0]).toMatchObject({
      content: 'use this asset',
      attachments: ['sunset-hash.png']
    })
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => String(url).includes('/upload/'))
    ).toBe(false)
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
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('sends only the remaining chip after one is dismissed', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.graph.nodes = [
      { id: 5, title: 'KSampler' },
      { id: 7, title: 'VAEDecode' }
    ]

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await openMentionPicker()
    await userEvent.click(await screen.findByText('VAEDecode'))
    expect(await screen.findByText('KSampler')).toBeInTheDocument()
    expect(screen.getByText('VAEDecode')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #5 reference' })
    )
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()

    await sendFromComposer('decode it')

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['7'] } })
    expect(telemetry.trackAgentMessageSent).toHaveBeenCalledWith({
      attachment_count: 0,
      node_tag_count: 1
    })
    expect(screen.getByText('VAEDecode #7')).toBeInTheDocument()
    expect(screen.queryByText(/KSampler/)).not.toBeInTheDocument()
  })

  it('deselects the graph node when its reference chip is removed', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('VAE Decode'))
    await openMentionPicker()
    const matches = await screen.findAllByText('KSampler')
    await userEvent.click(matches[matches.length - 1])

    expect(await screen.findByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove VAE Decode #9 reference' })
    )

    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
    expect(state.deselect).toHaveBeenCalledWith(state.nodes[0])
    expect(focusNodeInstance).not.toHaveBeenCalled()
    expect([...state.selectedItems]).toEqual([state.nodes[1]])
    expect(hostStores.canvas.selectedItems).toEqual([state.nodes[1]])
  })

  it('focuses the graph node when its reference chip is activated', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Show KSampler #12 on canvas' })
    )

    expect(focusNodeInstance).toHaveBeenCalledWith(state.nodes[1])
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('focuses a retained subgraph node after navigating to the root graph', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    nestSelectionCanvasInSubgraph(state)

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    showRootGraph(state)
    await nextTick()

    await userEvent.click(
      screen.getByRole('button', { name: 'Show KSampler #12 on canvas' })
    )

    expect(focusNodeInstance).toHaveBeenCalledWith(state.nodes[1])
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('uses graph-scoped identity for focus, removal, and picker exclusion', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    const subgraphNode = nestSelectionCanvasInSubgraph(state)
    const referencedNode = state.nodes[1]
    referencedNode.id = 'shared'
    referencedNode.title = 'Subgraph twin'
    const rootTwin: SelectionTestNode = {
      isNodeFake: true,
      id: 'shared',
      title: 'Root twin',
      boundingRect: {}
    }
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

  it('excludes referenced nodes from the mention picker', async () => {
    makeTab()
    setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await openMentionPicker()

    const listbox = screen.getByRole('listbox')
    expect(within(listbox).queryByText('KSampler')).not.toBeInTheDocument()
    expect(within(listbox).getByText('VAE Decode')).toBeInTheDocument()
  })

  it('keeps reference chips unchanged after normal graph selection', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    state.selectedItems.clear()
    state.selectedItems.add(state.nodes[0])
    hostStores.canvas.updateSelectedItems()
    await nextTick()

    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
  })

  it('merges referenced nodes with the existing graph selection when node-selection mode starts', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    state.selectedItems.clear()
    state.selectedItems.add(state.nodes[0])
    hostStores.canvas.updateSelectedItems()
    state.selectItems.mockClear()

    await enterNodeSelectionMode()

    expect(state.selectItems).toHaveBeenCalledWith([
      state.nodes[0],
      state.nodes[1]
    ])
    expect([...state.selectedItems]).toEqual([state.nodes[0], state.nodes[1]])
    expect(await screen.findByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('merges an off-view subgraph reference with the current root selection', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    const subgraphNode = nestSelectionCanvasInSubgraph(state)
    state.nodes[1].id = 'shared'

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    const rootNode: SelectionTestNode = {
      isNodeFake: true,
      id: 'shared',
      title: 'Root node',
      boundingRect: {}
    }
    appMock.graph.nodes = [subgraphNode, rootNode]
    showRootGraph(state, [rootNode])
    state.selectedItems.clear()
    state.selectedItems.add(rootNode)
    hostStores.canvas.updateSelectedItems()
    state.selectItems.mockClear()
    await nextTick()

    await enterNodeSelectionMode()

    expect(state.selectItems).toHaveBeenCalledWith([rootNode, state.nodes[1]])
    expect([...state.selectedItems]).toEqual([rootNode, state.nodes[1]])
    expect(screen.getByText('Root node')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('restores an off-view subgraph reference by locator after a panel remount', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    const subgraphNode = nestSelectionCanvasInSubgraph(state)
    const referencedNode = state.nodes[1]
    referencedNode.id = 'shared'
    referencedNode.title = 'Subgraph twin'
    const rootTwin: SelectionTestNode = {
      isNodeFake: true,
      id: 'shared',
      title: 'Root twin',
      boundingRect: {}
    }
    appMock.graph.nodes = [subgraphNode, rootTwin]
    const panelStore = useAgentPanelStore()

    const first = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    panelStore.isOpen = true
    await openMentionPicker()
    await userEvent.click(await screen.findByText('Subgraph twin'))

    showRootGraph(state, [rootTwin])
    panelStore.isOpen = false
    await nextTick()
    first.unmount()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    panelStore.isOpen = true
    await nextTick()

    expect(screen.getByText('Subgraph twin')).toBeInTheDocument()
    expect(screen.queryByText('Root twin')).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Show Subgraph twin #shared on canvas'
      })
    )
    expect(focusNodeInstance).toHaveBeenCalledWith(referencedNode)
  })
  it('does not resend a canvas selection after its chip was consumed', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    await sendFromComposer('first ask')
    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['12'] } })

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })

    expect([...state.selectedItems]).toEqual([state.nodes[1]])
    await sendFromComposer('second ask')
    expect(bodies[1]).not.toHaveProperty('selection')
  })

  it('keeps normal graph selections out of the composer across a panel remount', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.graph.nodes = [{ id: 7, title: 'KSampler' }]

    const panelStore = useAgentPanelStore()
    const first = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    panelStore.isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #7 reference' })
    )
    panelStore.isOpen = false
    await nextTick()
    first.unmount()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    panelStore.isOpen = true
    await nextTick()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
    await sendFromComposer('no nodes please')

    expect(bodies[0]).not.toHaveProperty('selection')

    ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })
    hostStores.canvas.selectedItems = [
      { isNodeFake: true, id: 7, title: 'KSampler' }
    ]
    await nextTick()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
    await sendFromComposer('still no nodes')
    expect(bodies[1]).not.toHaveProperty('selection')

    ws.emit('agent_message_done', { message_id: 'm-2', thread_id: 'th-1' })
    await screen.findByRole('button', { name: 'Send' })
    hostStores.canvas.selectedItems = [
      { isNodeFake: true, id: 8, title: 'VAEDecode' }
    ]
    await nextTick()
    expect(screen.queryByText('VAEDecode')).not.toBeInTheDocument()
    await sendFromComposer('use the new selection')
    expect(bodies[2]).not.toHaveProperty('selection')
  })

  it('stages the same node id in another unsaved workflow after a panel remount', async () => {
    hostStores.workflow.activeWorkflow = addTab(
      'workflows/Unsaved Workflow.json',
      { isTemporary: true }
    )
    const bodies = mockMessagesEndpoint('wf-42')
    const panelStore = useAgentPanelStore()
    appMock.graph.nodes = [{ id: 7, title: 'First KSampler' }]
    const first = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    panelStore.isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('First KSampler'))
    expect(await screen.findByText('First KSampler')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove First KSampler #7 reference'
      })
    )
    panelStore.isOpen = false
    await nextTick()
    first.unmount()

    hostStores.workflow.activeWorkflow = addTab(
      'workflows/Unsaved Workflow (2).json',
      { isTemporary: true }
    )
    appMock.graph.nodes = [{ id: 7, title: 'Second KSampler' }]
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    panelStore.isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('Second KSampler'))
    await sendFromComposer('use this workflow')
    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['7'] } })
  })

  it('keeps modifier-free legacy LiteGraph clicks selected', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    const selectLegacyNode = (node: SelectionTestNode) => {
      if (!state.canvas.multi_select) state.selectedItems.clear()
      state.selectedItems.add(node)
      hostStores.canvas.updateSelectedItems()
    }
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    renderCanvasNodeButtons(state.nodes, selectLegacyNode)
    useAgentPanelStore().isOpen = true

    await enterNodeSelectionMode()
    const buttons = state.nodes.map((node) =>
      screen.getByRole('button', { name: `Canvas ${node.title}` })
    )
    await userEvent.click(buttons[0])
    await userEvent.click(buttons[1])

    expect(await screen.findByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect([...state.selectedItems]).toEqual(state.nodes)
    expect(state.selectItems).not.toHaveBeenCalled()
  })

  it('does not restore a deselected node after selecting another node', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    const thirdNode: SelectionTestNode = {
      isNodeFake: true,
      id: 15,
      title: 'Save Image',
      boundingRect: {}
    }
    state.nodes.push(thirdNode)
    const toggleNode = (node: SelectionTestNode) => {
      if (state.selectedItems.has(node)) state.selectedItems.delete(node)
      else state.selectedItems.add(node)
      hostStores.canvas.updateSelectedItems()
    }
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    renderCanvasNodeButtons(state.nodes, toggleNode)
    useAgentPanelStore().isOpen = true

    await enterNodeSelectionMode()
    const buttons = state.nodes.map((node) =>
      screen.getByRole('button', { name: `Canvas ${node.title}` })
    )
    await userEvent.click(buttons[0])
    await userEvent.click(buttons[1])
    await userEvent.click(buttons[0])
    await userEvent.click(buttons[2])

    expect([...state.selectedItems]).toEqual([state.nodes[1], thirdNode])
    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(screen.getByText('Save Image')).toBeInTheDocument()
    expect(state.selectItems).not.toHaveBeenCalled()
  })

  it('uses rectangle replacement as the active composer selection', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await enterNodeSelectionMode()
    state.selectedItems.add(state.nodes[0])
    hostStores.canvas.updateSelectedItems()
    state.selectItems.mockClear()

    state.selectedItems.clear()
    state.selectedItems.add(state.nodes[1])
    hostStores.canvas.updateSelectedItems()
    await nextTick()

    expect([...state.selectedItems]).toEqual([state.nodes[1]])
    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(state.selectItems).not.toHaveBeenCalled()
  })

  it('X-03 / PM-680 / FE-1311 keeps displayed node chips identical to every sent node id', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
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

  it('exits selection mode on Escape and keeps the selected-node chips', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(useAgentNodeSelectionStore().isActive).toBe(false)
    expect(selection.canvas.multi_select).toBe(false)
    expect(selection.canvas.allow_dragnodes).toBe(true)
    expect(selection.canvas.selectOnly).toBe(false)
    expect(selection.deselectAll).toHaveBeenCalledOnce()
    expect([...selection.selectedItems]).toEqual([])
    expect(screen.getByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('ends node selection when the viewed graph changes', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()
    const nextGraph = {
      nodes: [] as SelectionTestNode[],
      getNodeById: () => null
    }

    selection.canvas.graph = nextGraph
    hostStores.canvas.currentGraph = nextGraph
    await nextTick()

    expect(selection.canvas.multi_select).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('keeps each workflow node selection separate after a graph load', async () => {
    makeTab()
    const selection = await startVueNodeSelection()
    const secondNode = {
      isNodeFake: true as const,
      id: 20,
      title: 'Save Image',
      boundingRect: {}
    }
    const secondGraph = {
      nodes: [secondNode],
      getNodeById: (id: string | number) =>
        String(id) === '20' ? secondNode : null
    }
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.beginWorkflowLoad()
    nodeSelectionStore.restoreNodeIds(['20'])
    selection.canvas.graph = secondGraph
    selection.selectedItems.clear()
    selection.selectedItems.add(secondNode)
    hostStores.canvas.currentGraph = secondGraph
    hostStores.canvas.updateSelectedItems()
    await nextTick()

    expect(nodeSelectionStore.isLoadingWorkflow).toBe(false)
    expect([...selection.selectedItems]).toEqual([secondNode])
    expect(screen.getByText('Save Image')).toBeInTheDocument()
    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
  })

  it('finishes a workflow restore completed before the panel mounts', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    nodeSelectionStore.beginWorkflowLoad()
    nodeSelectionStore.restoreNodeIds(['9'])
    state.selectedItems.add(state.nodes[0])
    hostStores.canvas.updateSelectedItems()
    useAgentPanelStore().isOpen = true

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await nextTick()

    expect(nodeSelectionStore.isLoadingWorkflow).toBe(false)
    expect(screen.getByText('VAE Decode')).toBeInTheDocument()
  })

  it('resolves picker nodes from the viewed subgraph, not the root graph', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.canvas = {
      graph: {
        nodes: [{ id: 12, title: 'KSampler' }],
        getNodeById: () => null
      },
      selectedItems: new Set(),
      selectItems: vi.fn(),
      deselect: vi.fn(),
      multi_select: false,
      allow_dragnodes: true,
      selectOnly: false,
      canvas: { focus: vi.fn() }
    }

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await sendFromComposer('explain this')

    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['12'] } })
  })

  it('never subscribes to the retired draft_patch frame', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('help me')

    ws.emit('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 0,
      version: 1,
      content: { version: 0.4, nodes: [] }
    })
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })
})
