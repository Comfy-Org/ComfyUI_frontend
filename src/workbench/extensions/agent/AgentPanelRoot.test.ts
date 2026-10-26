import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { fromPartial } from '@total-typescript/shoehorn'
import { setImmediate } from 'node:timers/promises'

import type {
  AgentThreadListResponse,
  AgentThreadSummary,
  BillingStatus,
  GlobalSetting,
  PaginationInfo,
  SubscriptionTier
} from '@comfyorg/ingest-types'
import type { User } from 'firebase/auth'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest'
import {
  computed,
  createApp,
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  watch
} from 'vue'
import type { Ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { z } from 'zod'

vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/auth/useAuthDialogs'))

import { i18n } from '@/i18n'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { setupInlinePromptEditorDom } from './components/agent/composer/inlinePromptEditorTestSetup'
import { useAgentConsent } from './composables/agent/useAgentConsent'
import { useFreeUsePlacement } from './experiments/freeUsePlacement'

setupInlinePromptEditorDom()

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useTelemetry } from '@/platform/telemetry'
import type { AgentConsentTrigger } from '@/platform/telemetry/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import NodeSelectionModeBanner from '@/components/graph/NodeSelectionModeBanner.vue'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useToast } from '@/components/ui/toast/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { startAssetDrag } from '@/platform/assets/utils/assetDragUtil'
import { getFilenameDetails } from '@/utils/formatUtil'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { reportError } from '@/platform/telemetry/reportError'
// oxlint-disable-next-line comfy/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import {
  saveSelection,
  savedSelectionKeys,
  setCanvasSelection
} from '@/utils/__tests__/canvasSelectionTestUtils'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import {
  createMockLoadedWorkflow,
  createMockChangeTracker,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'
import {
  createMockCanvasRenderingContext2D,
  createTestDragAndScale
} from '@/utils/__tests__/canvasTestUtils'

const getServerFeature = vi.hoisted(() =>
  vi.fn((_name: string, defaultValue?: unknown) => defaultValue)
)
const focusNodeInstance = vi.hoisted(() => vi.fn())
const socketSend = vi.hoisted(() => vi.fn())
let agentSocket: ReturnType<typeof createFakeAgentSocket>
const currentUserInfo = ref<{ id: string } | null>(null)
const withConsent = vi.fn<
  (trigger: AgentConsentTrigger, onAccept: () => void) => Promise<void>
>(async (_trigger, onAccept) => onAccept())

vi.mock(import('./composables/agent/useAgentConsent'), { spy: true })

vi.mock<unknown>(import('@/composables/canvas/useFocusNode'), () => ({
  useFocusNode: () => ({ focusNodeInstance })
}))

vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('./experiments/freeUsePlacement'), { spy: true })

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
    // The doc-frame pipeline ignores events that are not CustomEvent instances.
    const event = new CustomEvent(type, { detail: data })
    for (const listener of listeners.get(type) ?? []) listener(event)
    agentSocket.receive(type, data)
  }
  const clear = (): void => {
    listeners.clear()
  }
  return { add, remove, emit, clear }
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    apiURL: vi.fn((route: string) => `/api${route}`),
    fetchApi: (route: string, options?: RequestInit) =>
      fetch(route.startsWith('/api') ? route : `/api${route}`, options),
    getServerFeature,
    socket: { readyState: 1, send: socketSend },
    dispatchCustomEvent: vi.fn(),
    addEventListener: ws.add,
    removeEventListener: ws.remove,
    addCustomEventListener: ws.add,
    removeCustomEventListener: ws.remove
  }
}))

const appMock = vi.hoisted(() => {
  const graph = {
    nodes: [] as unknown[],
    _nodes: [] as LGraph['_nodes'],
    _nodes_by_id: {} as LGraph['_nodes_by_id'],
    arrange: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    setDirtyCanvas: vi.fn(),
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
  Object.assign(graph, { rootGraph: graph })
  return {
    loadGraphData: vi.fn(),
    ui: { autoQueueEnabled: false },
    graph,
    rootGraph: graph,
    isGraphReady: false,
    canvas: undefined as
      | LGraphCanvas
      | {
          graph: {
            nodes: unknown[]
            getNodeById: (id: string) => unknown
          }
          selectedItems: Set<LGraphNode>
          selectItems: ReturnType<typeof vi.fn>
          deselect: (node: LGraphNode) => void
          canvas: HTMLCanvasElement
        }
      | undefined
  }
})

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: appMock }))

vi.mock(import('@/platform/workflow/validation/schemas/workflowSchema'), {
  spy: true
})

let workflowStore: ReturnType<typeof useWorkflowStore>
let canvasStore: ReturnType<typeof useCanvasStore>
let executionErrors: Mocked<ReturnType<typeof useExecutionErrorStore>>

vi.mock(import('@/platform/workflow/core/services/workflowService'))

vi.mock<unknown>(import('@/utils/litegraphUtil'), async () => {
  const { LGraphNode } = await import('@/lib/litegraph/src/litegraph')
  return {
    isLGraphNode: (item: unknown): item is LGraphNode =>
      item instanceof LGraphNode ||
      (item as { isNodeFake?: boolean } | null)?.isNodeFake === true
  }
})

vi.mock(import('@/composables/auth/useCurrentUser'))

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))

vi.mock(import('@vueuse/core'), { spy: true })

vi.mock(import('@/platform/telemetry'))
const telemetryProvider = useTelemetry()
assert.exists(telemetryProvider)
const telemetry = vi.mocked(telemetryProvider)

// Counts up rather than returning a constant, so a cached id would show up as a
// repeat instead of passing.
const nextClientMessageId = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('uuid'), () => ({ v4: nextClientMessageId }))

const distribution = vi.hoisted(() => ({ isCloud: true, isDesktop: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

const openAccountPrecondition = vi.hoisted(() => vi.fn())
vi.mock(
  import('@/platform/billing/subscription/composables/useAccountPreconditionDialog'),
  () => ({
    useAccountPreconditionDialog: () => ({ open: openAccountPrecondition })
  })
)

const paywallWorkspace = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'member' | undefined
}))
const paywallCapabilities = reactive({
  canTopUp: true,
  canSubscribeSelfServe: true,
  isReady: true,
  hasResolvedCapabilities: true,
  snapshotAuthoritative: true
})
const paywallBilling = vi.hoisted(() => ({
  tier: 'STANDARD' as SubscriptionTier | null,
  type: 'workspace' as 'workspace' | 'legacy',
  status: 'paid' as BillingStatus | null,
  isActive: true,
  fetchStatus: vi.fn<() => Promise<void>>()
}))
const paywallHasFunds = ref<boolean | null>(false)
const paywallAgentHasFunds = ref<boolean | undefined>()
const paywallAgentScopedHasFunds = ref<boolean | undefined>()

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'), {
  spy: true
})
vi.mock(import('./services/agent/agentEventSource'), { spy: true })
vi.mock(import('./services/agent/agentIdentity'), { spy: true })
vi.mock(import('./crdt/devPanelLog'), { spy: true })
vi.mock(import('@/platform/billing/composables/useBillingContext'), {
  spy: true
})
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'), {
  spy: true
})

import type { ComposerReference } from './types/composerPrompt'
import type { AgentMessages, TurnId } from './schemas/agentApiSchema'
import { toTurnId, zAgentWsEvent } from './schemas/agentApiSchema'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TURN_ATTACHMENTS
} from './composables/agent/useAttachment'
import { useBillingIdentity } from './composables/useBillingIdentity'
import type { AgentChatEvent } from './services/agent/agentEventTransport'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { getMinimapDecorations } from '@/platform/canvas/minimapDecorationRegistry'
import { useAgentGraphActivityStore } from './stores/agent/agentGraphActivityStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentComposerStore } from './stores/agent/agentComposerStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'
import { createFakeAgentSocket } from './crdt/__fixtures__/agentSocket'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { resolveAgentIdentity } from './services/agent/agentIdentity'
import type { AgentIdentityState } from './services/agent/agentIdentity'
import { attachDocOpMinter } from './crdt/docOpMinter'
import { attachRestoreOpMinter } from './crdt/restoreOpMinter'
import { recordUnsyncedHumanOps } from './crdt/unsyncedHumanOps'
import type { DocOpMinter, DocOpMinterDeps } from './crdt/docOpMinter'

const docOpMinterDeps = vi.hoisted(() => ({
  current: null as DocOpMinterDeps | null
}))
vi.mock(import('./crdt/docOpMinter'), { spy: true })
vi.mock(import('./crdt/restoreOpMinter'), { spy: true })

// The mock replaces the real `attachDocOpMinter` body entirely. It only
// captures `deps` for assertions below — it must NOT reproduce any of that
// body's own behaviour (e.g. the doc-bound probe registration), or a test
// against the reimplementation could stay green while the real one breaks.
// The doc-bound probe's registration/disposal is covered directly against
// the real `attachDocOpMinter` in `docOpMinter.test.ts`.
function stubAttachDocOpMinter(deps: DocOpMinterDeps): DocOpMinter {
  docOpMinterDeps.current = deps
  return fromPartial<DocOpMinter>({
    detach: vi.fn()
  })
}
vi.mocked(attachDocOpMinter).mockImplementation(stubAttachDocOpMinter)

import AgentPanelRoot from './AgentPanelRoot.vue'
import DockedAgentPanel from './components/agent/DockedAgentPanel.vue'

function syncFakeSelection() {
  setCanvasSelection([...(canvasStore.canvas?.selectedItems ?? [])])
}

beforeEach(() => {
  distribution.isCloud = true
  distribution.isDesktop = false
  agentSocket = createFakeAgentSocket()
  agentSocket.send.mockImplementation((frame) => {
    socketSend(frame)
    return true
  })
  vi.mocked(createAgentEventSource).mockReturnValue(agentSocket.socket)
  vi.mocked(resolveAgentIdentity).mockReturnValue({
    state: ref<AgentIdentityState>({ status: 'resolved', userId: 'account-a' }),
    reset: vi.fn(),
    stop: () => {}
  })
  useAuthStore().currentUser = fromPartial<User>({ uid: 'account-a' })
  vi.spyOn(useAuthStore(), 'getUserAuthHeader').mockResolvedValue({
    Authorization: 'Bearer id-token'
  })
  let clientMessageIds = 0
  nextClientMessageId.mockImplementation(
    () => `client-message-${++clientMessageIds}`
  )
  useCurrentUser().isLoggedIn = computed(() => true)
  useCurrentUser().userDisplayName = computed(() => 'Jo Rivera')
  currentUserInfo.value = { id: 'account-a' }
  useCurrentUser().resolvedUserInfo = computed(() => currentUserInfo.value)
  Object.assign(useAgentConsentStore(), { accepted: true })
  const consent = useAgentConsent()
  consent.withConsent = withConsent
  vi.mocked(useAgentConsent).mockReturnValue(consent)
  vi.mocked(validateComfyWorkflow).mockImplementation(async (content) =>
    fromPartial<ComfyWorkflowJSON>(
      typeof content === 'object' && content !== null ? content : {}
    )
  )
  vi.mocked(useClipboard).mockReturnValue(
    fromPartial({
      copy: clipboard.copy,
      copied: computed(() => false),
      isSupported: ref(true),
      text: ref('')
    })
  )
  vi.mocked(useWorkspaceUI).mockReturnValue(
    fromPartial({
      workspaceRole: computed(() => paywallWorkspace.role)
    })
  )
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      subscription: computed(() =>
        paywallHasFunds.value === null
          ? null
          : fromPartial({
              hasFunds: paywallHasFunds.value,
              agentHasFunds:
                paywallAgentHasFunds.value ?? paywallHasFunds.value,
              agentScopedHasFunds: paywallAgentScopedHasFunds.value
            })
      ),
      tier: computed(() => paywallBilling.tier),
      type: computed(() => paywallBilling.type),
      billingStatus: computed(() => paywallBilling.status),
      canAccessSubscriptionFeatures: computed(() => paywallBilling.isActive),
      fetchStatus: paywallBilling.fetchStatus
    })
  )
  vi.mocked(useBillingCapabilities).mockReturnValue(
    fromPartial({
      canTopUp: computed(() => paywallCapabilities.canTopUp),
      canSubscribeSelfServe: computed(
        () => paywallCapabilities.canSubscribeSelfServe
      ),
      isReady: computed(() => paywallCapabilities.isReady),
      hasResolvedCapabilities: computed(
        () => paywallCapabilities.hasResolvedCapabilities
      ),
      snapshotAuthoritative: computed(
        () => paywallCapabilities.snapshotAuthoritative
      )
    })
  )
  workflowStore = useWorkflowStore()
  canvasStore = useCanvasStore()
  vi.mocked(useWorkflowService()).saveWorkflow.mockImplementation(
    async (tab) => {
      tab.isModified = false
      return true
    }
  )
  vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementation(
    async (tab, options) => {
      if (options?.filename) {
        await workflowStore.renameWorkflow(
          tab,
          `${tab.directory}/${options.filename}.json`
        )
      }
      Object.assign(tab, { isTemporary: false })
      tab.isModified = false
      return true
    }
  )
  vi.mocked(useWorkflowService()).closeWorkflow.mockImplementation(
    async (tab, options) => {
      if (workflowStore.activeWorkflow?.path === tab.path) {
        const replacement = workflowStore.openWorkflows.find(
          (candidate) => candidate.path !== tab.path
        )
        workflowStore.activeWorkflow = replacement
          ? await replacement.load()
          : null
        if (replacement) options?.onReplacementOpened?.(replacement)
      }
      await workflowStore.closeWorkflow(tab)
      return true
    }
  )
  vi.mocked(useWorkflowService()).openWorkflow.mockImplementation(
    async (tab, options) => {
      const known = workflowStore.getWorkflowByPath(tab.path)
      if (known) {
        workflowStore.openWorkflowsInBackground({ right: [tab.path] })
        workflowStore.activeWorkflow = await known.load()
        if (options?.initiator === 'user')
          workflowStore.reportUserActivation(known)
      }
      return true
    }
  )
  executionErrors = vi.mocked(useExecutionErrorStore())
  executionErrors.showErrorOverlay.mockImplementation(() => {})
  vi.useRealTimers()
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  localStorage.clear()
  localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
  ws.clear()
  getServerFeature.mockReset()
  getServerFeature.mockImplementation(
    (_name: string, defaultValue?: unknown) => defaultValue
  )

  workflowStore.activeWorkflow = null
  setCanvasSelection([])
  canvasStore.currentGraph = null
  appMock.graph.nodes = []
  appMock.isGraphReady = false
  appMock.graph.arrange.mockClear()
  Object.assign(appMock.rootGraph, { subgraphs: new Map(), id: undefined })
  appMock.isGraphReady = false
  appMock.canvas = undefined
  docOpMinterDeps.current = null
  vi.mocked(attachDocOpMinter).mockImplementation(stubAttachDocOpMinter)
  vi.mocked(useWorkflowService()).saveWorkflow.mockClear()
  vi.mocked(useWorkflowService()).saveWorkflowAs.mockClear()
  vi.mocked(useWorkflowService()).openWorkflow.mockClear()
  vi.mocked(workflowStore.syncWorkflows).mockResolvedValue(undefined)
  focusNodeInstance.mockReset()
  socketSend.mockReset()
  vi.mocked(reportError).mockClear()
  paywallWorkspace.role = 'owner'
  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspace',
    'get'
  ).mockImplementation(() =>
    paywallWorkspace.role === undefined
      ? null
      : fromPartial({ role: paywallWorkspace.role })
  )
  paywallCapabilities.canTopUp = true
  paywallCapabilities.canSubscribeSelfServe = true
  paywallCapabilities.isReady = true
  paywallCapabilities.hasResolvedCapabilities = true
  paywallCapabilities.snapshotAuthoritative = true
  paywallBilling.tier = 'STANDARD'
  paywallBilling.type = 'workspace'
  paywallBilling.status = 'paid'
  paywallBilling.isActive = true
  paywallBilling.fetchStatus.mockReset().mockResolvedValue(undefined)
  paywallHasFunds.value = false
  paywallAgentHasFunds.value = undefined
  paywallAgentScopedHasFunds.value = undefined
})

const zAgentWsEventForTest = (raw: unknown): AgentChatEvent =>
  zAgentWsEvent.parse(raw)

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function agentThread({
  id,
  title,
  last_message_at,
  ...overrides
}: Pick<AgentThreadSummary, 'id' | 'title' | 'last_message_at'> &
  Partial<AgentThreadSummary>): AgentThreadSummary {
  return {
    created_at: last_message_at,
    id,
    last_message_at,
    message_count: 0,
    preview: '',
    status: 'active',
    title,
    updated_at: last_message_at,
    workflow_id: '',
    ...overrides
  }
}

const threadListRoute = /\/api\/agent\/threads\?/

function agentThreadList(
  threads: AgentThreadSummary[] = [],
  pagination: Partial<PaginationInfo> = {}
): AgentThreadListResponse {
  return {
    threads,
    pagination: {
      has_more: false,
      limit: Math.max(threads.length, 1),
      offset: 0,
      total: threads.length,
      ...pagination
    }
  }
}

function stubHistoryWithWorkflowListing(
  listingStatus: number | Promise<number>
): void {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('/messages'))
      return json(200, [
        {
          id: 'history-user',
          thread_id: 'th-history',
          seq: 1,
          role: 'user',
          status: 'complete',
          turn_id: 'history-turn',
          workflow_id: 'wf-gone',
          content: { text: 'Historical prompt' }
        }
      ] satisfies AgentMessages)
    if (url.includes('/agent/threads'))
      return json(
        200,
        agentThreadList([
          agentThread({
            id: 'th-history',
            title: 'Earlier chat',
            last_message_at: '2026-09-01T00:00:00Z'
          })
        ])
      )
    if (url.includes('/workflows'))
      return json(await listingStatus, {
        data: [],
        pagination: { offset: 0, limit: 100, total: 0, has_more: false }
      })
    return json(200, {})
  })
}

function ack(workflowId: string, messageId = 'm-1') {
  return { thread_id: 'th-1', message_id: messageId, workflow_id: workflowId }
}

function renderWithSelectedTarget() {
  const active = workflowStore.activeWorkflow
  useAgentPanelStore().setWorkflowTarget(
    active ? fromPartial<ComfyWorkflow>(active) : null
  )
  return render(AgentPanelRoot, { global: { plugins: [i18n] } })
}

function activateThread(): void {
  const conversation = useAgentConversationStore()
  conversation.setThreadId('th-active')
  const turnId = toTurnId('msg-first')
  conversation.recordUser(turnId, 'first message')
  conversation.messages.push({
    id: turnId,
    role: 'assistant',
    parts: [{ type: 'text', text: 'First reply', state: 'done' }],
    streaming: false,
    thinking: false
  })
}

async function sendFromComposer(text: string): Promise<void> {
  const textbox = screen.getByRole('textbox')
  await userEvent.click(textbox)
  await userEvent.keyboard('{ArrowRight}')
  await userEvent.paste(text)
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  await screen.findByRole('button', { name: 'Stop' })
}

async function renderAndSend(text: string): Promise<void> {
  renderWithSelectedTarget()
  await sendFromComposer(text)
}

async function activateTabAsUser(tab: ComfyWorkflow): Promise<void> {
  await useWorkflowService().openWorkflow(tab, { initiator: 'user' })
}

async function settleFollow(): Promise<void> {
  await setImmediate()
}

function addTab(
  path: string,
  overrides: Partial<LoadedComfyWorkflow> = {}
): LoadedComfyWorkflow {
  const slash = path.lastIndexOf('/')
  const { filename, suffix } = getFilenameDetails(path.slice(slash + 1))
  const tab = createMockLoadedWorkflow({
    instanceId: path,
    path,
    directory: path.slice(0, slash),
    filename,
    suffix,
    isTemporary: false,
    isModified: false,
    activeState: null,
    ...overrides
  })
  tab.load = vi.fn(async () => tab)
  tab.unload = vi.fn()
  tab.rename = vi.fn(async (newPath: string) => {
    const { filename, suffix } = getFilenameDetails(
      newPath.slice(newPath.lastIndexOf('/') + 1)
    )
    Object.assign(tab, { path: newPath, filename, suffix })
    return tab
  })
  workflowStore.attachWorkflow(tab, workflowStore.openWorkflows.length)
  workflowStore.openWorkflowsInBackground({ right: [tab.path] })
  return tab
}

describe('AgentPanelRoot first-use experience', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async () =>
      json(200, agentThreadList())
    )
  })

  it('opens directly to the composer without another dialog', async () => {
    const history = useAgentChatHistoryStore()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    await vi.waitFor(() => expect(history.replaceAll).toHaveBeenCalledWith([]))

    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  const reportFreeUseNotice = vi.fn()

  function placeFundedFreeUseNotice() {
    paywallHasFunds.value = true
    paywallAgentScopedHasFunds.value = true
    vi.mocked(useFreeUsePlacement).mockReturnValueOnce(
      fromPartial({
        variant: ref('top-banner'),
        reportNotice: reportFreeUseNotice
      })
    )
  }

  function freeUseNotice() {
    return screen.findByRole('note', { name: 'Free use notice' })
  }

  it('forwards free-use notice interactions to the experiment', async () => {
    placeFundedFreeUseNotice()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      within(await freeUseNotice()).getByRole('button', { name: 'Dismiss' })
    )

    expect(reportFreeUseNotice.mock.calls).toEqual([
      [{ action: 'shown', placement: 'top-banner' }],
      [{ action: 'dismissed', placement: 'top-banner' }]
    ])
  })

  it.for([
    { label: 'the grant is spent but paid credits remain', scoped: false },
    { label: 'no scoped balance is reported at all', scoped: undefined }
  ])('says nothing about free turns when $label', async ({ scoped }) => {
    placeFundedFreeUseNotice()
    paywallAgentScopedHasFunds.value = scoped

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    expect(screen.queryByRole('note', { name: 'Free use notice' })).toBeNull()
    expect(reportFreeUseNotice).not.toHaveBeenCalled()
  })

  it('hides the notice while any inline paywall remains unresolved', async () => {
    placeFundedFreeUseNotice()
    const conversation = useAgentConversationStore()

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await freeUseNotice()

    conversation.recordPaywall(toTurnId('msg-paywall'), 'continue')
    expect(await findInlinePaywallButton('Add credits')).toBeInTheDocument()
    conversation.recordFailedSend(
      toTurnId('msg-failed'),
      'try again',
      'Send failed'
    )
    await screen.findByText('Send failed')

    await vi.waitFor(() =>
      expect(screen.queryByRole('note', { name: 'Free use notice' })).toBeNull()
    )

    conversation.resolvePaywalls()

    expect(await freeUseNotice()).toBeInTheDocument()
  })
})

describe('AgentPanelRoot onboarding', () => {
  const SCOPED_KEY = 'Comfy.AgentPanel.onboarded.account-a.workspace-a'

  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a'
    })
    localStorage.removeItem('Comfy.AgentPanel.onboarded')
    localStorage.removeItem(SCOPED_KEY)
  })

  it('shows the scoped coach after first consent despite a legacy seen flag', async () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
    const consentStore = useAgentConsentStore()
    Object.assign(consentStore, { accepted: false })

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(localStorage.getItem(SCOPED_KEY)).toBeNull()

    Object.assign(consentStore, { accepted: true })

    expect(
      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).toBeInTheDocument()
    expect(localStorage.getItem(SCOPED_KEY)).not.toBe('true')
  })

  it('still carries the legacy seen flag for an already-consented scope', () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(localStorage.getItem(SCOPED_KEY)).toBe('true')
    expect(localStorage.getItem('Comfy.AgentPanel.onboarded')).toBeNull()
  })

  it('replays a finished tour from the header and reports it shown again', async () => {
    localStorage.setItem(SCOPED_KEY, 'true')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(
      screen.queryByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).not.toBeInTheDocument()
    vi.mocked(useTelemetry()!.trackAgentOnboardingShown).mockClear()

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }))

    // Routing matters, not just the effect: the mounted coach has to take the
    // transition. Clearing storage instead would still show the card here while
    // silently skipping the shown event.
    expect(
      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).toBeInTheDocument()
    expect(useTelemetry()!.trackAgentOnboardingShown).toHaveBeenCalledTimes(1)
  })

  it('holds a replay requested while App Mode has the coach deferred', async () => {
    localStorage.setItem(SCOPED_KEY, 'true')
    canvasStore.linearMode = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(
      screen.queryByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).not.toBeInTheDocument()

    // No coach is mounted to take the transition, so the request has to persist.
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }))
    expect(localStorage.getItem(SCOPED_KEY)).not.toBe('true')

    canvasStore.linearMode = false
    expect(
      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).toBeInTheDocument()
  })

  it('defers the tour in App Mode without completing it or blocking the composer', async () => {
    canvasStore.linearMode = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), 'Explain this app')
    expect(screen.getByRole('textbox')).toHaveTextContent('Explain this app')
    expect(localStorage.getItem(SCOPED_KEY)).not.toBe('true')
    expect(canvasStore.linearMode).toBe(true)

    canvasStore.linearMode = false
    expect(
      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).toBeInTheDocument()
    expect(localStorage.getItem(SCOPED_KEY)).not.toBe('true')
  })

  it('reports a coach held back by another tour', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-tour'
    })
    const firstRunHolds = ref(true)
    registerTour(
      'firstRun',
      () =>
        Promise.resolve([
          { kind: 'spotlight', name: 'run', placement: 'center' }
        ]),
      firstRunHolds
    )
    const tourStore = useOnboardingTourStore()
    tourStore.replayTour('firstRun')
    await vi.waitFor(() => expect(tourStore.activeTour).toBe('firstRun'))
    try {
      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      expect(
        screen.queryByRole('dialog', { name: 'Meet your Comfy Agent' })
      ).not.toBeInTheDocument()
      expect(
        useTelemetry()!.trackAgentOnboardingNotShown
      ).toHaveBeenCalledExactlyOnceWith({ reason: 'tour_active' })
    } finally {
      firstRunHolds.value = false
    }
  })

  it('defers the coach while a global dialog is open, like the desktop sign-in confirm', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-dialog'
    })
    const dialogStore = useDialogStore()
    const dialog = dialogStore.showDialog({
      component: defineComponent({})
    })

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(
      screen.queryByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).not.toBeInTheDocument()
    expect(
      useTelemetry()!.trackAgentOnboardingNotShown
    ).toHaveBeenCalledExactlyOnceWith({ reason: 'dialog_open' })

    dialogStore.closeDialog({ key: dialog.key })
    expect(
      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).toBeInTheDocument()
  })

  it('stays quiet when App Mode pauses a coach that was already on screen', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-interrupted'
    })
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(
      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    ).toBeInTheDocument()

    canvasStore.linearMode = true
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Meet your Comfy Agent' })
      ).not.toBeInTheDocument()
    )

    expect(useTelemetry()!.trackAgentOnboardingNotShown).not.toHaveBeenCalled()
  })

  it('reports the deferral once the workspace resolves after mount', async () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    canvasStore.linearMode = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(useTelemetry()!.trackAgentOnboardingNotShown).not.toHaveBeenCalled()

    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-late'
    })

    await vi.waitFor(() =>
      expect(
        useTelemetry()!.trackAgentOnboardingNotShown
      ).toHaveBeenCalledExactlyOnceWith({ reason: 'app_mode' })
    )
  })

  it('reports a deferral once however often the panel remounts', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-remount'
    })
    canvasStore.linearMode = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } }).unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(
      useTelemetry()!.trackAgentOnboardingNotShown
    ).toHaveBeenCalledExactlyOnceWith({ reason: 'app_mode' })
  })

  it('says nothing about App Mode to a user who already finished the tour', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-seen'
    })
    localStorage.setItem(
      'Comfy.AgentPanel.onboarded.account-a.workspace-seen',
      'true'
    )
    canvasStore.linearMode = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(useTelemetry()!.trackAgentOnboardingNotShown).not.toHaveBeenCalled()
  })

  it('walks through the four cards and leaves the composer usable after Done', async () => {
    render(
      defineComponent({
        setup: () => () =>
          h('div', [
            h('section', { class: 'graph-canvas-panel' }, [
              h('div', { role: 'toolbar' })
            ]),
            h(AgentPanelRoot)
          ])
      }),
      { global: { plugins: [i18n] } }
    )

    for (const [index, { title, description }] of [
      {
        title: 'Meet your Comfy Agent',
        description:
          'Describe your ideas, ask it to build and run workflows. It sees your canvas and files.'
      },
      {
        title: "Your agent edits the workflow you're viewing",
        description:
          'It switches with your tabs until you send a message, choose a workflow, or add a node reference.'
      },
      {
        title: 'Let the agent run while you edit',
        description:
          'You can still edit the graph or switch tabs while the agent is working.'
      },
      {
        title: 'Pick up where you left off',
        description:
          'Previous chats are saved here. Open one to review it or continue working with the agent.'
      }
    ].entries()) {
      const dialog = await screen.findByRole('dialog', { name: title })
      expect(dialog).toHaveAccessibleDescription(description)
      await waitFor(() =>
        expect(within(dialog).getByText(`${index + 1} of 4`)).toBeVisible()
      )
      await userEvent.click(
        within(dialog).getByRole('button', {
          name: index === 3 ? 'Done' : 'Next'
        })
      )
    }

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(SCOPED_KEY)).toBe('true')
    const composer = screen.getByRole('textbox')
    await userEvent.click(composer)
    expect(composer).toHaveFocus()
  })

  it('preserves legacy tour completion when the panel mounts again', async () => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(SCOPED_KEY)).toBe('true')
    expect(localStorage.getItem('Comfy.AgentPanel.onboarded')).toBeNull()

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

/**
 * The transcript, for assertions that mean the INLINE paywall card - the one
 * rendered against the turn a 402 refused. The panel now also has a standing
 * credits-exhausted card beside the composer, and both render the same
 * component with the same copy, so an unscoped
 * `getByRole('button', { name: 'Subscribe' })` no longer says which it found.
 */
function inlinePaywall() {
  return within(screen.getByTestId('agent-conversation'))
}

function findInlinePaywallButton(name: string): Promise<HTMLElement> {
  return vi.waitFor(() => inlinePaywall().getByRole('button', { name }))
}

function queryInlinePaywallButton(name: string): HTMLElement | null {
  const view = screen.queryByTestId('agent-conversation')
  return view ? within(view).queryByRole('button', { name }) : null
}

function findInlinePaywallText(text: string): Promise<HTMLElement> {
  return vi.waitFor(() => inlinePaywall().getByText(text))
}

function queryInlinePaywallText(text: string): HTMLElement | null {
  const view = screen.queryByTestId('agent-conversation')
  return view ? within(view).queryByText(text) : null
}

describe('AgentPanelRoot paywall actions', () => {
  beforeEach(() => {
    openAccountPrecondition.mockClear()
  })

  it('routes the subscribed owner actions through account preconditions', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    await userEvent.click(await findInlinePaywallButton('Upgrade plan'))
    expect(openAccountPrecondition).toHaveBeenCalledExactlyOnceWith(
      'subscription',
      { source: 'agent_paywall' }
    )

    await userEvent.click(
      inlinePaywall().getByRole('button', { name: 'Add credits' })
    )
    expect(openAccountPrecondition.mock.calls).toEqual([
      ['subscription', { source: 'agent_paywall' }],
      ['credits', { source: 'agent_paywall' }]
    ])
  })

  it('routes Subscribe through the subscription precondition', async () => {
    paywallCapabilities.canTopUp = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    await userEvent.click(await findInlinePaywallButton('Subscribe'))

    expect(openAccountPrecondition).toHaveBeenCalledExactlyOnceWith(
      'subscription',
      { source: 'agent_paywall' }
    )
  })

  it('dismisses the paywall after billing confirms funds are available', async () => {
    paywallCapabilities.canTopUp = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'continue'
    )

    expect(await findInlinePaywallButton('Subscribe')).toBeInTheDocument()

    paywallHasFunds.value = true

    await vi.waitFor(() =>
      expect(queryInlinePaywallText('Out of credits')).not.toBeInTheDocument()
    )
  })

  it('dismisses an existing paywall when remounting after a top-up', async () => {
    paywallCapabilities.canTopUp = false
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'continue'
    )
    expect(await findInlinePaywallButton('Subscribe')).toBeInTheDocument()

    panel.unmount()
    paywallHasFunds.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await vi.waitFor(() =>
      expect(queryInlinePaywallText('Out of credits')).not.toBeInTheDocument()
    )
  })

  it('shows a fresh denial while the cached billing state still has funds', async () => {
    paywallCapabilities.canTopUp = false
    paywallHasFunds.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(await screen.findByRole('textbox')).toBeInTheDocument()

    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'render one more frame'
    )

    expect(await findInlinePaywallButton('Subscribe')).toBeInTheDocument()
  })

  it('keeps a resolved paywall hidden while billing state is unknown', async () => {
    paywallCapabilities.canTopUp = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'continue'
    )
    expect(await findInlinePaywallButton('Subscribe')).toBeInTheDocument()

    paywallHasFunds.value = true
    await vi.waitFor(() =>
      expect(queryInlinePaywallButton('Subscribe')).not.toBeInTheDocument()
    )

    paywallHasFunds.value = null
    await nextTick()
    expect(queryInlinePaywallText('Out of credits')).not.toBeInTheDocument()
  })

  it('shows only a new denial after funds run out again', async () => {
    paywallCapabilities.canTopUp = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'continue'
    )
    expect(await findInlinePaywallButton('Subscribe')).toBeInTheDocument()

    paywallHasFunds.value = true
    await vi.waitFor(() =>
      expect(queryInlinePaywallButton('Subscribe')).not.toBeInTheDocument()
    )

    paywallHasFunds.value = false
    await nextTick()
    expect(queryInlinePaywallText('Out of credits')).not.toBeInTheDocument()

    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall-2'),
      'try again'
    )
    await vi.waitFor(() =>
      expect(
        inlinePaywall().getByRole('button', { name: 'Subscribe' })
      ).toBeInTheDocument()
    )
  })

  it('hides purchase actions from a Team member without billing permissions', async () => {
    paywallWorkspace.role = 'member'
    paywallCapabilities.canTopUp = false
    paywallCapabilities.canSubscribeSelfServe = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    await screen.findByText(
      'This workspace has used all its credits. Ask your workspace owner to add more.'
    )
    expect(queryInlinePaywallButton('Add credits')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upgrade|subscribe/i })
    ).not.toBeInTheDocument()
  })

  it.for(['PRO', 'TEAM'] as const)(
    'shows Add credits only for a %s owner even when self-serve subscription is allowed',
    async (tier) => {
      paywallBilling.tier = tier
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      useAgentConversationStore().messages.push({
        id: toTurnId('msg-paywall'),
        role: 'assistant',
        parts: [{ type: 'paywall' }],
        streaming: false,
        thinking: false
      })

      expect(await findInlinePaywallButton('Add credits')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /upgrade|subscribe/i })
      ).not.toBeInTheDocument()
    }
  )

  it('keeps Add credits but hides Upgrade when self-serve subscription is unavailable', async () => {
    paywallCapabilities.canSubscribeSelfServe = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    expect(await findInlinePaywallButton('Add credits')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upgrade|subscribe/i })
    ).not.toBeInTheDocument()
  })

  it('shows Subscribe only when the server allows self-serve subscription but not top-up', async () => {
    paywallCapabilities.canTopUp = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    expect(await findInlinePaywallButton('Subscribe')).toBeInTheDocument()
    expect(queryInlinePaywallButton('Add credits')).not.toBeInTheDocument()
  })

  it('shows sales-managed remediation for a ready owner with no self-serve capability', async () => {
    paywallCapabilities.canTopUp = false
    paywallCapabilities.canSubscribeSelfServe = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    expect(
      await findInlinePaywallText(
        'This workspace is billed through your Comfy account team. Contact them to add credits.'
      )
    ).toBeInTheDocument()
    expect(queryInlinePaywallButton('Add credits')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upgrade|subscribe/i })
    ).not.toBeInTheDocument()
  })

  // Each unresolved input is its own wiring test: the panel reads
  // `hasResolvedCapabilities` and `workspaceRole`, so a table varying both at
  // once would need a conditional body. Which states count as settled belongs
  // to useBillingCapabilities.test.ts, which owns that split; these cases only
  // pin what the panel renders from the inputs it is handed.
  async function expectWithheldPurchaseActions() {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentConversationStore().messages.push({
      id: toTurnId('msg-paywall'),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })

    expect(await screen.findByText('Out of credits')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add credits|upgrade|subscribe/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/billed through your Comfy account team/i)
    ).not.toBeInTheDocument()
  }

  it('withholds purchase actions while capabilities are unresolved, without inventing a sales-managed plan', async () => {
    paywallCapabilities.canTopUp = false
    paywallCapabilities.canSubscribeSelfServe = false
    paywallCapabilities.hasResolvedCapabilities = false

    await expectWithheldPurchaseActions()
  })

  it('withholds purchase actions while the workspace role is unresolved, without inventing a sales-managed plan', async () => {
    paywallCapabilities.canTopUp = false
    paywallCapabilities.canSubscribeSelfServe = false
    paywallWorkspace.role = undefined

    await expectWithheldPurchaseActions()
  })
})

describe('AgentPanelRoot paywall telemetry', () => {
  let canTopUp: Ref<boolean>
  let canSubscribeSelfServe: Ref<boolean>
  let hasResolvedCapabilities: Ref<boolean>
  let capabilityReadSettled: Ref<boolean>
  let snapshotAuthoritative: Ref<boolean>
  let workspaceRole: Ref<'owner' | 'member' | undefined>
  let tier: Ref<SubscriptionTier | null>
  let hasFunds: Ref<boolean>

  beforeEach(() => {
    openAccountPrecondition.mockClear()
    vi.mocked(useTelemetry())!.trackAgentPaywallShown.mockClear()
    vi.mocked(useTelemetry())!.trackAgentPaywallCtaClicked.mockClear()
    vi.mocked(useTelemetry())!.trackAddApiCreditButtonClicked.mockClear()
    vi.mocked(useTelemetry())!.trackSubscription.mockClear()

    canTopUp = ref(true)
    canSubscribeSelfServe = ref(true)
    hasResolvedCapabilities = ref(true)
    capabilityReadSettled = ref(true)
    snapshotAuthoritative = ref(true)
    workspaceRole = ref<'owner' | 'member' | undefined>('owner')
    tier = ref<SubscriptionTier | null>('STANDARD')
    // Funded, so the standing credits-exhausted card stays off and every
    // assertion below is unambiguously about the refusal-driven inline card.
    // The standing surface has its own describe.
    hasFunds = ref(true)

    vi.mocked(useBillingCapabilities).mockReturnValue(
      fromPartial({
        canTopUp,
        canSubscribeSelfServe,
        isReady: capabilityReadSettled,
        hasResolvedCapabilities,
        snapshotAuthoritative
      })
    )
    vi.mocked(useWorkspaceUI).mockReturnValue(fromPartial({ workspaceRole }))
    vi.mocked(useBillingContext).mockReturnValue(
      fromPartial({
        subscription: computed(() => fromPartial({ hasFunds: hasFunds.value })),
        tier,
        type: computed(() => 'workspace'),
        billingStatus: computed(() => 'paid'),
        fetchStatus: vi.fn().mockResolvedValue(undefined)
      })
    )
  })

  function showPaywall(id = 'msg-paywall'): void {
    useAgentConversationStore().messages.push({
      id: toTurnId(id),
      role: 'assistant',
      parts: [{ type: 'paywall' }],
      streaming: false,
      thinking: false
    })
  }

  it.for([
    {
      name: 'an owner who can top up',
      topUp: true,
      selfServe: true,
      role: 'owner' as const,
      reason: 'no_funds'
    },
    {
      name: 'an owner who must subscribe first',
      topUp: false,
      selfServe: true,
      role: 'owner' as const,
      reason: 'subscription_inactive'
    },
    {
      name: 'a member without billing permissions',
      topUp: false,
      selfServe: false,
      role: 'member' as const,
      reason: 'member_cannot_pay'
    },
    {
      name: 'a sales-managed workspace',
      topUp: false,
      selfServe: false,
      role: 'owner' as const,
      reason: 'sales_managed'
    }
  ])(
    'reports the paywall shown to $name as $reason',
    async ({ topUp, selfServe, role, reason }) => {
      canTopUp.value = topUp
      canSubscribeSelfServe.value = selfServe
      workspaceRole.value = role
      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      showPaywall()

      await waitFor(() =>
        expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledWith({
          reason,
          surface: 'refused_send'
        })
      )
    }
  )

  it('does not report a paywall that was never shown', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    expect(useTelemetry()!.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  it('does not report the same paywall again after the panel is closed and reopened', async () => {
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()
    await waitFor(() =>
      expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    await nextTick()

    expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
  })

  it('reports a paywall raised after the panel is closed and reopened', async () => {
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall('msg-paywall-1')
    await waitFor(() =>
      expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    showPaywall('msg-paywall-2')

    await waitFor(() =>
      expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(2)
    )
  })

  it('reports one impression per paywall even as billing state re-evaluates', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()
    await waitFor(() =>
      expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    tier.value = 'PRO'
    await nextTick()
    canSubscribeSelfServe.value = false
    await nextTick()
    canTopUp.value = false
    await nextTick()
    await nextTick()

    expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
  })

  it('reports a second paywall later in the conversation', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall('msg-paywall-1')
    await waitFor(() =>
      expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    showPaywall('msg-paywall-2')

    await waitFor(() =>
      expect(useTelemetry()!.trackAgentPaywallShown).toHaveBeenCalledTimes(2)
    )
  })

  it('withholds the paywall report until the capability read settles, then reports it once', async () => {
    canTopUp.value = false
    hasResolvedCapabilities.value = false
    capabilityReadSettled.value = false
    snapshotAuthoritative.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    showPaywall()
    await nextTick()
    await nextTick()
    expect(useTelemetry()!.trackAgentPaywallShown).not.toHaveBeenCalled()

    hasResolvedCapabilities.value = true
    capabilityReadSettled.value = true
    snapshotAuthoritative.value = true

    await waitFor(() =>
      expect(
        useTelemetry()!.trackAgentPaywallShown
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'subscription_inactive',
        surface: 'refused_send'
      })
    )
  })

  it('does not report a confident reason from an unsettled read, and reports the real one once it settles', async () => {
    canTopUp.value = true
    canSubscribeSelfServe.value = false
    hasResolvedCapabilities.value = false
    capabilityReadSettled.value = false
    snapshotAuthoritative.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    showPaywall()
    await nextTick()
    await nextTick()
    expect(useTelemetry()!.trackAgentPaywallShown).not.toHaveBeenCalled()

    canTopUp.value = false
    canSubscribeSelfServe.value = true
    hasResolvedCapabilities.value = true
    capabilityReadSettled.value = true
    snapshotAuthoritative.value = true

    await waitFor(() =>
      expect(
        useTelemetry()!.trackAgentPaywallShown
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'subscription_inactive',
        surface: 'refused_send'
      })
    )
  })

  // An unavailable read is settled but not authoritative, and it leaves
  // `canTopUp` guessing true for an owner. Gating on authority alone stranded
  // these sessions: the card renders, its Add credits CTA is reported below,
  // and the funnel saw the click with no impression behind it.
  it('reports an impression once when the read settles as unavailable', async () => {
    canTopUp.value = true
    canSubscribeSelfServe.value = true
    hasResolvedCapabilities.value = false
    capabilityReadSettled.value = true
    snapshotAuthoritative.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    showPaywall()

    await waitFor(() =>
      expect(
        useTelemetry()!.trackAgentPaywallShown
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'unknown',
        surface: 'refused_send'
      })
    )
  })

  it('reports a visible paywall as unknown when the read settles without resolving', async () => {
    canTopUp.value = false
    canSubscribeSelfServe.value = false
    hasResolvedCapabilities.value = false
    snapshotAuthoritative.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    showPaywall()

    await waitFor(() =>
      expect(
        useTelemetry()!.trackAgentPaywallShown
      ).toHaveBeenCalledExactlyOnceWith({
        reason: 'unknown',
        surface: 'refused_send'
      })
    )
  })

  it.for([
    { button: 'Add credits', cta: 'add_credits' },
    { button: 'Upgrade plan', cta: 'upgrade' }
  ])('reports the $button CTA as $cta', async ({ button, cta }) => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()

    await userEvent.click(await screen.findByRole('button', { name: button }))

    expect(
      useTelemetry()!.trackAgentPaywallCtaClicked
    ).toHaveBeenCalledExactlyOnceWith({ cta, surface: 'refused_send' })
  })

  it('reports the Subscribe CTA as subscribe', async () => {
    canTopUp.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Subscribe' })
    )

    expect(
      useTelemetry()!.trackAgentPaywallCtaClicked
    ).toHaveBeenCalledExactlyOnceWith({
      cta: 'subscribe',
      surface: 'refused_send'
    })
  })

  it('attributes the add-credits click to the agent paywall', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add credits' })
    )

    expect(
      useTelemetry()!.trackAddApiCreditButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({ source: 'agent_paywall' })
  })

  it('does not report an add-credits click for a subscribe CTA', async () => {
    canTopUp.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Subscribe' })
    )

    expect(
      useTelemetry()!.trackAddApiCreditButtonClicked
    ).not.toHaveBeenCalled()
  })

  it.for([
    { button: 'Subscribe', canSubscriberTopUp: false },
    { button: 'Upgrade plan', canSubscriberTopUp: true }
  ])(
    'carries agent_paywall to the subscribe event from the $button CTA',
    async ({ button, canSubscriberTopUp }) => {
      canTopUp.value = canSubscriberTopUp
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      showPaywall()

      await userEvent.click(await screen.findByRole('button', { name: button }))

      expect(useTelemetry()!.trackSubscription).toHaveBeenCalledExactlyOnceWith(
        'subscribe_clicked',
        { current_tier: 'standard', reason: 'agent_paywall' }
      )
    }
  )

  it('does not report a subscribe click for the add-credits CTA', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    showPaywall()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add credits' })
    )

    expect(useTelemetry()!.trackSubscription).not.toHaveBeenCalled()
  })
})

describe('AgentPanelRoot Agent credit transition notice', () => {
  const NOTICE = 'agent-credit-transition-notice'

  function observeAgentScopedFunds(scopedHasFunds: boolean | undefined): void {
    paywallAgentScopedHasFunds.value = scopedHasFunds
    if (scopedHasFunds === undefined) return
    useAgentPanelStore().observeAgentScopedFunds(
      useBillingIdentity().value,
      scopedHasFunds
    )
  }

  beforeEach(() => {
    paywallHasFunds.value = true
    paywallAgentHasFunds.value = true
  })

  it('shows only after the Agent-scoped balance changes from available to exhausted', async () => {
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    observeAgentScopedFunds(false)

    expect(await screen.findByTestId(NOTICE)).toHaveTextContent(
      i18n.global.t('agent.creditTransitionNotice')
    )
    expect(
      telemetry.trackAgentCreditTransitionNotice
    ).toHaveBeenCalledExactlyOnceWith({ action: 'shown' })
  })

  it('reports one impression however often the panel remounts', async () => {
    observeAgentScopedFunds(true)
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    observeAgentScopedFunds(false)
    await screen.findByTestId(NOTICE)

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByTestId(NOTICE)

    expect(
      telemetry.trackAgentCreditTransitionNotice
    ).toHaveBeenCalledExactlyOnceWith({ action: 'shown' })
  })

  it('reports an impression first shown without telemetry once telemetry is available', async () => {
    observeAgentScopedFunds(true)
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    vi.mocked(useTelemetry).mockReturnValue(null)
    observeAgentScopedFunds(false)
    await screen.findByTestId(NOTICE)
    vi.mocked(useTelemetry).mockReturnValue(telemetry)

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByTestId(NOTICE)

    expect(
      telemetry.trackAgentCreditTransitionNotice
    ).toHaveBeenCalledExactlyOnceWith({ action: 'shown' })
  })

  it('does not infer a transition when the first scoped-balance read is false', async () => {
    observeAgentScopedFunds(false)
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    observeAgentScopedFunds(undefined)
    await nextTick()
    observeAgentScopedFunds(false)
    await nextTick()
    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()
  })

  it('preserves the last defined scoped balance across an omitted read and panel remount', async () => {
    observeAgentScopedFunds(true)
    const firstPanel = render(AgentPanelRoot, {
      global: { plugins: [i18n] }
    })
    await screen.findByRole('textbox')
    firstPanel.unmount()

    observeAgentScopedFunds(undefined)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    observeAgentScopedFunds(false)

    expect(await screen.findByTestId(NOTICE)).toBeInTheDocument()
  })

  it('defers an observed transition until Agent consent is ready', async () => {
    Object.assign(useAgentConsentStore(), { accepted: false })
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    observeAgentScopedFunds(false)
    await nextTick()
    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()

    Object.assign(useAgentConsentStore(), { accepted: true })
    expect(await screen.findByTestId(NOTICE)).toBeInTheDocument()
  })

  it('withholds the notice while the workspace has no active subscription', async () => {
    paywallBilling.isActive = false
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    observeAgentScopedFunds(false)
    await nextTick()

    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()
  })

  it('defers the notice until the billing capability read settles', async () => {
    paywallCapabilities.isReady = false
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    observeAgentScopedFunds(false)
    await nextTick()
    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()

    paywallCapabilities.isReady = true
    expect(await screen.findByTestId(NOTICE)).toBeInTheDocument()
  })

  it('yields to the exhaustion paywall when no funding remains, then shows the notice once workspace funding returns', async () => {
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    activateThread()

    observeAgentScopedFunds(false)
    paywallAgentHasFunds.value = false
    paywallHasFunds.value = false

    expect(
      await screen.findByTestId('agent-credits-exhausted-paywall')
    ).toBeInTheDocument()
    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()

    paywallAgentHasFunds.value = true
    paywallHasFunds.value = true

    expect(await screen.findByTestId(NOTICE)).toBeInTheDocument()
  })

  it('reports a new impression when the scoped balance refills and runs out again', async () => {
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    observeAgentScopedFunds(false)
    await screen.findByTestId(NOTICE)
    observeAgentScopedFunds(true)
    await nextTick()
    observeAgentScopedFunds(false)
    await screen.findByTestId(NOTICE)

    expect(telemetry.trackAgentCreditTransitionNotice.mock.calls).toEqual([
      [{ action: 'shown' }],
      [{ action: 'shown' }]
    ])
  })

  it('shows again for a dismissed notice once the scoped balance refills and runs out again', async () => {
    observeAgentScopedFunds(true)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    observeAgentScopedFunds(false)
    const notice = await screen.findByTestId(NOTICE)

    await userEvent.click(
      within(notice).getByRole('button', {
        name: i18n.global.t('agent.dismiss')
      })
    )
    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()

    observeAgentScopedFunds(true)
    await nextTick()
    observeAgentScopedFunds(false)

    expect(await screen.findByTestId(NOTICE)).toBeInTheDocument()
    expect(telemetry.trackAgentCreditTransitionNotice.mock.calls).toEqual([
      [{ action: 'shown' }],
      [{ action: 'dismissed' }],
      [{ action: 'shown' }]
    ])
  })
})

/**
 * The standing credits-exhausted surface.
 *
 * Distinct from the describes above, which cover the inline card raised by a
 * turn POST that came back 402/`no_funds`. That card was the ONLY route to
 * `app:agent_paywall_shown`, so a user who met the ceiling any other way - a
 * turn that died at the agent runtime's own LLM hop, or one who simply did not
 * type again - got no upgrade path. These cases pin the surface that reads the
 * funds signal directly instead of waiting for a refusal to carry it.
 */
describe('AgentPanelRoot standing credits-exhausted paywall', () => {
  const STANDING = 'agent-credits-exhausted-paywall'

  beforeEach(() => {
    openAccountPrecondition.mockClear()
    telemetry.trackAgentPaywallShown.mockClear()
    telemetry.trackAgentPaywallCtaClicked.mockClear()
    telemetry.trackAddApiCreditButtonClicked.mockClear()
  })

  it.for([
    {
      subscription: null,
      effectiveFunds: true
    },
    {
      subscription: 'STANDARD' as const,
      effectiveFunds: true
    }
  ])(
    'stays hidden for subscription=$subscription with effective funds',
    async ({ subscription, effectiveFunds }) => {
      paywallBilling.tier = subscription
      paywallHasFunds.value = effectiveFunds
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      activateThread()
      await screen.findByRole('textbox')

      expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    }
  )

  it.for([
    {
      subscription: null,
      isActive: false,
      effectiveFunds: false
    },
    {
      subscription: 'STANDARD' as const,
      isActive: true,
      effectiveFunds: false
    }
  ])(
    'shows for subscription=$subscription without effective funds',
    async ({ subscription, isActive, effectiveFunds }) => {
      paywallBilling.tier = subscription
      paywallBilling.isActive = isActive
      paywallHasFunds.value = effectiveFunds
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      activateThread()

      expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
    }
  )

  it('shows an upgrade path when the workspace is out of credits, with no refusal first', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()

    const card = await screen.findByTestId(STANDING)

    expect(
      within(card).getByRole('button', { name: 'Add credits' })
    ).toBeInTheDocument()
  })

  it('allows a new turn while the standing card is visible', async () => {
    const messageBodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (threadListRoute.test(url)) return json(200, agentThreadList())
        messageBodies.push(JSON.parse(String(init?.body)))
        return json(202, { thread_id: 'th-1', message_id: 'm-1' })
      }
    )
    paywallHasFunds.value = false
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    renderWithSelectedTarget()
    activateThread()
    await screen.findByTestId(STANDING)

    await sendFromComposer('continue anyway')

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({ content: 'continue anyway' })
  })

  it('keeps the standing card visible until the server admits the turn', async () => {
    let releaseAdmission = () => {}
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (threadListRoute.test(String(input)))
        return json(200, agentThreadList())
      return new Promise<Response>((resolve) => {
        releaseAdmission = () =>
          resolve(json(202, { thread_id: 'th-1', message_id: 'm-1' }))
      })
    })
    paywallHasFunds.value = false
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    renderWithSelectedTarget()
    activateThread()
    await screen.findByTestId(STANDING)

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('continue anyway')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByTestId(STANDING)).toBeInTheDocument()
    releaseAdmission()
    await screen.findByRole('button', { name: 'Stop' })
  })

  it('releases an admitted-turn funds recheck when billing identity changes', async () => {
    const accountId = ref('account-a')
    useCurrentUser().resolvedUserInfo = computed(() => ({
      id: accountId.value
    }))
    let releaseRefresh = () => {}
    paywallBilling.fetchStatus.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRefresh = resolve
        })
    )
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (threadListRoute.test(String(input)))
        return json(200, agentThreadList())
      return json(202, { thread_id: 'th-1', message_id: 'm-1' })
    })
    paywallHasFunds.value = false
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    const firstPanel = renderWithSelectedTarget()

    await sendFromComposer('continue anyway')
    await waitFor(() =>
      expect(paywallBilling.fetchStatus).toHaveBeenCalledOnce()
    )
    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()

    firstPanel.unmount()
    renderWithSelectedTarget()
    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()

    accountId.value = 'account-b'

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
    releaseRefresh()
    await setImmediate()
    expect(screen.getByTestId(STANDING)).toBeInTheDocument()
  })

  it('waits for an adopted billing read when its own refresh is superseded', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (threadListRoute.test(String(input)))
        return json(200, agentThreadList())
      return json(202, { thread_id: 'th-1', message_id: 'm-1' })
    })
    paywallHasFunds.value = false
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    renderWithSelectedTarget()

    await sendFromComposer('continue anyway')
    await waitFor(() =>
      expect(paywallBilling.fetchStatus).toHaveBeenCalledOnce()
    )
    await setImmediate()
    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()

    paywallAgentScopedHasFunds.value = false

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
  })

  it('reports the impression against the credits_exhausted surface', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()

    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledExactlyOnceWith({
        reason: 'no_funds',
        surface: 'credits_exhausted'
      })
    )
  })

  it('attributes its CTA to the credits_exhausted surface and opens the credits flow', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    const card = await screen.findByTestId(STANDING)

    await userEvent.click(
      within(card).getByRole('button', { name: 'Add credits' })
    )

    expect(
      telemetry.trackAgentPaywallCtaClicked
    ).toHaveBeenCalledExactlyOnceWith({
      cta: 'add_credits',
      surface: 'credits_exhausted'
    })
    expect(openAccountPrecondition).toHaveBeenCalledExactlyOnceWith('credits', {
      source: 'agent_paywall'
    })
  })

  it('stays hidden while the workspace has funds', async () => {
    paywallHasFunds.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  it('stays hidden on an empty thread until the first user message', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    await nextTick()

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()

    activateThread()

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledExactlyOnceWith({
        reason: 'no_funds',
        surface: 'credits_exhausted'
      })
    )
  })

  it('stays hidden while a restored thread has not loaded any messages', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    useAgentConversationStore().setThreadId('th-restoring')
    await nextTick()

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  it('shows after a first send that failed before the thread was created', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')

    useAgentConversationStore().recordFailedSend(
      toTurnId('msg-failed-first'),
      'Build a red fox workflow',
      'Something went wrong'
    )

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
  })

  it('shows once a refused first send has its inline card resolved', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findByRole('textbox')
    const conversation = useAgentConversationStore()

    conversation.recordPaywall(toTurnId('msg-refused-first'), 'continue')
    expect(await findInlinePaywallButton('Add credits')).toBeInTheDocument()
    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()

    conversation.resolvePaywalls()

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
  })

  it('stays hidden while Agent-scoped gratis can fund the turn', async () => {
    paywallHasFunds.value = false
    paywallAgentHasFunds.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  it('stays hidden before Agent consent is accepted', async () => {
    Object.assign(useAgentConsentStore(), { accepted: false })
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  it('stays hidden on the legacy rail whose unloaded balance reads as false', async () => {
    paywallHasFunds.value = false
    paywallBilling.type = 'legacy'
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
  })

  it.for(['payment_failed', 'paused'] as const)(
    'defers to the %s billing-recovery surface',
    async (status) => {
      paywallHasFunds.value = false
      paywallBilling.status = status
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      activateThread()
      await screen.findByRole('textbox')

      expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    }
  )

  // `null` is "not loaded yet", not "no funds". Treating it as exhaustion would
  // flash an out-of-credits card at every funded user on every cold start.
  it('stays hidden while the billing read has not answered', async () => {
    paywallHasFunds.value = null
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  // An unsettled capability read cannot say which remediation is right, and a
  // card naming the wrong one is worse than no card. Same gate the inline
  // card's impression already used.
  it('waits for the capability read to settle before showing anything', async () => {
    paywallHasFunds.value = false
    paywallCapabilities.isReady = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')
    await nextTick()

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()
  })

  // `unavailable` renders a body with no action at all, so standing it up would
  // be noise the user cannot act on.
  it('stays hidden when the presentation offers no remediation', async () => {
    paywallHasFunds.value = false
    paywallCapabilities.canTopUp = false
    paywallCapabilities.hasResolvedCapabilities = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')
    await nextTick()

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
  })

  it('stays hidden when the current member cannot act on billing', async () => {
    paywallHasFunds.value = false
    paywallWorkspace.role = 'member'
    paywallCapabilities.canTopUp = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
  })

  // Two cards with identical copy is a bug, not redundancy. The inline one is
  // anchored to the turn that was refused, so it wins.
  it('yields to an inline paywall card rather than duplicating it', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)

    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'continue'
    )

    await waitFor(() =>
      expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    )
    expect(await findInlinePaywallButton('Add credits')).toBeInTheDocument()
  })

  it('shows the standing card when a normal reply follows an older unresolved inline card', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    const conversation = useAgentConversationStore()
    conversation.recordPaywall(toTurnId('msg-paywall'), 'continue')
    await waitFor(() =>
      expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    )

    conversation.messages.push({
      id: toTurnId('msg-later'),
      role: 'assistant',
      parts: [{ type: 'text', text: 'Later reply', state: 'done' }],
      streaming: false,
      thinking: false
    })

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
  })

  it('returns after the inline paywall is resolved and credits run out again', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)

    useAgentConversationStore().recordPaywall(
      toTurnId('msg-paywall'),
      'continue'
    )
    await waitFor(() =>
      expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    )

    paywallHasFunds.value = true
    await waitFor(() =>
      expect(queryInlinePaywallButton('Add credits')).not.toBeInTheDocument()
    )
    paywallHasFunds.value = false

    expect(await screen.findByTestId(STANDING)).toBeInTheDocument()
  })

  it('reports only after returning from chat history', async () => {
    paywallHasFunds.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByRole('textbox')

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await screen.findByRole('heading', { name: i18n.global.t('agent.history') })

    paywallHasFunds.value = false
    await nextTick()
    expect(telemetry.trackAgentPaywallShown).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.backToPreviousChat')
      })
    )

    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledExactlyOnceWith({
        reason: 'no_funds',
        surface: 'credits_exhausted'
      })
    )
  })

  it('reports a new identity only after its standing card is shown', async () => {
    const accountId = ref('account-a')
    useCurrentUser().resolvedUserInfo = computed(() => ({
      id: accountId.value
    }))
    paywallHasFunds.value = false
    const firstPanel = render(AgentPanelRoot, {
      global: { plugins: [i18n] }
    })
    activateThread()
    await screen.findByTestId(STANDING)
    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await screen.findByRole('heading', { name: i18n.global.t('agent.history') })
    accountId.value = 'account-b'
    await nextTick()

    expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.backToPreviousChat')
      })
    )
    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(2)
    )

    firstPanel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)

    expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(2)
  })

  it('disappears once funds arrive', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)

    paywallHasFunds.value = true

    await waitFor(() =>
      expect(screen.queryByTestId(STANDING)).not.toBeInTheDocument()
    )
  })

  // One impression per exhaustion episode: the surface is standing, so a
  // per-render report would make impressions a function of session length.
  it('reports one impression per exhaustion episode, not per re-evaluation', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)
    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    paywallCapabilities.canSubscribeSelfServe = false
    await nextTick()
    await nextTick()

    expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
  })

  it('does not re-arm the impression when capabilities refresh while still exhausted', async () => {
    paywallHasFunds.value = false
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)
    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    paywallCapabilities.isReady = false
    await nextTick()
    paywallCapabilities.isReady = true
    await screen.findByTestId(STANDING)

    expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
  })

  it('does not report the same exhaustion episode after a panel remount', async () => {
    paywallHasFunds.value = false
    const firstPanel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)
    await waitFor(() =>
      expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
    )

    firstPanel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    await screen.findByTestId(STANDING)

    expect(telemetry.trackAgentPaywallShown).toHaveBeenCalledTimes(1)
  })
  it('refreshes workspace billing after an active turn becomes idle', async () => {
    paywallHasFunds.value = true
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    const conversation = useAgentConversationStore()
    const turnId = toTurnId('billing-refresh')

    conversation.startTurn(turnId)
    await nextTick()
    paywallBilling.fetchStatus.mockClear()
    conversation.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: turnId, thread_id: 'th', usage: null }
      })
    )

    await waitFor(() =>
      expect(paywallBilling.fetchStatus).toHaveBeenCalledOnce()
    )
  })

  it('does not refresh workspace status for a legacy billing turn', async () => {
    paywallHasFunds.value = true
    paywallBilling.type = 'legacy'
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    const conversation = useAgentConversationStore()
    const turnId = toTurnId('legacy-billing-refresh')

    conversation.startTurn(turnId)
    paywallBilling.fetchStatus.mockClear()
    conversation.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: turnId, thread_id: 'th', usage: null }
      })
    )
    await nextTick()

    expect(paywallBilling.fetchStatus).not.toHaveBeenCalled()
  })

  it('reports a rejected post-turn billing refresh', async () => {
    const refreshError = new Error('status unavailable')
    paywallHasFunds.value = true
    paywallBilling.fetchStatus.mockRejectedValueOnce(refreshError)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    activateThread()
    const conversation = useAgentConversationStore()
    const turnId = toTurnId('failed-billing-refresh')

    conversation.startTurn(turnId)
    paywallBilling.fetchStatus.mockClear()
    conversation.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: turnId, thread_id: 'th', usage: null }
      })
    )

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(refreshError, {
        surface: 'agent',
        errorType: 'error_refreshing_agent_billing_status'
      })
    )
  })
})

describe('AgentPanelRoot session notices', () => {
  it('surfaces a session error notice via the host error modal, not a toast', async () => {
    executionErrors.showErrorOverlay.mockClear()
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response('{"threads":[]}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    )
    renderWithSelectedTarget()
    const toast = useToast()

    dispatchApiEvent('agent_message_done', {})
    await nextTick()

    expect(toast.toasts).toHaveLength(0)
    expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_api_failed',
      details: i18n.global.t('agent.malformedEvent')
    })
    expect(telemetry.trackAgentError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_class: 'malformed_stream_event',
        failure_stage: 'pre_acceptance',
        retryable: false,
        turn_accepted: false,
        ui_treatment: 'error_overlay'
      })
    )
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

const mp4Header = '\0\0\0\x18ftyp'

function unsupportedTypeMessage(name: string): string {
  return i18n.global.t('agent.attachmentUnsupportedType', { name })
}

function fileOfSize(name: string, size: number, type: string): File {
  const file = new File([mp4Header], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

async function clearTrayAsset(name: string): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', {
      name: i18n.global.t('agent.removeAsset', { name })
    })
  )
}

function assetPanelDrag(
  displayName: string | null,
  overrides: Partial<AssetItem> = {}
) {
  const asset = {
    id: 'library-source',
    name: 'library.png',
    hash: 'stored-library.png',
    display_name: displayName,
    tags: ['input'],
    created_at: '2026-10-03T00:00:00Z',
    updated_at: '2026-10-03T00:00:00Z',
    ...overrides
  } satisfies AssetItem
  const dataTransfer = new DataTransfer()
  const event = new DragEvent('dragstart', { cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  startAssetDrag(event, asset)
  return {
    types: Array.from(dataTransfer.types),
    getData: (type: string) => dataTransfer.getData(type)
  }
}

// DES-527 replaced the paperclip and @ buttons with a single + menu, so every
// attach or node-mention gesture now starts by opening it.
async function openAddMenu(): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: i18n.global.t('agent.addToPrompt') })
  )
}

async function openMentionPicker(): Promise<void> {
  await userEvent.click(screen.getByRole('textbox'))
  await userEvent.paste('@')
  await userEvent.click(screen.getByRole('menuitem', { name: 'Nodes' }))
}

function setupNodeSelectionCanvas() {
  const canvasElement = document.createElement('canvas')
  const focus = vi.spyOn(canvasElement, 'focus')
  const nodes: LGraphNode[] = [
    createMockLGraphNode({
      isNodeFake: true,
      id: 9,
      title: 'VAE Decode',
      boundingRect: {}
    }),
    createMockLGraphNode({
      isNodeFake: true,
      id: 12,
      title: 'KSampler',
      boundingRect: {}
    })
  ]
  const selectedItems = new Set<LGraphNode>()
  const selectItems = vi.fn((items: LGraphNode[], add = false) => {
    if (!add) selectedItems.clear()
    for (const item of items) selectedItems.add(item)
    syncFakeSelection()
  })
  const deselect = vi.fn((node: LGraphNode) => {
    selectedItems.delete(node)
    syncFakeSelection()
  })
  const deselectAll = vi.fn(() => {
    selectedItems.clear()
    syncFakeSelection()
  })
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
    setDirty: vi.fn(),
    animateToBounds: vi.fn(),
    canvas: canvasElement,
    ds: createTestDragAndScale(900, 700)
  }
  appMock.canvas = canvas
  canvasStore.canvas = fromPartial(canvas)
  canvasStore.currentGraph = fromPartial(graph)
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
  for (const node of state.nodes)
    node.graph = fromPartial<Subgraph>({
      id: SUBGRAPH_UUID,
      isRootGraph: false
    })
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
  nodes: LGraphNode[] = []
) {
  const graph = {
    nodes,
    getNodeById: (id: string | number) =>
      nodes.find((node) => String(node.id) === String(id)) ?? null
  }
  state.canvas.graph = graph
  canvasStore.currentGraph = fromPartial(graph)
}

function setupOwnedSelectionCanvas() {
  const rootGraph = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph, id: SUBGRAPH_UUID })
  rootGraph.subgraphs.set(subgraph.id, subgraph)
  const rootNode = new LGraphNode('Root node')
  rootNode.id = toNodeId(3)
  rootGraph.add(rootNode)
  const subgraphNode = new LGraphNode('KSampler')
  subgraphNode.id = toNodeId(12)
  subgraph.add(subgraphNode)

  const canvasElement = document.createElement('canvas')
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  canvasElement.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  const canvas = new LGraphCanvas(canvasElement, rootGraph, {
    skip_render: true
  })
  canvas.onSelectionChange = () => syncFakeSelection()

  appMock.graph.nodes = rootGraph.nodes
  Object.assign(appMock.rootGraph, { subgraphs: rootGraph.subgraphs })
  appMock.canvas = canvas
  canvasStore.canvas = canvas
  viewGraph(canvas, subgraph)
  return { canvas, rootGraph, subgraph, rootNode, subgraphNode }
}

function viewGraph(canvas: LGraphCanvas, graph: LGraph): void {
  canvas.setGraph(graph)
  canvasStore.currentGraph = graph
}

function renderCanvasNodeButtons(
  nodes: LGraphNode[],
  onClick: (node: LGraphNode) => void
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
      name: i18n.global.t('agent.nodes')
    })
  )
}

async function startVueNodeSelection() {
  const state = setupNodeSelectionCanvas()
  const selectClickedNode = vi.fn((node: LGraphNode) => {
    if (!canvasStore.isPickingNodes) state.selectedItems.clear()
    if (state.selectedItems.has(node)) state.selectedItems.delete(node)
    else state.selectedItems.add(node)
    syncFakeSelection()
  })
  const panel = renderWithSelectedTarget()
  renderCanvasNodeButtons(state.nodes, selectClickedNode)
  useAgentPanelStore().isOpen = true

  await enterNodeSelectionMode()
  const buttons = state.nodes.map((node) =>
    screen.getByRole('button', { name: `Canvas ${node.title}` })
  )
  await userEvent.click(buttons[0])
  await userEvent.click(buttons[1])
  expect(state.selectItems).not.toHaveBeenCalled()
  expect(canvasStore.selectedItems).toEqual(state.nodes)

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
function stubUploadFetch(uploaded: string[] = [], status = 200): string[] {
  vi.mocked(fetch).mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.includes('/upload/')) return json(200, agentThreadList())
      const body = init?.body
      if (body instanceof FormData) {
        const file = body.get('image')
        if (file instanceof File) uploaded.push(file.name)
      }
      return status === 200
        ? json(200, { name: 'uploaded', subfolder: '', type: 'input' })
        : json(status, {})
    }
  )
  return uploaded
}

describe('AgentPanelRoot attach flow', () => {
  beforeEach(() => {
    const tab = addTab('workflows/current.json')
    workflowStore.activeWorkflow = tab
    useAgentWorkflowTabBindingStore().bind('wf-42', tab.path)
  })

  it('reads changed developer upload limits without remounting the panel', async () => {
    vi.mocked(api.getServerFeature).mockImplementation(
      (name, defaultValue) => getDevOverride(name) ?? defaultValue
    )
    const uploaded = stubUploadFetch()
    localStorage.setItem('ff:max_upload_size', '4')
    renderWithSelectedTarget()
    const input = screen.getByTestId<HTMLInputElement>('agent-file-input')

    await userEvent.upload(
      input,
      new File(['1234'], 'first.png', { type: 'image/png' })
    )
    await waitFor(() => expect(uploaded).toEqual(['first.png']))

    localStorage.setItem('ff:max_upload_size', '1')
    await userEvent.upload(
      input,
      new File(['12'], 'second.png', { type: 'image/png' })
    )
    await waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'warning',
          title: 'second.png is larger than 1 B'
        })
      )
    )
    expect(uploaded).toEqual(['first.png'])
  })

  it.for([
    { displayName: null, label: 'library.png' },
    { displayName: 'My library image', label: 'My library image' }
  ])(
    'stages an assets-panel drop with display name $displayName from the real producer payload',
    async ({ displayName, label }) => {
      const uploaded = stubUploadFetch()
      renderWithSelectedTarget()
      const store = useAgentComposerStore()
      store.setText('Keep this draft')
      await nextTick()
      const target = screen.getByRole('button', {
        name: i18n.global.t('agent.close')
      })
      const data = assetPanelDrag(displayName)

      expect(dispatchDrag(target, 'dragover', data)).toBe(true)
      expect(dispatchDrag(target, 'drop', data)).toBe(true)
      expect(
        within(await screen.findByTestId('composer-asset-section')).getByRole(
          'group',
          { name: label }
        )
      ).toBeInTheDocument()
      expect(store.attachments).toEqual([
        expect.objectContaining({
          name: label,
          ref: 'stored-library.png',
          previewUrl: 'http://localhost:3000/api/assets/library-source/content'
        })
      ])
      expect(store.prompt).toEqual({ text: 'Keep this draft', references: [] })
      expect(uploaded).toEqual([])
    }
  )

  it.for([
    {
      filename: 'clip.mp4',
      label: 'My clip',
      kind: 'video',
      previewId: 'poster',
      previewUrl: 'http://localhost:3000/api/assets/poster/content',
      indicatorLabel: 'My clip',
      indicatorSource: 'http://localhost:3000/api/assets/poster/content'
    },
    {
      filename: 'song.mp3',
      label: 'My recording',
      kind: 'audio',
      previewId: undefined,
      previewUrl: undefined,
      indicatorLabel: 'Audio',
      indicatorSource: null
    }
  ])(
    'preserves playable $kind metadata from the assets panel through the chat tray',
    async ({
      filename,
      label,
      kind,
      previewId,
      previewUrl,
      indicatorLabel,
      indicatorSource
    }) => {
      const uploaded = stubUploadFetch()
      renderWithSelectedTarget()
      const store = useAgentComposerStore()
      store.setText('Keep typing')
      await nextTick()
      const data = assetPanelDrag(label, {
        name: filename,
        hash: `stored-${filename}`,
        preview_id: previewId
      })
      expect(dispatchDrag(screen.getByRole('textbox'), 'drop', data)).toBe(true)
      const trayItem = await screen.findByRole('group', { name: label })
      expect(store.attachments).toEqual([
        expect.objectContaining({
          name: label,
          mediaKind: kind,
          previewUrl,
          mediaUrl:
            'http://localhost:3000/api/assets/library-source/content?disposition=inline'
        })
      ])
      expect(
        within(trayItem)
          .getByRole('img', { name: indicatorLabel })
          .getAttribute('src')
      ).toBe(indicatorSource)
      expect(store.prompt).toEqual({ text: 'Keep typing', references: [] })
      expect(uploaded).toEqual([])
    }
  )

  it('deduplicates an assets-panel item that needs fetching to identify its media type', async () => {
    const data = assetPanelDrag('Recording.mp3', { name: 'recording' })
    expect(
      JSON.parse(data.getData('application/x-comfy-asset-info'))
    ).toMatchObject({ media_kind: 'other' })
    const source = data.getData('text/uri-list')
    respondToFetch({}, () => json(200, agentThreadList()))
    respondToFetch(/\/assets/, () =>
      json(200, { assets: [], total: 0, has_more: false })
    )
    respondToFetch({ method: 'POST' }, () =>
      json(200, { name: 'recording.mp3' })
    )
    respondToFetch(
      source,
      () => new Response(new Blob(['audio'], { type: 'audio/mpeg' }))
    )
    renderWithSelectedTarget()
    await nextTick()
    const store = useAgentComposerStore()
    const target = screen.getByRole('textbox')
    dispatchDrag(target, 'drop', data)
    await vi.waitFor(() => expect(store.attachments[0]?.uploading).toBe(false))
    dispatchDrag(target, 'drop', data)
    await nextTick()
    expect(store.attachments).toHaveLength(1)
    expect(fetchRequests(source)).toHaveLength(1)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'info',
        title: 'Recording.mp3 is already in the asset tray'
      })
    ])
  })

  it('allows a removed library asset to be explicitly dropped again while retaining retirement of its old identity', async () => {
    stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const store = useAgentComposerStore()
    const target = screen.getByRole('textbox')
    const data = assetPanelDrag('library.png')
    expect(dispatchDrag(target, 'drop', data)).toBe(true)
    const trayItem = await screen.findByRole('group', { name: 'library.png' })
    const oldAttachment = store.attachments[0]
    assert.exists(oldAttachment)
    store.referenceAttachment(oldAttachment.id)
    const oldPrompt = store.prompt
    await userEvent.hover(trayItem)
    await userEvent.click(
      within(trayItem).getByRole('button', {
        name: i18n.global.t('agent.removeAsset', { name: 'library.png' })
      })
    )
    expect(store.attachments).toEqual([])

    expect(dispatchDrag(target, 'drop', data)).toBe(true)
    await screen.findByRole('group', { name: 'library.png' })
    const newAttachment = store.attachments[0]
    assert.exists(newAttachment)
    expect(newAttachment.id).not.toBe(oldAttachment.id)
    store.updateAttachment(oldAttachment.id, { ref: 'too-late.png' })
    store.applyEditorPrompt(oldPrompt)
    expect(store.attachments).toEqual([newAttachment])
    expect(newAttachment.ref).toBe('stored-library.png')
    expect(store.prompt.references).toEqual([])
    expect(useToast().toasts).toEqual([])
    expect(dispatchDrag(target, 'drop', data)).toBe(true)
    expect(store.attachments).toHaveLength(1)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'info',
        title: 'library.png is already in the asset tray'
      })
    ])
  })

  it('allows the same library asset to be dropped into a new draft after sending', async () => {
    respondToFetch({}, () => json(200, agentThreadList()))
    respondToFetch({ method: 'POST' }, () =>
      json(202, { thread_id: 'th-1', message_id: 'm-1' })
    )
    renderWithSelectedTarget()
    await nextTick()
    const store = useAgentComposerStore()
    const target = screen.getByRole('textbox')
    const data = assetPanelDrag('library.png')
    expect(dispatchDrag(target, 'drop', data)).toBe(true)
    await screen.findByRole('group', { name: 'library.png' })
    const previousId = store.attachments[0]?.id
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(store.attachments).toEqual([])

    expect(dispatchDrag(target, 'drop', data)).toBe(true)
    await screen.findByRole('group', { name: 'library.png' })
    expect(store.attachments).toEqual([
      expect.objectContaining({
        name: 'library.png',
        ref: 'stored-library.png'
      })
    ])
    expect(store.attachments[0]?.id).not.toBe(previousId)
    expect(store.prompt.references).toEqual([])
  })

  it('uploads a picked file, stages its ref, and forwards it on the next send', async () => {
    const messageBodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

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
      }
    )

    renderWithSelectedTarget()

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.attachFiles')
      })
    )
    expect(
      telemetry.trackAgentAttachButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({ method: 'menu' })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    const input = screen.getByTestId<HTMLInputElement>('agent-file-input')
    await userEvent.upload(input, file)

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'cat.png' }
      )
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('make it pop')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({
      content: 'make it pop',
      attachments: ['uploaded_cat.png']
    })
    expect(useTelemetry()!.trackAgentMessageSent).toHaveBeenCalledWith({
      attachment_count: 1,
      node_tag_count: 0,
      thread_id: null,
      workflow_id: 'wf-42',
      client_message_id: 'client-message-1',
      input_method: 'typed',
      starter_prompt_id: null,
      starter_prompt_click_id: null
    })

    expect(screen.getByAltText('cat.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cat.png' })).toBeInTheDocument()
  })

  // The whole point of client_message_id is that the analytics event and the turn
  // POST carry the SAME value: the server echoes the posted one onto
  // agent_turn_started, and the funnel joins that to the value on
  // app:agent_message_sent. If the two ever diverge the join returns zero rows and
  // nothing else breaks, so neither side's own test would catch it - only this one.
  it('posts the same client_message_id it reports, so message and turn can be joined', async () => {
    const messageBodies: Record<string, unknown>[] = []
    vi.mocked(fetch).mockImplementation(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        messageBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>
        )
        return json(202, { thread_id: 'th-1', message_id: 'm-1' })
      }
    )

    renderWithSelectedTarget()
    await screen.findByRole('textbox')
    telemetry.trackAgentMessageSent.mockClear()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('make me a workflow')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(messageBodies).toHaveLength(1)
      expect(telemetry.trackAgentMessageSent).toHaveBeenCalled()
    })
    const posted = messageBodies[0].client_message_id
    expect(posted).toBeTypeOf('string')
    expect(posted).not.toBe('')
    expect(telemetry.trackAgentMessageSent).toHaveBeenCalledWith(
      expect.objectContaining({ client_message_id: posted })
    )
  })

  it('uses the submitted filename when the upload response omits a name', async () => {
    const messageBodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.endsWith('/api/upload/image')) {
          return json(200, { subfolder: '', type: 'input' })
        }
        messageBodies.push(JSON.parse(String(init?.body)))
        return json(202, { thread_id: 'th-1', message_id: 'm-1' })
      }
    )

    renderWithSelectedTarget()

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.attachFiles')
      })
    )
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      new File(['x'], 'cat.png', { type: 'image/png' })
    )

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('describe it')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({ attachments: ['cat.png'] })
  })

  it('uploads a picked video above 20MB when the server permits it', async () => {
    vi.mocked(api.getServerFeature).mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()

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

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'movie.mp4' }
      )
    ).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['movie.mp4']))
  })

  it('opens the assets sidebar from the add menu', async () => {
    stubUploadFetch()
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = 'workflows'

    renderWithSelectedTarget()

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

    renderWithSelectedTarget()

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
    workflowStore.activeWorkflow = addTab('workflows/current.json', {
      activeMode: 'builder:inputs'
    })

    renderWithSelectedTarget()

    await openAddMenu()
    expect(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.nodes')
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
    vi.mocked(api.getServerFeature).mockReturnValue(24 * 1024 * 1024)
    executionErrors.showErrorOverlay.mockClear()
    stubUploadFetch()
    telemetry.trackAgentAttachButtonClicked.mockClear()
    renderWithSelectedTarget()
    await nextTick()

    const movie = fileOfSize('movie.mp4', 25 * 1024 * 1024, 'video/mp4')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [movie] })
    await nextTick()

    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'movie.mp4 is larger than 24 MB'
      })
    )
    expect(
      screen.queryByRole('group', { name: 'movie.mp4' })
    ).not.toBeInTheDocument()
    expect(telemetry.trackAgentAttachButtonClicked).not.toHaveBeenCalled()
  })

  it('uses a larger server limit for non-video attachments', async () => {
    vi.mocked(api.getServerFeature).mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const image = fileOfSize('huge.png', MAX_ATTACHMENT_BYTES + 1, 'image/png')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [image] })

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'huge.png' }
      )
    ).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['huge.png']))
  })

  it('uploads a dropped video above 20MB when the server permits it', async () => {
    vi.mocked(api.getServerFeature).mockReturnValue(100 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const movie = fileOfSize('movie.mp4', MAX_ATTACHMENT_BYTES + 1, 'video/mp4')
    expect(
      dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [movie] })
    ).toBe(true)

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'movie.mp4' }
      )
    ).toBeInTheDocument()
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
    telemetry.trackAgentAttachButtonClicked.mockClear()
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    expect(
      dispatchDrag(screen.getByRole('textbox'), 'drop', {
        files: [new File([mp4Header], name, { type })]
      })
    ).toBe(true)

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: name }
      )
    ).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual([name]))
    await vi.waitFor(() =>
      expect(
        telemetry.trackAgentAttachButtonClicked
      ).toHaveBeenCalledExactlyOnceWith({ method: 'drag_drop' })
    )
  })

  it('attaches a screenshot pasted into the composer and uploads it', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const clipboard = new DataTransfer()
    clipboard.items.add(new File(['x'], 'image.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'image.png' }
      )
    ).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['image.png']))
  })

  // A spreadsheet or document copy puts a bitmap on the clipboard next to the
  // text, so neither representation may be dropped for the other.
  it('keeps both the attachment and the text of a mixed clipboard', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const clipboard = new DataTransfer()
    clipboard.items.add(new File(['x'], 'image.png', { type: 'image/png' }))
    clipboard.setData('text/plain', 'Q3 revenue by region')
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'image.png' }
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveTextContent(
      'Q3 revenue by region'
    )
    await vi.waitFor(() => expect(uploaded).toEqual(['image.png']))
  })

  // Pasting happens inside the composer, like typing or a drop; only the +
  // menu's attach leaves the panel for the OS picker and ends node picking.
  it('keeps picking nodes when a screenshot is pasted into the composer', async () => {
    const uploaded = stubUploadFetch()
    const selection = await startVueNodeSelection()

    const clipboard = new DataTransfer()
    clipboard.items.add(new File(['x'], 'image.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)

    await vi.waitFor(() => expect(uploaded).toEqual(['image.png']))
    expect(canvasStore.isPickingNodes).toBe(true)
    expect([...selection.selectedItems]).toEqual(selection.nodes)
  })

  async function renderAndPasteScreenshot(): Promise<void> {
    renderWithSelectedTarget()
    await nextTick()
    telemetry.trackAgentAttachButtonClicked.mockClear()
    const clipboard = new DataTransfer()
    clipboard.items.add(new File(['x'], 'image.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)
  }

  it('tracks a pasted attachment as a paste once its upload lands', async () => {
    const uploaded = stubUploadFetch()

    await renderAndPasteScreenshot()

    await vi.waitFor(() => expect(uploaded).toEqual(['image.png']))
    await vi.waitFor(() =>
      expect(
        telemetry.trackAgentAttachButtonClicked
      ).toHaveBeenCalledExactlyOnceWith({ method: 'paste' })
    )
  })

  it('tracks no paste when the pasted upload is rejected', async () => {
    stubUploadFetch([], 500)

    await renderAndPasteScreenshot()

    await vi.waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'warning',
          title: 'image.png could not be uploaded'
        })
      )
    )
    await nextTick()
    expect(telemetry.trackAgentAttachButtonClicked).not.toHaveBeenCalled()
  })

  it.for(['picker', 'drop', 'paste'] as const)(
    'stages a refused type from the %s as an invalid chip and blocks Send',
    async (path) => {
      const uploaded = stubUploadFetch()
      renderWithSelectedTarget()
      await nextTick()
      const user = userEvent.setup({ applyAccept: false })
      const doc = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
      const store = useAgentComposerStore()
      store.setText('Keep this draft')
      const target = screen.getByRole('textbox')

      if (path === 'picker') {
        await openAddMenu()
        await user.click(
          await screen.findByRole('menuitem', {
            name: i18n.global.t('agent.attachFiles')
          })
        )
        await user.upload(
          screen.getByTestId<HTMLInputElement>('agent-file-input'),
          doc
        )
      }
      if (path === 'drop') dispatchDrag(target, 'drop', { files: [doc] })
      if (path === 'paste') {
        const clipboard = new DataTransfer()
        clipboard.items.add(doc)
        await user.click(target)
        await user.paste(clipboard)
      }

      expect(
        await screen.findByRole('status', {
          name: unsupportedTypeMessage('doc.pdf')
        })
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: i18n.global.t('agent.send') })
      ).toHaveAttribute('aria-disabled', 'true')
      expect(store.draft).toBe('Keep this draft')
      expect(uploaded).toEqual([])
      expect(useToast().toasts).toEqual([])
    }
  )

  it('refuses a text file renamed to mp4 from the picker', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()

    await openAddMenu()
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: i18n.global.t('agent.attachFiles')
      })
    )
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      new File(['plain text'], 'renamed.mp4', { type: 'video/mp4' })
    )

    expect(
      await screen.findByRole('status', {
        name: i18n.global.t('agent.attachmentInvalidVideo', {
          name: 'renamed.mp4'
        })
      })
    ).toBeVisible()
    expect(uploaded).toEqual([])
    expect(screen.getByRole('group', { name: 'renamed.mp4' })).toBeVisible()
    expect(useToast().toasts).toEqual([])
  })

  it('refuses a text file renamed to mp4 from drag and drop', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    const renamed = new File(['plain text'], 'renamed.mp4', {
      type: 'video/mp4'
    })

    expect(
      dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [renamed] })
    ).toBe(true)

    expect(
      await screen.findByRole('status', {
        name: i18n.global.t('agent.attachmentInvalidVideo', {
          name: 'renamed.mp4'
        })
      })
    ).toBeVisible()
    expect(uploaded).toEqual([])
    expect(screen.getByRole('group', { name: 'renamed.mp4' })).toBeVisible()
    expect(useToast().toasts).toEqual([])
  })

  it('names every approved format in the picker accept list', async () => {
    stubUploadFetch()
    renderWithSelectedTarget()
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
    renderWithSelectedTarget()
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

  it('refreshes the input asset library once for a dropped batch', async () => {
    // Overlapping refreshes coalesce into the in-flight query without a
    // trailing run, so an asset committing mid-refresh would be dropped.
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const refresh = vi
      .spyOn(useAssetsStore().inputAssets, 'loadNew')
      .mockResolvedValue(undefined)

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      files: [
        new File(['x'], 'a.png', { type: 'image/png' }),
        new File(['x'], 'b.png', { type: 'image/png' }),
        new File(['x'], 'c.png', { type: 'image/png' })
      ]
    })

    await vi.waitFor(() => expect(uploaded).toHaveLength(3))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('chains input asset refreshes across overlapping batches', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    let releaseFirstRefresh: () => void = () => {}
    const refresh = vi
      .spyOn(useAssetsStore().inputAssets, 'loadNew')
      .mockImplementationOnce(
        () =>
          new Promise<undefined>((resolve) => {
            releaseFirstRefresh = () => resolve(undefined)
          })
      )
      .mockResolvedValue(undefined)

    const textbox = screen.getByRole('textbox')
    dispatchDrag(textbox, 'drop', {
      files: [new File(['x'], 'a.png', { type: 'image/png' })]
    })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())

    dispatchDrag(textbox, 'drop', {
      files: [new File(['x'], 'b.png', { type: 'image/png' })]
    })
    await vi.waitFor(() => expect(uploaded).toEqual(['a.png', 'b.png']))
    await expect(
      vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2), {
        timeout: 250,
        interval: 10
      })
    ).rejects.toThrow()

    releaseFirstRefresh()
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
  })

  it('keeps refreshing later batches after a refresh fails', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const refresh = vi
      .spyOn(useAssetsStore().inputAssets, 'loadNew')
      .mockRejectedValueOnce(new Error('asset fetch failed'))
      .mockResolvedValue(undefined)

    const textbox = screen.getByRole('textbox')
    dispatchDrag(textbox, 'drop', {
      files: [new File(['x'], 'a.png', { type: 'image/png' })]
    })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())

    dispatchDrag(textbox, 'drop', {
      files: [new File(['x'], 'b.png', { type: 'image/png' })]
    })
    await vi.waitFor(() => expect(uploaded).toEqual(['a.png', 'b.png']))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
  })

  it('uploads a re-attached file again after its Imported asset is deleted', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const refresh = vi
      .spyOn(useAssetsStore().inputAssets, 'loadNew')
      .mockResolvedValue(undefined)
    const textbox = screen.getByRole('textbox')
    const file = new File(['x'], 'cat.png', { type: 'image/png' })

    dispatchDrag(textbox, 'drop', { files: [file] })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await clearTrayAsset('cat.png')
    dispatchDrag(textbox, 'drop', { files: [file] })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
    expect(uploaded).toEqual(['cat.png'])

    await clearTrayAsset('cat.png')
    useAssetsStore().setAssetDeleting('imported-cat', true)
    await nextTick()
    useAssetsStore().setAssetDeleting('imported-cat', false)
    dispatchDrag(textbox, 'drop', { files: [file] })

    await vi.waitFor(() => expect(uploaded).toEqual(['cat.png', 'cat.png']))
  })

  it.for([
    { change: 'account', account: 'account-b', workspace: 'workspace-a' },
    { change: 'workspace', account: 'account-a', workspace: 'workspace-b' }
  ])(
    'uploads a re-attached file again after the $change changes under a retained composer',
    async ({ account, workspace }) => {
      const accountId = ref('account-a')
      useCurrentUser().resolvedUserInfo = computed(() => ({
        id: accountId.value
      }))
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-a'
      })
      const uploaded = stubUploadFetch()
      renderWithSelectedTarget()
      await nextTick()
      const refresh = vi
        .spyOn(useAssetsStore().inputAssets, 'loadNew')
        .mockResolvedValue(undefined)
      const textbox = screen.getByRole('textbox')
      const file = new File(['x'], 'cat.png', { type: 'image/png' })

      dispatchDrag(textbox, 'drop', { files: [file] })
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      await clearTrayAsset('cat.png')
      dispatchDrag(textbox, 'drop', { files: [file] })
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
      expect(uploaded).toEqual(['cat.png'])

      await clearTrayAsset('cat.png')
      accountId.value = account
      Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: workspace })
      await nextTick()
      dispatchDrag(textbox, 'drop', { files: [file] })

      await vi.waitFor(() => expect(uploaded).toEqual(['cat.png', 'cat.png']))
      expect(screen.getByRole('textbox')).toBe(textbox)
    }
  )

  it('cancels a removed tray upload and keeps it retired after stale editor history', async () => {
    const signals: AbortSignal[] = []
    let finishUpload: (response: Response) => void = () => {}
    const upload = new Promise<Response>((resolve) => {
      finishUpload = resolve
    })
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!String(input).includes('/upload/'))
          return json(200, agentThreadList())
        if (init?.signal) signals.push(init.signal)
        return upload
      }
    )
    renderWithSelectedTarget()
    await nextTick()
    const refresh = vi
      .spyOn(useAssetsStore().inputAssets, 'loadNew')
      .mockResolvedValue(undefined)

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      files: [new File(['x'], 'cat.png', { type: 'image/png' })]
    })
    await vi.waitFor(() => expect(signals).toHaveLength(1))
    const composer = useAgentComposerStore()
    const prompt = composer.prompt

    await userEvent.click(
      await screen.findByRole('button', {
        name: i18n.global.t('agent.removeAsset', { name: 'cat.png' })
      })
    )

    expect(signals[0].aborted).toBe(true)
    finishUpload(
      json(200, { name: 'uploaded-cat.png', subfolder: '', type: 'input' })
    )
    await setImmediate()
    expect(refresh).not.toHaveBeenCalled()
    expect(composer.attachments).toEqual([])
    composer.applyEditorPrompt(prompt)
    expect(composer.attachments).toEqual([])
  })

  it('uses the server limit for audio rejection copy', async () => {
    vi.mocked(api.getServerFeature).mockReturnValue(24 * 1024 * 1024)
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const song = fileOfSize('big.mp3', 25 * 1024 * 1024, 'audio/mpeg')
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files: [song] })
    await nextTick()

    expect(uploaded).toEqual([])
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'big.mp3 is larger than 24 MB'
      })
    )
  })

  it('claims a dragover carrying files so a drop can reach the panel', async () => {
    // Without cancelling dragover the browser fires no drop at all, so this is
    // what makes the advertised drag-and-drop work.
    stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const target = screen.getByRole('textbox')

    expect(dispatchDrag(target, 'dragover', { types: ['Files'] })).toBe(true)
    expect(dispatchDrag(target, 'dragover', { types: ['text/plain'] })).toBe(
      false
    )
  })

  it.for([
    { tray: 'empty', attachments: [] },
    {
      tray: 'with an asset',
      attachments: [{ id: 'kept', name: 'kept.png', ref: 'kept.png' }]
    }
  ])(
    'shows panel-wide drop feedback across child transitions while preserving the composer (tray=$tray)',
    async ({ attachments }) => {
      stubUploadFetch()
      renderWithSelectedTarget()
      const store = useAgentComposerStore()
      store.replaceDraft({
        text: 'Keep this draft',
        workflowReferences: [],
        attachments
      })
      await nextTick()
      const prompt = store.prompt
      const header = screen.getByRole('button', {
        name: i18n.global.t('agent.close')
      })
      const composer = screen.getByTestId('composer-input-box')
      const data = {
        types: ['application/x-comfy-asset-info', 'text/uri-list']
      }
      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      dispatchDrag(header, 'dragenter', data)
      await nextTick()

      const dropTarget = screen.getByRole('status')
      expect(dropTarget).toHaveTextContent('Drag and drop assets here')
      expect(composer).not.toContainElement(dropTarget)
      expect(screen.getByRole('textbox')).toHaveTextContent('Keep this draft')
      expect(store.prompt).toEqual(prompt)
      expect(screen.queryAllByRole('group', { name: 'kept.png' })).toHaveLength(
        attachments.length
      )

      dispatchDrag(composer, 'dragenter', data)
      dispatchDrag(header, 'dragleave', data)
      await nextTick()
      expect(screen.getByRole('status')).toBe(dropTarget)

      dispatchDrag(composer, 'dragleave', data)
      await nextTick()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(store.prompt).toEqual(prompt)
      expect(store.attachments).toEqual(attachments)
    }
  )

  it('rejects URI-only drags without showing or claiming the asset target', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
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
      vi.mocked(fetch).mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes('/api/view'))
            return new Response(new Blob([mp4Header]), {
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
        }
      )
      renderWithSelectedTarget()
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
      const dropTarget = screen.getByRole('status')
      expect(dropTarget).toHaveTextContent('Drag and drop assets here')

      expect(dispatchDrag(target, 'dragover', dragData)).toBe(true)

      const claimed = dispatchDrag(target, 'drop', dragData)
      expect(claimed).toBe(true)
      await nextTick()
      expect(dropTarget).not.toBeInTheDocument()

      expect(
        within(await screen.findByTestId('composer-asset-section')).getByRole(
          'group',
          { name: filename }
        )
      ).toBeInTheDocument()

      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('describe this')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(messageBodies).toHaveLength(1)
      expect(messageBodies[0]).toMatchObject({
        content: 'describe this',
        attachments: [`uploaded_${filename}`]
      })
    }
  )

  it('keeps an invalid URI-only asset visible and blocks Send until removal', async () => {
    respondToFetch({}, () => json(200, agentThreadList()))
    respondToFetch(
      /\/api\/view/,
      () =>
        new Response(new Blob(['plain text']), {
          headers: { 'Content-Type': 'video/mp4' }
        })
    )
    renderWithSelectedTarget()
    await nextTick()

    expect(
      dispatchDrag(screen.getByRole('textbox'), 'drop', {
        types: ['application/x-comfy-asset-info', 'text/uri-list'],
        getData: (type: string) =>
          type === 'application/x-comfy-asset-info'
            ? JSON.stringify({ filename: 'renamed.mp4', type: 'input' })
            : 'http://localhost/api/view?filename=renamed.mp4'
      })
    ).toBe(true)

    expect(
      await screen.findByRole('status', {
        name: 'renamed.mp4 isn’t a valid video file. Remove it and try another file.'
      })
    ).toBeVisible()
    expect(screen.getByRole('group', { name: 'renamed.mp4' })).toBeVisible()
    await userEvent.type(screen.getByRole('textbox'), 'Describe these files')
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(fetchRequests(/\/messages$/)).toEqual([])
    expect(useToast().toasts).toEqual([])
    await userEvent.hover(screen.getByRole('group', { name: 'renamed.mp4' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove renamed.mp4' })
    )
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send' })).not.toHaveAttribute(
      'aria-disabled'
    )
    expect(fetchRequests(/\/api\/upload\/image$/)).toEqual([])
  })

  it.for([
    { mime: 'image/png', filename: 'gen.png' },
    { mime: 'video/mp4', filename: 'movie.mp4' }
  ])(
    'stages an existing Media-card $mime reference without uploading',
    async ({ mime, filename }) => {
      const messageBodies: unknown[] = []
      vi.mocked(fetch).mockImplementation(
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
      renderWithSelectedTarget()
      await nextTick()
      telemetry.trackAgentAttachButtonClicked.mockClear()
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
      expect(
        within(await screen.findByTestId('composer-asset-section')).getByRole(
          'group',
          { name: filename }
        )
      ).toBeInTheDocument()
      expect(
        within(screen.getByTestId('composer-asset-section')).getAllByRole(
          'group',
          { name: filename }
        )
      ).toHaveLength(1)
      expect(
        screen.queryByLabelText(i18n.global.t('agent.uploading'))
      ).not.toBeInTheDocument()
      // The duplicate drop left one chip, so it must also leave one event.
      await vi.waitFor(() =>
        expect(
          telemetry.trackAgentAttachButtonClicked
        ).toHaveBeenCalledExactlyOnceWith({ method: 'drag_drop' })
      )

      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(messageBodies).toHaveLength(1)
      expect(messageBodies[0]).toMatchObject({ attachments: [ref] })
      expect(fetchRequests(/\/api\/(view|upload\/image)/)).toEqual([])
    }
  )

  it('shows an uploading chip while a Media-card URI is still loading', async () => {
    let resolveAsset: (response: Response) => void = () => {}
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
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
    renderWithSelectedTarget()
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
    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'gen.png' }
      )
    ).toBeInTheDocument()
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

  it('uses the fetched asset filename when its display label has no type', async () => {
    const uploads: File[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/view'))
          return new Response(new Blob(['asset'], { type: 'image/png' }))
        if (url.endsWith('/api/upload/image')) {
          if (!(init?.body instanceof FormData))
            throw new Error('Expected upload form data')
          const image = init.body.get('image')
          if (!(image instanceof File)) throw new Error('Expected upload file')
          uploads.push(image)
          return json(200, { name: 'uploaded_gen.png' })
        }
        return json(200, agentThreadList())
      }
    )
    renderWithSelectedTarget()
    await nextTick()

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      types: ['application/x-comfy-asset-info', 'text/uri-list'],
      getData: (type: string) =>
        type === 'application/x-comfy-asset-info'
          ? JSON.stringify({ display_name: 'My renamed asset', type: 'input' })
          : 'http://localhost/api/view?filename=gen.png'
    })

    await vi.waitFor(() => expect(uploads).toHaveLength(1))
    expect(uploads[0].name).toBe('gen.png')
  })

  it('does not warn after closing the panel during a deferred asset fetch', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/view')) return new Promise(() => {})
      if (url.includes('/assets'))
        return Promise.resolve(
          json(200, { assets: [], total: 0, has_more: false })
        )
      if (url.includes('/workflows'))
        return Promise.resolve(
          json(200, { data: [], total: 0, has_more: false })
        )
      return Promise.resolve(json(200, agentThreadList()))
    })
    const { unmount } = renderWithSelectedTarget()
    await nextTick()
    const toast = useToast()
    vi.useFakeTimers()
    try {
      dispatchDrag(screen.getByRole('textbox'), 'drop', {
        types: ['application/x-comfy-asset-info', 'text/uri-list'],
        getData: (type: string) =>
          type === 'application/x-comfy-asset-info'
            ? JSON.stringify({ filename: 'gen.png', type: 'input' })
            : 'http://localhost/api/view?filename=gen.png'
      })
      await nextTick()
      expect(
        screen.getByLabelText(i18n.global.t('agent.uploading'))
      ).toBeInTheDocument()

      unmount()
      await vi.advanceTimersByTimeAsync(60_000)

      expect(toast.toasts).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts a timed-out asset fetch and reports the retrieval failure', async () => {
    let assetSignal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/api/view')) {
        assetSignal = init?.signal ?? undefined
        return new Promise(() => {})
      }
      if (url.includes('/assets'))
        return Promise.resolve(
          json(200, { assets: [], total: 0, has_more: false })
        )
      if (url.includes('/workflows'))
        return Promise.resolve(
          json(200, { data: [], total: 0, has_more: false })
        )
      return Promise.resolve(json(200, agentThreadList()))
    })
    renderWithSelectedTarget()
    await nextTick()
    vi.useFakeTimers()
    try {
      dispatchDrag(screen.getByRole('textbox'), 'drop', {
        types: ['application/x-comfy-asset-info', 'text/uri-list'],
        getData: (type: string) =>
          type === 'application/x-comfy-asset-info'
            ? JSON.stringify({ filename: 'gen.png', type: 'input' })
            : 'http://localhost/api/view?filename=gen.png'
      })
      await nextTick()
      await vi.advanceTimersByTimeAsync(60_000)

      expect(assetSignal?.aborted).toBe(true)
      expect(
        useToast().toasts.some(({ title }) =>
          title.includes('gen.png could not be retrieved')
        )
      ).toBe(true)
      expect(
        useToast().toasts.some(({ title }) =>
          title.includes('could not be uploaded')
        )
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stages a rejected asset card as an invalid chip without fetching or uploading it', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const store = useAgentComposerStore()

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      types: ['application/x-comfy-asset-info', 'text/uri-list'],
      getData: (type: string) =>
        type === 'application/x-comfy-asset-info'
          ? JSON.stringify({
              filename: 'scene.usdz',
              type: 'input',
              attachment_ref: 'stored_scene.usdz',
              media_kind: '3D'
            })
          : 'http://localhost/api/view?filename=stored_scene.usdz'
    })

    expect(
      await screen.findByRole('status', {
        name: unsupportedTypeMessage('scene.usdz')
      })
    ).toBeVisible()
    expect(store.attachments).toEqual([
      expect.objectContaining({
        name: 'scene.usdz',
        ref: '',
        validationError: 'unsupported-type'
      })
    ])
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) => String(input).includes('/api/view'))
    ).toBe(false)
    expect(uploaded).toEqual([])
    expect(useToast().toasts).toEqual([])
  })

  it('preserves an opaque asset ref instead of uploading it', async () => {
    const uploads: File[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/view'))
          return new Response(new Blob(['x'], { type: 'image/png' }))
        if (url.endsWith('/api/upload/image')) {
          if (init?.body instanceof FormData) {
            const image = init.body.get('image')
            if (image instanceof File) uploads.push(image)
          }
          return json(200, { name: 'uploaded.png' })
        }
        return json(200, agentThreadList())
      }
    )
    renderWithSelectedTarget()
    await nextTick()

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      types: ['application/x-comfy-asset-info', 'text/uri-list'],
      getData: (type: string) =>
        type === 'application/x-comfy-asset-info'
          ? JSON.stringify({
              filename: 'photo.png',
              type: 'input',
              attachment_ref: 'blake3:abcdef0123456789',
              media_kind: 'image'
            })
          : 'http://localhost/api/view?filename=real.png'
    })

    await vi.waitFor(() =>
      expect(useAgentComposerStore().attachments).toEqual([
        expect.objectContaining({
          name: 'photo.png',
          ref: 'blake3:abcdef0123456789'
        })
      ])
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(uploads).toHaveLength(0)
    expect(useToast().toasts).toEqual([])
  })

  it('stages an opaque asset card with a rejected label as an invalid chip', async () => {
    stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      types: ['application/x-comfy-asset-info'],
      getData: () =>
        JSON.stringify({
          filename: 'scene.usdz',
          type: 'input',
          attachment_ref: 'blake3:abcdef0123456789',
          media_kind: '3D'
        })
    })

    expect(
      await screen.findByRole('status', {
        name: unsupportedTypeMessage('scene.usdz')
      })
    ).toBeVisible()
    expect(useToast().toasts).toEqual([])
  })

  it('keeps a fetched asset of an unaccepted type as an invalid chip under its stored name', async () => {
    const uploads: File[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/view'))
          return new Response(new Blob(['%PDF'], { type: 'application/pdf' }))
        if (url.endsWith('/api/upload/image')) {
          if (init?.body instanceof FormData) {
            const image = init.body.get('image')
            if (image instanceof File) uploads.push(image)
          }
          return json(200, { name: 'uploaded.pdf' })
        }
        return json(200, agentThreadList())
      }
    )
    renderWithSelectedTarget()
    await nextTick()

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      types: ['application/x-comfy-asset-info', 'text/uri-list'],
      getData: (type: string) =>
        type === 'application/x-comfy-asset-info'
          ? JSON.stringify({
              filename: 'My scan',
              type: 'input'
            })
          : 'http://localhost/api/view?filename=scan.pdf'
    })

    expect(
      await screen.findByRole('status', {
        name: unsupportedTypeMessage('scan.pdf')
      })
    ).toBeVisible()
    expect(uploads).toEqual([])
    expect(useToast().toasts).toEqual([])
  })

  it('refuses an asset card once the turn is already full', async () => {
    stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const card = (index: number) => ({
      types: ['application/x-comfy-asset-info'],
      getData: () =>
        JSON.stringify({
          filename: `photo${index}.png`,
          type: 'input',
          attachment_ref: `stored_photo${index}.png`,
          media_kind: 'image'
        })
    })
    const target = screen.getByRole('textbox')
    for (let index = 0; index < MAX_TURN_ATTACHMENTS; index++) {
      dispatchDrag(target, 'drop', card(index))
    }
    await vi.waitFor(() =>
      expect(
        within(screen.getByTestId('composer-asset-section')).getAllByTestId(
          'agent-attachment-chip'
        )
      ).toHaveLength(MAX_TURN_ATTACHMENTS)
    )

    dispatchDrag(target, 'drop', card(MAX_TURN_ATTACHMENTS))

    await vi.waitFor(() =>
      expect(useToast().toasts.map(({ title }) => title)).toContain(
        'Only 25 files can be attached to one message'
      )
    )
    expect(
      within(screen.getByTestId('composer-asset-section')).getAllByTestId(
        'agent-attachment-chip'
      )
    ).toHaveLength(MAX_TURN_ATTACHMENTS)
  })

  it('judges an asset by its stored filename rather than its display label', async () => {
    stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    dispatchDrag(screen.getByRole('textbox'), 'drop', {
      types: ['application/x-comfy-asset-info'],
      getData: () =>
        JSON.stringify({
          filename: 'renamed.usdz',
          type: 'input',
          attachment_ref: 'stored.png',
          media_kind: 'image'
        })
    })

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'renamed.usdz' }
      )
    ).toBeInTheDocument()
    expect(useToast().toasts).toEqual([])
  })

  it('attaches a dropped workflow json to the chat instead of the graph loader', async () => {
    stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const target = screen.getByRole('button', {
      name: i18n.global.t('agent.close')
    })

    const workflow = new File(['{}'], 'flow.json', {
      type: 'application/json'
    })
    expect(dispatchDrag(target, 'drop', { files: [workflow] })).toBe(true)
    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'flow.json' }
      )
    ).toBeInTheDocument()
  })

  it.for([
    { copies: 1, notice: 'cat.png is already in the asset tray' },
    { copies: 2, notice: 'Skipped 2 duplicate assets' }
  ])('reports $copies skipped files once', async ({ copies, notice }) => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()
    const store = useAgentComposerStore()
    store.setText('Keep this draft')
    const target = screen.getByRole('textbox')
    await userEvent.click(target)
    dispatchDrag(target, 'drop', {
      files: [
        new File(['image'], 'cat.png', { type: 'image/png', lastModified: 1 })
      ]
    })
    await vi.waitFor(() => expect(store.attachments[0]?.uploading).toBe(false))
    expect(useToast().toasts).toEqual([])
    dispatchDrag(target, 'drop', {
      files: [
        ...Array.from(
          { length: copies },
          () =>
            new File(['image'], 'cat.png', {
              type: 'image/png',
              lastModified: 1
            })
        ),
        new File(['another image'], 'dog.png', { type: 'image/png' })
      ]
    })
    await nextTick()
    expect(
      within(screen.getByTestId('composer-asset-section')).getAllByRole(
        'group',
        {
          name: 'cat.png'
        }
      )
    ).toHaveLength(1)
    await vi.waitFor(() => expect(uploaded).toEqual(['cat.png', 'dog.png']))
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ kind: 'info', title: notice })
    ])
    expect(screen.getByRole('group', { name: 'dog.png' })).toBeInTheDocument()
    expect(target).toHaveFocus()
    expect(store.prompt).toEqual({ text: 'Keep this draft', references: [] })
  })

  it('attaches the accepted files out of a mixed drop and keeps the rest as invalid chips', async () => {
    const uploaded = stubUploadFetch()
    renderWithSelectedTarget()
    await nextTick()

    const files = [
      new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
      new File(['x'], 'cat.png', { type: 'image/png' })
    ]
    dispatchDrag(screen.getByRole('textbox'), 'drop', { files })

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'cat.png' }
      )
    ).toBeInTheDocument()
    await vi.waitFor(() => expect(uploaded).toEqual(['cat.png']))
    expect(
      screen.getByRole('status', { name: unsupportedTypeMessage('doc.pdf') })
    ).toBeVisible()
    expect(useToast().toasts).toEqual([])
  })

  it.for(['failed', 'cancelled'] as const)(
    'emits no drop telemetry for a %s deferred asset',
    async (outcome) => {
      let resolveAsset: (response: Response) => void = () => {}
      let rejectAsset: (error: Error) => void = () => {}
      vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/view'))
          return new Promise<Response>((resolve, reject) => {
            resolveAsset = resolve
            rejectAsset = reject
          })
        if (url.endsWith('/api/upload/image'))
          return Promise.resolve(
            json(200, {
              name: 'uploaded_gen.png',
              subfolder: '',
              type: 'input'
            })
          )
        return Promise.resolve(json(200, agentThreadList()))
      })
      renderWithSelectedTarget()
      await nextTick()
      telemetry.trackAgentAttachButtonClicked.mockClear()

      const dragData = {
        types: ['application/x-comfy-asset-info', 'text/uri-list'],
        getData: (type: string) =>
          type === 'application/x-comfy-asset-info'
            ? JSON.stringify({ filename: 'gen.png', type: 'input' })
            : 'http://localhost/api/view?filename=gen.png'
      }
      expect(dispatchDrag(screen.getByRole('textbox'), 'drop', dragData)).toBe(
        true
      )
      expect(
        await screen.findByLabelText(i18n.global.t('agent.uploading'))
      ).toBeInTheDocument()

      if (outcome === 'cancelled') {
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.removeAsset', { name: 'gen.png' })
          })
        )
        resolveAsset(new Response(new Blob(['asset'], { type: 'image/png' })))
      } else {
        rejectAsset(new Error('asset fetch failed'))
      }
      await vi.waitFor(() =>
        expect(
          screen.queryByLabelText(i18n.global.t('agent.uploading'))
        ).not.toBeInTheDocument()
      )
      await nextTick()

      expect(telemetry.trackAgentAttachButtonClicked).not.toHaveBeenCalled()
    }
  )

  it.for([
    { files: ['bad.png'], expectedEvents: 0 },
    { files: ['bad.png', 'good.png'], expectedEvents: 1 }
  ])(
    'emits $expectedEvents drop event(s) when uploads of $files are rejected except any good one',
    async ({ files, expectedEvents }) => {
      vi.mocked(fetch).mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (!url.includes('/upload/')) return json(200, agentThreadList())
          const body = init?.body
          const file = body instanceof FormData ? body.get('image') : null
          const name = file instanceof File ? file.name : ''
          if (name.startsWith('bad')) return json(500, {})
          return json(200, {
            name: `uploaded_${name}`,
            subfolder: '',
            type: 'input'
          })
        }
      )
      renderWithSelectedTarget()
      await nextTick()
      telemetry.trackAgentAttachButtonClicked.mockClear()

      dispatchDrag(screen.getByRole('textbox'), 'drop', {
        files: files.map((name) => new File(['x'], name, { type: 'image/png' }))
      })

      // The rejected upload's chip leaves; only a committed one stays settled.
      await vi.waitFor(() =>
        expect(
          screen.queryByRole('group', { name: 'bad.png' })
        ).not.toBeInTheDocument()
      )
      await vi.waitFor(() =>
        expect(
          screen.queryByLabelText(i18n.global.t('agent.uploading'))
        ).not.toBeInTheDocument()
      )
      await nextTick()

      if (expectedEvents === 0) {
        expect(telemetry.trackAgentAttachButtonClicked).not.toHaveBeenCalled()
      } else {
        expect(
          within(screen.getByTestId('composer-asset-section')).getByRole(
            'group',
            { name: 'good.png' }
          )
        ).toBeInTheDocument()
        await vi.waitFor(() =>
          expect(
            telemetry.trackAgentAttachButtonClicked
          ).toHaveBeenCalledExactlyOnceWith({ method: 'drag_drop' })
        )
      }
    }
  )

  it.for(['valid', 'invalid'] as const)(
    'removing a video during %s validation cancels it and allows a fresh retry',
    async (outcome) => {
      const uploaded = stubUploadFetch()
      renderWithSelectedTarget()
      const file = new File(
        [outcome === 'valid' ? mp4Header : 'plain text'],
        'clip.mp4',
        { type: 'video/mp4' }
      )
      const header = file.slice(0, 12)
      const bytes = await header.arrayBuffer()
      let finishValidation: (bytes: ArrayBuffer) => void = () => {}
      const validation = new Promise<ArrayBuffer>((resolve) => {
        finishValidation = resolve
      })
      vi.spyOn(file, 'slice').mockReturnValue(header)
      vi.spyOn(header, 'arrayBuffer').mockReturnValue(validation)
      const input = screen.getByTestId<HTMLInputElement>('agent-file-input')
      await userEvent.upload(input, file)
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('Describe the clip')
      expect(
        screen.getByRole('group', { name: 'clip.mp4' })
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
      await userEvent.keyboard('{Enter}')
      expect(fetchRequests(/\/messages$/)).toHaveLength(0)

      await clearTrayAsset('clip.mp4')
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      await userEvent.upload(
        input,
        new File([mp4Header], 'clip.mp4', { type: 'video/mp4' })
      )
      await vi.waitFor(() => expect(uploaded).toEqual(['clip.mp4']))
      finishValidation(bytes)
      await setImmediate()

      expect(uploaded).toEqual(['clip.mp4'])
      expect(
        useToast().toasts.filter(({ kind }) => kind === 'warning')
      ).toEqual([])
      expect(
        screen.getByRole('group', { name: 'clip.mp4' })
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    }
  )

  it('shows an uploading chip and blocks send until the upload settles', async () => {
    let settleUpload: () => void = () => {}
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

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

    renderWithSelectedTarget()

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )

    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'cat.png' }
      )
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.global.t('agent.uploading'))
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('make it pop')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    settleUpload()
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    )
    expect(
      screen.queryByLabelText(i18n.global.t('agent.uploading'))
    ).not.toBeInTheDocument()
  })

  async function attachExr(
    assets: Pick<AssetItem, 'id' | 'name' | 'hash' | 'preview_id'>[]
  ) {
    respondToFetch({}, () =>
      json(202, { thread_id: 'th-1', message_id: 'm-1' })
    )
    respondToFetch(/\/api\/upload\/image$/, () =>
      json(200, { name: 'a1b2c3', subfolder: '', type: 'input' })
    )
    respondToFetch(/\/api\/assets\?/, () => json(200, { assets }))

    renderWithSelectedTarget()

    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      new File(['x'], 'plate.exr', { type: '' })
    )

    const chip = within(
      await screen.findByTestId('composer-asset-section')
    ).getByRole('group', { name: 'plate.exr' })
    await vi.waitFor(() =>
      expect(
        screen.queryByLabelText(i18n.global.t('agent.uploading'))
      ).not.toBeInTheDocument()
    )
    return chip
  }

  it('shows the stored preview of an uploaded EXR stored under its content hash', async () => {
    const chip = await attachExr([
      { id: 'a-1', name: 'plate.exr', hash: 'a1b2c3', preview_id: 'p-1' }
    ])

    await vi.waitFor(() =>
      expect(within(chip).getByAltText('plate.exr')).toHaveAttribute(
        'src',
        expect.stringContaining('/assets/p-1/content')
      )
    )
  })

  it('shows the name tile for an EXR with no stored preview', async () => {
    const chip = await attachExr([])

    expect(within(chip).queryByRole('img')).not.toBeInTheDocument()
    expect(within(chip).getByText('plate.exr')).toBeInTheDocument()
  })

  it('renders the attachment on the turn that sent it, not earlier turns', async () => {
    let acks = 0
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

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
        return json(200, agentThreadList())
      }
    )

    await renderAndSend('first message')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    within(await screen.findByTestId('composer-asset-section')).getByRole(
      'group',
      { name: 'cat.png' }
    )
    await sendFromComposer('second message')

    const thumbs = screen.getAllByAltText('cat.png')
    expect(thumbs).toHaveLength(1)
    const firstBubble = screen.getAllByText('first message').at(-1)!
    expect(
      firstBubble.compareDocumentPosition(thumbs[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('attributes an upload failure, then visibly recovers when the flag turns off without leaking prompt or path', async () => {
    executionErrors.showErrorOverlay.mockClear()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    let failUpload: () => void = () => {}
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/agent/run-mode')) {
        return new Response('{"error":"not found"}', {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (url.includes('/api/workflows')) {
        return json(200, {
          data: [],
          pagination: { offset: 0, limit: 100, total: 0, has_more: false }
        })
      }
      if (url.includes('/api/assets')) {
        return json(200, { assets: [], total: 0, has_more: false })
      }
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

    const agentPanelStore = useAgentPanelStore()
    agentPanelStore.enabled = true
    agentPanelStore.consentAccepted = true
    agentPanelStore.isOpen = true
    agentPanelStore.setWorkflowTarget(
      fromPartial<ComfyWorkflow>(workflowStore.activeWorkflow!)
    )
    render(DockedAgentPanel, { global: { plugins: [i18n] } })
    await screen.findByTestId('docked-agent-panel')

    const privatePrompt = 'Use the unreleased launch prompt'
    await userEvent.type(
      await screen.findByRole('textbox', undefined, { timeout: 5000 }),
      privatePrompt
    )

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    const privatePath = '/Users/jo/private/cat.png'
    Object.defineProperty(file, 'webkitRelativePath', { value: privatePath })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'group',
        { name: 'cat.png' }
      )
    ).toBeInTheDocument()

    executionErrors.showErrorOverlay.mockClear()
    vi.mocked(reportError).mockClear()
    failUpload()
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('group', { name: 'cat.png' })
      ).not.toBeInTheDocument()
    )
    expect(revoke).toHaveBeenCalledTimes(1)
    // A rejected file is the user's to fix; raising the server-error overlay
    // told them the agent had broken instead.
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'cat.png could not be uploaded'
      })
    )
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_attachment_upload_failed',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'agent',
        operation: 'save',
        outcome: 'failed',
        integration_target: 'assets',
        feature_flag: 'agent_panel',
        feature_flag_state: 'enabled',
        project_context: 'agent_composer',
        upload_failure_cause: 'http_500',
        file_type: 'image/png',
        file_size_bytes: 1
      }
    })
    const serializedReport = JSON.stringify(vi.mocked(reportError).mock.calls)
    expect(serializedReport).not.toContain('cat.png')
    expect(serializedReport).not.toContain(privatePrompt)
    expect(serializedReport).not.toContain(privatePath)

    agentPanelStore.enabled = false
    await nextTick()

    expect(screen.queryByTestId('docked-agent-panel')).not.toBeInTheDocument()
    expect(screen.queryByText(privatePrompt)).not.toBeInTheDocument()
    expect(agentPanelStore.isOpen).toBe(true)
    revoke.mockRestore()
  })

  it('keeps a durable tray preview through inline deletion, Undo and unmount', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

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

    const view = renderWithSelectedTarget()

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByTestId<HTMLInputElement>('agent-file-input'),
      file
    )
    const assetSection = await screen.findByTestId('composer-asset-section')
    expect(
      within(assetSection).getByRole('group', { name: 'cat.png' })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(assetSection).getByRole('img', { name: 'cat.png' })
      ).toHaveAttribute('src', '/api/view?filename=uploaded_cat.png&type=input')
    )
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:mock-url')

    const composer = useAgentComposerStore()
    composer.referenceAttachment(composer.attachments[0].id)
    await screen.findByTestId('asset-reference-chip')
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}')
    expect(screen.queryByTestId('asset-reference-chip')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('composer-asset-section')).getByRole('group', {
        name: 'cat.png'
      })
    ).toBeVisible()
    screen.getByRole('textbox').focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(
      within(await screen.findByTestId('composer-asset-section')).getByRole(
        'img',
        { name: 'cat.png' }
      )
    ).toHaveAttribute('src', '/api/view?filename=uploaded_cat.png&type=input')
    expect(screen.getByTestId('asset-reference-chip')).toHaveTextContent(
      'cat.png'
    )
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:mock-url')
    view.unmount()
    expect(revoke).toHaveBeenCalledTimes(1)
    revoke.mockRestore()
  })
})

describe('AgentPanelRoot canvas draft on send', () => {
  it('sends the active tab activeState as draft.content (PM-813/ecw-128)', async () => {
    const messageBodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (threadListRoute.test(url)) return json(200, agentThreadList())
        messageBodies.push(JSON.parse(String(init?.body)))
        return json(202, { thread_id: 'th-1', message_id: 'm-1' })
      }
    )
    const activeState = fromPartial<ComfyWorkflowJSON>({
      nodes: [
        { id: 1, type: 'LoadImage' },
        { id: 2, type: 'MiniMaxH3I2V' }
      ],
      links: []
    })
    const prepareForSave = vi.fn()
    const activeWorkflow = addTab('workflows/video_minimax_h3_i2v.json', {
      activeState,
      changeTracker: createMockChangeTracker({ prepareForSave })
    })
    workflowStore.activeWorkflow = activeWorkflow

    renderWithSelectedTarget()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste("what's on my canvas")
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(1)
    expect(messageBodies[0]).toMatchObject({
      content: "what's on my canvas",
      draft: { content: activeState }
    })
    expect(prepareForSave).toHaveBeenCalledOnce()
  })

  it('does not send or clear the prompt when there is no selected target', async () => {
    const messageBodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (threadListRoute.test(url)) return json(200, agentThreadList())
        messageBodies.push(JSON.parse(String(init?.body)))
        return json(202, { thread_id: 'th-1', message_id: 'm-1' })
      }
    )
    workflowStore.activeWorkflow = null

    renderWithSelectedTarget()

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('hello')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(messageBodies).toHaveLength(0)
    expect(useAgentComposerStore().draft).toBe('hello')
  })
})

describe('AgentPanelRoot history', () => {
  beforeEach(() => {
    respondToFetch({}, () => json(200, []))
  })

  async function openHistory(): Promise<void> {
    await userEvent.click(
      await screen.findByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await screen.findByRole('heading', {
      name: i18n.global.t('agent.history')
    })
  }

  async function renderWithActiveThread(): Promise<void> {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      return threadListRoute.test(url)
        ? new Response(
            JSON.stringify(
              agentThreadList([
                agentThread({
                  id: 'th-active',
                  title: 'build a duck',
                  last_message_at: '2026-07-07T10:00:00Z'
                })
              ])
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        : new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
    })
    useAgentConversationStore().setThreadId('th-active')
    renderWithSelectedTarget()
    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().activeId).toBe('th-active')
    )
  }

  it('shows the server-assigned title in the open chat header without a rename (PM-2098)', async () => {
    await renderWithActiveThread()

    expect(screen.getByRole('button', { name: 'build a duck' })).toBeVisible()
  })

  it('keeps a new chat rename when the first turn creates its thread', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) =>
      threadListRoute.test(String(input))
        ? json(200, agentThreadList())
        : json(202, { thread_id: 'th-new', message_id: 'm-new' })
    )
    workflowStore.activeWorkflow = addTab('workflows/new-chat.json')
    renderWithSelectedTarget()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.newChatTitle')
      })
    )
    const renameInput = await screen.findByRole<HTMLInputElement>('textbox', {
      name: i18n.global.t('g.rename')
    })
    await userEvent.type(renameInput, 'Duck storyboard{Enter}')
    expect(screen.getByText('Duck storyboard')).toBeInTheDocument()

    const composer = screen.getByRole('textbox')
    await userEvent.click(composer)
    await userEvent.paste('Build it')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await vi.waitFor(() => {
      expect(useAgentConversationStore().threadId).toBe('th-new')
      expect(useAgentChatHistoryStore().titleFor('th-new')).toBe(
        'Duck storyboard'
      )
    })
    expect(reportError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorType: 'agent_thread_list_load_failed' })
    )
  })

  it('keeps a new chat rename after recovering a deleted thread', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    workflowStore.activeWorkflow = addTab('workflows/new-chat.json')
    mockMessagesEndpoint('wf-first')
    let accepted = 0
    respondToFetch(
      { method: 'POST', url: /\/agent\/threads\/[^/]+\/messages$/ },
      () => {
        accepted += 1
        return json(202, {
          thread_id: `th-${accepted}`,
          message_id: `message-${accepted}`,
          workflow_id: 'wf-first'
        })
      }
    )
    respondToFetch(
      { method: 'GET', url: '/api/agent/threads/th-1/messages' },
      () => json(404, { error: 'gone' })
    )
    renderWithSelectedTarget()
    agentSocket.open()
    await sendFromComposer('First request')
    expect(useAgentConversationStore().threadId).toBe('th-1')

    agentSocket.drop()
    agentSocket.open()
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() =>
      expect(useAgentConversationStore().threadId).toBeNull()
    )
    await userEvent.click(
      await screen.findByRole('button', {
        name: i18n.global.t('agent.newChatTitle')
      })
    )
    const renameInput = await screen.findByRole('textbox', {
      name: i18n.global.t('g.rename')
    })
    await userEvent.type(renameInput, 'Recovered storyboard{Enter}')

    await sendFromComposer('Try again')

    expect(useAgentConversationStore().threadId).toBe('th-2')
    expect(useAgentChatHistoryStore().titleFor('th-2')).toBe(
      'Recovered storyboard'
    )
    expect(
      screen.getByRole('button', { name: 'Recovered storyboard' })
    ).toBeVisible()
  })

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
    await userEvent.clear(input)
    await userEvent.type(input, 'my masterpiece{Enter}')

    expect(await screen.findByText('my masterpiece')).toBeInTheDocument()
    expect(useAgentChatHistoryStore().grouped.current[0]).toMatchObject({
      id: 'th-active',
      title: 'my masterpiece'
    })
    expect(
      screen.getByRole('button', { name: 'my masterpiece' })
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
    await userEvent.clear(input)
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

    await userEvent.click(screen.getByRole('button', { name: 'build a duck' }))

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
      {
        id: 'th-active',
        title: 'build a duck',
        updatedAt: Date.now(),
        titleSource: 'server'
      }
    ])
    expect(useAgentChatHistoryStore().sessions).toHaveLength(0)
  })

  it('populates Chat History from the server thread list on mount', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (threadListRoute.test(url)) {
        return new Response(
          JSON.stringify(
            agentThreadList([
              agentThread({
                id: 'th-9',
                title: 'build a text to image graph',
                last_message_at: '2026-07-07T10:00:00Z'
              }),
              agentThread({
                id: 'th-10',
                title: '',
                preview: 'make a duck',
                last_message_at: '2026-07-07T09:00:00Z'
              })
            ])
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    renderWithSelectedTarget()

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

  it('lists a chat with no valid time among today’s chats', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) =>
      threadListRoute.test(String(input))
        ? json(
            200,
            agentThreadList([
              agentThread({
                id: 'th-stampless',
                title: 'Stampless chat',
                last_message_at: '',
                updated_at: 'unknown',
                created_at: ''
              })
            ])
          )
        : json(200, [])
    )

    renderWithSelectedTarget()

    const history = useAgentChatHistoryStore()
    await vi.waitFor(() =>
      expect(history.grouped.today.map(({ id }) => id)).toEqual([
        'th-stampless'
      ])
    )
  })

  it('switches to the chat bound to the active workflow tab', async () => {
    const first = addTab('workflows/first.json')
    const second = addTab('workflows/second.json')
    workflowStore.activeWorkflow = first

    const loadedThreads: string[] = []
    let resolveWorkflows!: () => void
    const workflowsListed = new Promise<void>((resolve) => {
      resolveWorkflows = resolve
    })
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (threadListRoute.test(url))
        return json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-first',
              title: 'First chat',
              last_message_at: '2026-09-22T10:00:00Z',
              workflow_id: 'wf-first'
            }),
            agentThread({
              id: 'th-second',
              title: 'Second chat',
              last_message_at: '2026-09-22T09:00:00Z',
              workflow_id: 'wf-second'
            })
          ])
        )
      if (url.includes('/api/workflows')) {
        await workflowsListed
        return json(200, {
          data: [
            { id: 'wf-first', name: 'first' },
            { id: 'wf-second', name: 'second' }
          ],
          pagination: { offset: 0, limit: 100, total: 2, has_more: false }
        })
      }
      const match = url.match(/\/api\/agent\/threads\/([^/]+)\/messages$/)
      if (match) {
        loadedThreads.push(match[1])
        return json(200, [])
      }
      return json(200, { data: [], pagination: { has_more: false } })
    })

    renderWithSelectedTarget()
    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().sessions).toHaveLength(2)
    )
    expect(useAgentConversationStore().threadId).toBeNull()

    await activateTabAsUser(second)
    await settleFollow()
    expect(useAgentConversationStore().threadId).toBeNull()

    resolveWorkflows()

    await vi.waitFor(() =>
      expect(useAgentConversationStore().threadId).toBe('th-second')
    )

    await activateTabAsUser(first)

    await vi.waitFor(() =>
      expect(useAgentConversationStore().threadId).toBe('th-first')
    )
    expect(loadedThreads).toEqual(['th-second', 'th-first'])
  })

  describe('following the active workflow tab', () => {
    function transcriptFor(threadId: string, workflowId?: string): Response {
      return json(200, [
        {
          id: `${threadId}-user`,
          thread_id: threadId,
          seq: 1,
          role: 'user',
          status: 'complete',
          turn_id: `${threadId}-turn`,
          workflow_id: workflowId,
          content: { text: `Prompt in ${threadId}` }
        }
      ] satisfies AgentMessages)
    }

    function stubWorkflowBoundHistory(
      threads: AgentThreadSummary[],
      transcripts: Partial<
        Record<
          string,
          { workflowId?: string; response?: () => Promise<Response> }
        >
      > = {},
      {
        post = async (threadId: string) =>
          json(202, { thread_id: threadId, message_id: `${threadId}-sent` })
      }: { post?: (threadId: string) => Promise<Response> } = {}
    ): {
      loadedThreads: string[]
      listCalls: () => number
    } {
      const loadedThreads: string[] = []
      let listCalls = 0
      function answerMessages(
        threadId: string,
        method: string | undefined
      ): Promise<Response> | Response {
        if (method === 'POST') return post(threadId)
        loadedThreads.push(threadId)
        const transcript = transcripts[threadId]
        return transcript?.response
          ? transcript.response()
          : transcriptFor(threadId, transcript?.workflowId)
      }
      vi.mocked(fetch).mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (threadListRoute.test(url)) {
            listCalls += 1
            return json(200, agentThreadList(threads))
          }
          if (url.includes('/api/workflows'))
            return json(200, {
              data: [
                { id: 'wf-first', name: 'first' },
                { id: 'wf-second', name: 'second' },
                { id: 'wf-third', name: 'third' }
              ],
              pagination: { offset: 0, limit: 100, total: 3, has_more: false }
            })
          const match = url.match(/\/api\/agent\/threads\/([^/]+)\/messages$/)
          if (match) return answerMessages(match[1], init?.method)
          return json(200, { data: [], pagination: { has_more: false } })
        }
      )
      return { loadedThreads, listCalls: () => listCalls }
    }

    function userPrompts(): string[] {
      return useAgentConversationStore().entries.flatMap((entry) =>
        entry.role === 'user' ? [entry.text] : []
      )
    }

    it('keeps the current chat when the active tab has no matching thread', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = second
      const { loadedThreads } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-first',
          title: 'First chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-first'
        })
      ])

      renderWithSelectedTarget()
      await activateTabAsUser(first)
      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-first')
      )
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-first'])
      )

      await activateTabAsUser(second)
      await settleFollow()

      expect(useAgentConversationStore().threadId).toBe('th-first')
      expect(userPrompts()).toEqual(['Prompt in th-first'])
      expect(loadedThreads).toEqual(['th-first'])
    })

    it('does not pull a manually selected chat back to the active tab', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = second
      const { loadedThreads, listCalls } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-first',
          title: 'First chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-first'
        }),
        agentThread({
          id: 'th-other',
          title: 'Other chat',
          last_message_at: '2026-09-22T09:00:00Z',
          workflow_id: 'wf-second'
        })
      ])

      renderWithSelectedTarget()
      await activateTabAsUser(first)
      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-first')
      )
      const callsBeforeSelect = listCalls()

      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Other chat'))
      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-other')
      )
      await vi.waitFor(() =>
        expect(listCalls()).toBeGreaterThan(callsBeforeSelect)
      )
      await settleFollow()

      expect(useAgentConversationStore().threadId).toBe('th-other')
      expect(loadedThreads).toEqual(['th-first', 'th-other'])
    })

    async function activateWhileTabIdsLoad(): Promise<{
      resolveWorkflows: () => void
      loadedThreads: string[]
    }> {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = second

      const loadedThreads: string[] = []
      let resolveWorkflows!: () => void
      const workflowsListed = new Promise<void>((resolve) => {
        resolveWorkflows = resolve
      })
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (threadListRoute.test(url))
          return json(
            200,
            agentThreadList([
              agentThread({
                id: 'th-first',
                title: 'First chat',
                last_message_at: '2026-09-22T10:00:00Z',
                workflow_id: 'wf-first'
              })
            ])
          )
        if (url.includes('/api/workflows')) {
          await workflowsListed
          return json(200, {
            data: [{ id: 'wf-first', name: 'first' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        }
        const match = url.match(/\/api\/agent\/threads\/([^/]+)\/messages$/)
        if (match) {
          loadedThreads.push(match[1])
          return json(200, [])
        }
        return json(200, { data: [], pagination: { has_more: false } })
      })

      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      await activateTabAsUser(first)
      await settleFollow()
      expect(loadedThreads).toEqual([])

      return { loadedThreads, resolveWorkflows }
    }

    it.for([
      { meanwhile: 'nothing', act: async () => {}, loads: ['th-first'] },
      {
        meanwhile: 'a new chat',
        act: () =>
          userEvent.click(
            screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
          ),
        loads: []
      },
      {
        meanwhile: 'a draft typed and cleared',
        act: async () => {
          const composer = useAgentComposerStore()
          composer.setText('make it blue')
          await nextTick()
          composer.setText('')
          await nextTick()
        },
        loads: []
      }
    ])(
      'after $meanwhile, a follow waiting on the tab id loads $loads',
      async ({ act, loads }) => {
        const { resolveWorkflows, loadedThreads } =
          await activateWhileTabIdsLoad()

        await act()
        resolveWorkflows()
        await settleFollow()

        expect(loadedThreads).toEqual(loads)
      }
    )

    it("opens the newest of the tab's chats that is not deleted", async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const { loadedThreads } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-older',
          title: 'Older chat',
          last_message_at: '2026-09-22T08:00:00Z',
          workflow_id: 'wf-second'
        }),
        agentThread({
          id: 'th-newer',
          title: 'Newer chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        }),
        agentThread({
          id: 'th-deleted',
          title: 'Deleted chat',
          last_message_at: '2026-09-22T11:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      useAgentChatHistoryStore().remove('th-deleted')

      renderWithSelectedTarget()
      await activateTabAsUser(second)

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-newer')
      )
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
      expect(loadedThreads).toEqual(['th-newer'])
    })

    type Composer = ReturnType<typeof useAgentComposerStore>

    it.for([
      {
        draft: 'text',
        fill: (composer: Composer) => composer.setText('make it blue'),
        drafted: (composer: Composer) => composer.draft,
        clear: (composer: Composer) => composer.setText('')
      },
      {
        draft: 'a workflow reference',
        fill: (composer: Composer) =>
          composer.setWorkflowReferences([
            { id: 'wf-third', name: 'third', textOffset: 0 }
          ]),
        drafted: (composer: Composer) =>
          composer.workflowReferences.map(({ id }) => id),
        clear: (composer: Composer) => composer.setWorkflowReferences([])
      },
      {
        draft: 'only a scoped skill reference',
        fill: (composer: Composer) =>
          composer.restorePrompt({
            text: '',
            references: [
              {
                kind: 'skill',
                name: 'portrait',
                description: 'Keep the subject recognizable',
                scope: JSON.stringify([
                  location.origin,
                  api.apiURL('/agent/skills'),
                  useCurrentUser().resolvedUserInfo.value?.id ?? null,
                  useTeamWorkspaceStore().workspaceId ?? null
                ]),
                textOffset: 0
              } satisfies ComposerReference
            ]
          }),
        drafted: (composer: Composer) => ({
          text: composer.prompt.text,
          references: composer.prompt.references.map((reference) => ({
            ...reference
          }))
        }),
        clear: (composer: Composer) =>
          composer.restorePrompt({ text: '', references: [] })
      }
    ])(
      'keeps the chat, draft and target when the composer holds $draft',
      async ({ fill, drafted, clear }) => {
        const first = addTab('workflows/first.json')
        const second = addTab('workflows/second.json')
        workflowStore.activeWorkflow = first
        const { loadedThreads } = stubWorkflowBoundHistory(
          [
            agentThread({
              id: 'th-first',
              title: 'First chat',
              last_message_at: '2026-09-22T09:00:00Z',
              workflow_id: 'wf-first'
            }),
            agentThread({
              id: 'th-second',
              title: 'Second chat',
              last_message_at: '2026-09-22T10:00:00Z',
              workflow_id: 'wf-second'
            })
          ],
          { 'th-first': { workflowId: 'wf-first' } }
        )
        renderWithSelectedTarget()
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.showChatHistory')
          })
        )
        await userEvent.click(await screen.findByText('First chat'))
        await vi.waitFor(() =>
          expect(userPrompts()).toEqual(['Prompt in th-first'])
        )
        const composer = useAgentComposerStore()
        fill(composer)
        const before = drafted(composer)

        await activateTabAsUser(second)
        await settleFollow()

        expect(loadedThreads).toEqual(['th-first'])
        expect(useAgentConversationStore().threadId).toBe('th-first')
        expect(userPrompts()).toEqual(['Prompt in th-first'])
        expect(drafted(composer)).toEqual(before)
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(first.path)
        expect(screen.getByRole('note')).toHaveTextContent(
          i18n.global.t('agent.viewingDifferentWorkflow')
        )

        clear(composer)
        await settleFollow()
        expect(loadedThreads).toEqual(['th-first'])
      }
    )

    it('sends a pinned draft to its original chat and workflow while another tab is active', async () => {
      const firstState = fromPartial<ComfyWorkflowJSON>({
        nodes: [{ id: 17, type: 'FirstWorkflowNode' }],
        links: []
      })
      const first = addTab('workflows/first.json', { activeState: firstState })
      const second = addTab('workflows/second.json', {
        activeState: fromPartial<ComfyWorkflowJSON>({
          nodes: [{ id: 83, type: 'SecondWorkflowNode' }],
          links: []
        })
      })
      workflowStore.activeWorkflow = first
      stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-first',
            title: 'First chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-first'
          }),
          agentThread({
            id: 'th-second',
            title: 'Second chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          })
        ],
        { 'th-first': { workflowId: 'wf-first' } }
      )
      respondToFetch(/\/assets(?:\?|$)/, () =>
        json(200, { assets: [], total: 0, has_more: false })
      )
      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('First chat'))
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-first'])
      )
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('Keep this request on the first workflow')

      await activateTabAsUser(second)
      await settleFollow()
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(first.path)
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      await vi.waitFor(() =>
        expect(
          fetchRequests({ method: 'POST', url: /\/messages$/ })
        ).toHaveLength(1)
      )
      const [request] = fetchRequests({ method: 'POST', url: /\/messages$/ })
      expect(request.url).toBe('/api/agent/threads/th-first/messages')
      expect(JSON.parse(String(request.body))).toMatchObject({
        content: 'Keep this request on the first workflow',
        workflow_id: 'wf-first',
        draft: { content: firstState }
      })
      expect(useAgentConversationStore().threadId).toBe('th-first')
      expect(workflowStore.activeWorkflow.path).toBe(second.path)
      expect(useAgentComposerStore().draft).toBe('')
    })

    it('switches past a whitespace-only draft and clears it', async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      renderWithSelectedTarget()
      const composer = useAgentComposerStore()
      composer.setText('  \n ')

      await activateTabAsUser(second)

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-second')
      )
      expect(composer.draft).toBe('')
    })

    it("opens the tab's chat from an empty chat that was never sent", async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      await activateTabAsUser(second)

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-second')
      )
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
    })

    it.for([
      {
        outcome: 'succeeds',
        titleSource: 'existing chat',
        response: async () => transcriptFor('th-second', 'wf-second'),
        expectedThreadId: 'th-second',
        expectedTitle: 'Second chat',
        showsFailure: false
      },
      {
        outcome: 'fails',
        titleSource: 'unsent chat',
        response: async () => json(500, { error: 'unavailable' }),
        expectedThreadId: null,
        expectedTitle: 'Duck storyboard',
        showsFailure: true
      }
    ])(
      'keeps the $titleSource title when following from a renamed unsent chat $outcome',
      async ({ response, expectedThreadId, expectedTitle, showsFailure }) => {
        workflowStore.activeWorkflow = addTab('workflows/first.json')
        const second = addTab('workflows/second.json')
        const { loadedThreads } = stubWorkflowBoundHistory(
          [
            agentThread({
              id: 'th-second',
              title: 'Second chat',
              last_message_at: '2026-09-22T10:00:00Z',
              workflow_id: 'wf-second'
            })
          ],
          { 'th-second': { response } }
        )
        respondToFetch(/\/assets(?:\?|$)/, () =>
          json(200, { assets: [], total: 0, has_more: false })
        )
        render(AgentPanelRoot, { global: { plugins: [i18n] } })
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.newChatTitle')
          })
        )
        const renameInput = await screen.findByRole('textbox', {
          name: i18n.global.t('g.rename')
        })
        await userEvent.type(renameInput, 'Duck storyboard{Enter}')
        expect(
          screen.getByRole('button', { name: 'Duck storyboard' })
        ).toBeVisible()

        await activateTabAsUser(second)

        await vi.waitFor(() => expect(loadedThreads).toEqual(['th-second']))
        await waitFor(() =>
          expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
            'inert'
          )
        )
        expect(useAgentConversationStore().threadId).toBe(expectedThreadId)
        expect(useAgentChatHistoryStore().titleFor('th-second')).toBeUndefined()
        expect(
          screen.getByRole('button', { name: expectedTitle })
        ).toBeVisible()
        expect(screen.queryByText(followFailure()) !== null).toBe(showsFailure)
      }
    )

    it('moves the target of a drafted chat that was never sent instead of switching', async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const { loadedThreads } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      useAgentComposerStore().setText('make it blue')

      await activateTabAsUser(second)
      await settleFollow()

      expect(loadedThreads).toEqual([])
      expect(useAgentConversationStore().threadId).toBeNull()
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
      expect(useAgentComposerStore().draft).toBe('make it blue')
    })

    it('re-lists chats without waiting for another workflow lookup when the tab id is known', async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const { listCalls } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      await settleFollow()
      const listedBefore = listCalls()
      respondToFetch(
        /\/api\/workflows(?:\?|$)/,
        () => new Promise<Response>(() => {})
      )

      workflowStore.activeWorkflow = second
      workflowStore.reportUserActivation(second)

      await screen.findByRole('button', { name: 'Prompt in th-second' })
      expect(listCalls()).toBe(listedBefore + 1)
    })

    it('does not re-list chats for a saved tab that has no cloud workflow', async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const unlisted = addTab('workflows/fourth.json')
      const { listCalls, loadedThreads } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-first',
          title: 'First chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-first'
        })
      ])
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      const listedBefore = listCalls()

      await activateTabAsUser(unlisted)
      await settleFollow()

      expect(listCalls()).toBe(listedBefore)
      expect(loadedThreads).toEqual([])
    })

    it('does not follow a tab the app activates on its own, like a restored or linked workflow', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const third = addTab('workflows/third.json')
      workflowStore.activeWorkflow = third
      const { loadedThreads } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-first',
          title: 'First chat',
          last_message_at: '2026-09-22T08:00:00Z',
          workflow_id: 'wf-first'
        }),
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T09:00:00Z',
          workflow_id: 'wf-second'
        }),
        agentThread({
          id: 'th-third',
          title: 'Third chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-third'
        })
      ])
      renderWithSelectedTarget()
      await activateTabAsUser(first)
      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-first')
      )

      await useWorkflowService().openWorkflow(second)
      await activateTabAsUser(third)

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-third')
      )
      expect(loadedThreads).toEqual(['th-first', 'th-third'])
    })

    it('does not follow a temporary tab, including one the agent created', async () => {
      const first = addTab('workflows/first.json')
      const scratch = addTab('workflows/second.json', { isTemporary: true })
      workflowStore.activeWorkflow = first
      useAgentWorkflowTabBindingStore().bind('wf-second', scratch.path)
      const { loadedThreads } = stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )

      await activateTabAsUser(scratch)

      await settleFollow()
      expect(loadedThreads).not.toContain('th-second')
      expect(useAgentConversationStore().threadId).toBeNull()
    })

    it('lands the chat of the last activated tab when activations overlap', async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const third = addTab('workflows/third.json')
      let answerSecond!: () => void
      let answerThird!: () => void
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-second',
            title: 'Second chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-second'
          }),
          agentThread({
            id: 'th-third',
            title: 'Third chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-third'
          })
        ],
        {
          'th-second': {
            response: () =>
              new Promise<Response>((resolve) => {
                answerSecond = () => resolve(json(200, []))
              })
          },
          'th-third': {
            response: () =>
              new Promise<Response>((resolve) => {
                answerThird = () =>
                  resolve(transcriptFor('th-third', 'wf-third'))
              })
          }
        }
      )
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(2)
      )

      await activateTabAsUser(second)
      await vi.waitFor(() => expect(loadedThreads).toEqual(['th-second']))
      expect(
        await screen.findByRole('status', {
          name: i18n.global.t('agent.openingWorkflowChat', {
            workflowName: 'second'
          })
        })
      ).toBeVisible()
      await activateTabAsUser(third)
      expect(
        await screen.findByRole('status', {
          name: i18n.global.t('agent.openingWorkflowChat', {
            workflowName: 'third'
          })
        })
      ).toBeVisible()
      await vi.waitFor(() =>
        expect(loadedThreads).toEqual(['th-second', 'th-third'])
      )
      answerSecond()
      await settleFollow()

      expect(
        screen.getByRole('status', {
          name: i18n.global.t('agent.openingWorkflowChat', {
            workflowName: 'third'
          })
        })
      ).toBeVisible()
      expect(screen.getByTestId('agent-panel-footer')).toHaveAttribute('inert')
      answerThird()
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-third'])
      )

      expect(useAgentConversationStore().threadId).toBe('th-third')
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(third.path)
      expect(loadedThreads).toEqual(['th-second', 'th-third'])
    })

    it.for([
      {
        outcome: 'succeeds',
        answer: () => transcriptFor('th-second', 'wf-second')
      },
      {
        outcome: 'fails',
        answer: () => json(500, { error: 'unavailable' })
      }
    ])(
      'keeps the original chat unlocked when pending second-tab messages $outcome after returning to first',
      async ({ answer }) => {
        const first = addTab('workflows/first.json')
        const second = addTab('workflows/second.json')
        workflowStore.activeWorkflow = first
        let answerSecond!: () => void
        const secondMessages = new Promise<Response>((resolve) => {
          answerSecond = () => resolve(answer())
        })
        const { loadedThreads } = stubWorkflowBoundHistory(
          [
            agentThread({
              id: 'th-first',
              title: 'First chat',
              last_message_at: '2026-09-22T09:00:00Z',
              workflow_id: 'wf-first'
            }),
            agentThread({
              id: 'th-second',
              title: 'Second chat',
              last_message_at: '2026-09-22T10:00:00Z',
              workflow_id: 'wf-second'
            })
          ],
          {
            'th-first': { workflowId: 'wf-first' },
            'th-second': { response: () => secondMessages }
          }
        )
        renderWithSelectedTarget()
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.showChatHistory')
          })
        )
        await userEvent.click(await screen.findByText('First chat'))
        await vi.waitFor(() =>
          expect(userPrompts()).toEqual(['Prompt in th-first'])
        )

        await activateTabAsUser(second)
        await vi.waitFor(() =>
          expect(loadedThreads).toEqual(['th-first', 'th-second'])
        )
        expect(
          await screen.findByRole('status', {
            name: i18n.global.t('agent.openingWorkflowChat', {
              workflowName: 'second'
            })
          })
        ).toBeVisible()
        await activateTabAsUser(first)
        await waitFor(() =>
          expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
            'inert'
          )
        )
        expect(useAgentConversationStore().threadId).toBe('th-first')
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(first.path)

        answerSecond()
        await settleFollow()

        expect(workflowStore.activeWorkflow.path).toBe(first.path)
        expect(useAgentConversationStore().threadId).toBe('th-first')
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(first.path)
        expect(userPrompts()).toEqual(['Prompt in th-first'])
        expect(screen.queryByRole('status')).toBeNull()
        expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
          'inert'
        )
        expect(screen.getByRole('textbox')).toHaveTextContent(/^$/)
        expect(screen.queryByText(followFailure())).toBeNull()
        expect(loadedThreads).toEqual(['th-first', 'th-second'])
      }
    )

    async function openFirstChatThenLoseTranscripts(): Promise<{
      loadedThreads: string[]
      restoreTranscripts: () => void
    }> {
      const first = addTab('workflows/first.json')
      addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      let transcriptsUp = true
      const answer = (threadId: string, workflowId?: string) => async () =>
        transcriptsUp
          ? transcriptFor(threadId, workflowId)
          : json(500, { error: 'unavailable' })
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-first',
            title: 'First chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-first'
          }),
          agentThread({
            id: 'th-second',
            title: 'Second chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          })
        ],
        {
          'th-first': { response: answer('th-first', 'wf-first') },
          'th-second': { response: answer('th-second') }
        }
      )
      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('First chat'))
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-first'])
      )
      transcriptsUp = false
      return { loadedThreads, restoreTranscripts: () => (transcriptsUp = true) }
    }

    const followFailure = () =>
      i18n.global.t('agent.followedChatOpenFailed', { workflowName: 'second' })

    const cachedSecondThread = agentThread({
      id: 'th-second',
      title: 'Second chat',
      last_message_at: '2026-09-22T10:00:00Z',
      workflow_id: 'wf-second'
    })
    const failedFollowListing = () => json(500, { error: 'unavailable' })
    const incompleteFollowListing = () =>
      json(200, agentThreadList([], { has_more: true }))

    async function openFirstChatWithHistory(threads: AgentThreadSummary[]) {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-first',
            title: 'First chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-first'
          }),
          ...threads
        ],
        { 'th-first': { workflowId: 'wf-first' } }
      )
      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('First chat'))
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-first'])
      )
      await settleFollow()
      return { first, second, loadedThreads }
    }

    it.for([
      {
        listing: 'failed',
        cached: 'an old matching chat',
        threads: [cachedSecondThread],
        answer: failedFollowListing
      },
      {
        listing: 'incomplete',
        cached: 'an old matching chat',
        threads: [cachedSecondThread],
        answer: incompleteFollowListing
      },
      {
        listing: 'failed',
        cached: 'no matching chat',
        threads: [],
        answer: failedFollowListing
      },
      {
        listing: 'incomplete',
        cached: 'no matching chat',
        threads: [],
        answer: incompleteFollowListing
      }
    ])(
      'keeps the current chat after a $listing follow listing with $cached cached, then retries the newest chat',
      async ({ threads, answer }) => {
        const { first, second, loadedThreads } =
          await openFirstChatWithHistory(threads)
        respondToFetch(threadListRoute, answer)

        await activateTabAsUser(second)
        await settleFollow()

        expect(useAgentConversationStore().threadId).toBe('th-first')
        expect(userPrompts()).toEqual(['Prompt in th-first'])
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(first.path)
        expect(workflowStore.activeWorkflow?.path).toBe(second.path)
        expect(loadedThreads).toEqual(['th-first'])
        expect(await screen.findByText(followFailure())).toBeVisible()
        expect(screen.queryByRole('status')).toBeNull()
        expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
          'inert'
        )
        expect(executionErrors.recordPromptError).not.toHaveBeenCalled()
        expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()

        respondToFetch(threadListRoute, () =>
          json(
            200,
            agentThreadList([
              cachedSecondThread,
              agentThread({
                id: 'th-newest',
                title: 'Newest chat',
                last_message_at: '2026-09-22T11:00:00Z',
                workflow_id: 'wf-second'
              })
            ])
          )
        )
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.retryFollowedChat', {
              workflowName: 'second'
            })
          })
        )

        await vi.waitFor(() =>
          expect(useAgentConversationStore().threadId).toBe('th-newest')
        )
        expect(userPrompts()).toEqual(['Prompt in th-newest'])
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
        expect(loadedThreads).toEqual(['th-first', 'th-newest'])
        expect(screen.queryByText(followFailure())).toBeNull()
      }
    )

    it.for([
      {
        listing: 'failed',
        cancel: 'returning to the original tab',
        answer: failedFollowListing,
        retire: activateTabAsUser
      },
      {
        listing: 'incomplete',
        cancel: 'starting a draft',
        answer: incompleteFollowListing,
        retire: async () => useAgentComposerStore().setText('Keep this chat')
      },
      {
        listing: 'complete',
        cancel: 'returning to the original tab',
        answer: () => json(200, agentThreadList([cachedSecondThread])),
        retire: activateTabAsUser
      }
    ])(
      'ignores a late $listing follow listing after $cancel',
      async ({ answer, retire }) => {
        const { first, second, loadedThreads } = await openFirstChatWithHistory(
          [cachedSecondThread]
        )
        let answerList!: () => void
        const listing = new Promise<Response>((resolve) => {
          answerList = () => resolve(answer())
        })
        respondToFetch(threadListRoute, () => listing)

        await activateTabAsUser(second)
        expect(
          await screen.findByRole('status', {
            name: i18n.global.t('agent.openingWorkflowChat', {
              workflowName: 'second'
            })
          })
        ).toBeVisible()
        await retire(first)
        answerList()
        await settleFollow()

        expect(useAgentConversationStore().threadId).toBe('th-first')
        expect(userPrompts()).toEqual(['Prompt in th-first'])
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(first.path)
        expect(loadedThreads).toEqual(['th-first'])
        expect(screen.queryByText(followFailure())).toBeNull()
        expect(screen.queryByRole('status')).toBeNull()
        expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
          'inert'
        )
        expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
      }
    )

    it('keeps the current conversation covered until the followed chat is ready', async () => {
      await openFirstChatThenLoseTranscripts()
      const second = workflowStore.getWorkflowByPath('workflows/second.json')
      assert(second)
      const serve = vi.mocked(fetch).getMockImplementation()
      assert(serve)
      let answerList!: () => void
      const listing = new Promise<Response>((resolve) => {
        answerList = () =>
          resolve(
            json(
              200,
              agentThreadList([
                agentThread({
                  id: 'th-second',
                  title: 'Second chat',
                  last_message_at: '2026-09-22T10:00:00Z',
                  workflow_id: 'wf-second'
                })
              ])
            )
          )
      })
      let answerMessages!: () => void
      const transcript = new Promise<Response>((resolve) => {
        answerMessages = () => resolve(transcriptFor('th-second', 'wf-second'))
      })
      let markMessagesRequested!: () => void
      const messagesRequested = new Promise<void>((resolve) => {
        markMessagesRequested = resolve
      })
      vi.mocked(fetch).mockImplementation((input, init) => {
        if (threadListRoute.test(String(input))) return listing
        if (String(input).endsWith('/threads/th-second/messages')) {
          markMessagesRequested()
          return transcript
        }
        return serve(input, init)
      })

      await activateTabAsUser(second)

      expect(screen.getByTestId('agent-panel-footer')).toHaveAttribute('inert')
      expect(
        await screen.findByRole('status', {
          name: i18n.global.t('agent.openingWorkflowChat', {
            workflowName: 'second'
          })
        })
      ).toBeVisible()
      expect(
        within(screen.getByTestId('agent-conversation')).getByText(
          'Prompt in th-first'
        )
      ).toBeInTheDocument()

      answerList()
      await messagesRequested

      expect(
        screen.getByRole('status', {
          name: i18n.global.t('agent.openingWorkflowChat', {
            workflowName: 'second'
          })
        })
      ).toBeVisible()
      expect(userPrompts()).toEqual(['Prompt in th-first'])

      answerMessages()
      await within(screen.getByTestId('agent-conversation')).findByText(
        'Prompt in th-second'
      )

      await vi.waitFor(() =>
        expect(
          screen.queryByRole('status', {
            name: i18n.global.t('agent.openingWorkflowChat', {
              workflowName: 'second'
            })
          })
        ).toBeNull()
      )
      expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
        'inert'
      )
    })

    it('reports a followed chat that fails to open only in its notice', async () => {
      await openFirstChatThenLoseTranscripts()
      const second = workflowStore.getWorkflowByPath('workflows/second.json')
      assert(second)

      await activateTabAsUser(second)

      expect(await screen.findByText(followFailure())).toBeVisible()
      expect(executionErrors.recordPromptError).not.toHaveBeenCalled()
      expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    })

    it.for([
      { followList: 'still loading', overlays: 1 },
      { followList: 'already shown', overlays: 0 }
    ])(
      'shows $overlays overlay for a failed history load while the follow list is $followList',
      async ({ followList, overlays }) => {
        workflowStore.activeWorkflow = addTab('workflows/first.json')
        const second = addTab('workflows/second.json')
        let failMountList!: () => void
        const mountList = new Promise<Response>((resolve) => {
          failMountList = () => resolve(json(500, { error: 'unavailable' }))
        })
        const lists =
          followList === 'still loading'
            ? [mountList, new Promise<Response>(() => {})]
            : [mountList]
        stubWorkflowBoundHistory([
          agentThread({
            id: 'th-second',
            title: 'Second chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          })
        ])
        const served = vi.mocked(fetch).getMockImplementation()
        assert(served)
        let listRequests = 0
        vi.mocked(fetch).mockImplementation((input, init) => {
          if (!threadListRoute.test(String(input))) return served(input, init)
          listRequests += 1
          return lists.splice(0, 1)[0] ?? served(input, init)
        })
        renderWithSelectedTarget()

        await activateTabAsUser(second)
        await vi.waitFor(() => expect(listRequests).toBe(2))
        await settleFollow()
        failMountList()
        await settleFollow()

        expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(overlays)
      }
    )

    it('keeps the open chat untouched when the followed chat fails to open, and retries', async () => {
      const { loadedThreads, restoreTranscripts } =
        await openFirstChatThenLoseTranscripts()
      const second = workflowStore.getWorkflowByPath('workflows/second.json')
      assert(second)

      await activateTabAsUser(second)

      expect(await screen.findByText(followFailure())).toBeVisible()
      expect(userPrompts()).toEqual(['Prompt in th-first'])
      expect(useAgentConversationStore().threadId).toBe('th-first')
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(
        'workflows/first.json'
      )
      expect(workflowStore.activeWorkflow?.path).toBe(second.path)
      expect(loadedThreads).toEqual(['th-first', 'th-second'])

      restoreTranscripts()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.retryFollowedChat', {
            workflowName: 'second'
          })
        })
      )

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-second')
      )
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
      expect(screen.queryByText(followFailure())).toBeNull()
    })

    it('drops the follow failure notice once the user sends in the open chat', async () => {
      await openFirstChatThenLoseTranscripts()
      const second = workflowStore.getWorkflowByPath('workflows/second.json')
      assert(second)
      await activateTabAsUser(second)
      expect(await screen.findByText(followFailure())).toBeVisible()

      await sendFromComposer('keep going here')

      expect(screen.queryByText(followFailure())).toBeNull()
      expect(useAgentConversationStore().threadId).toBe('th-first')
    })

    it('holds the follow back while a message is still being sent', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-second',
            title: 'Second chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          })
        ],
        {},
        { post: () => new Promise<Response>(() => {}) }
      )
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      await sendFromComposer('make it blue')

      await activateTabAsUser(second)
      await settleFollow()

      expect(loadedThreads).toEqual([])
      expect(useAgentComposerStore().submission?.phase).toBe('pending')
    })

    it('follows while a sent message runs once the server has accepted it', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      await sendFromComposer('make it blue')
      await vi.waitFor(() =>
        expect(useAgentComposerStore().submission).toBeNull()
      )
      expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible()

      await activateTabAsUser(second)

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-second')
      )
    })

    it("opens the active tab's chat on mount when the target is another tab", async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = second
      useAgentPanelStore().setWorkflowTarget(first)
      stubWorkflowBoundHistory([
        agentThread({
          id: 'th-second',
          title: 'Second chat',
          last_message_at: '2026-09-22T10:00:00Z',
          workflow_id: 'wf-second'
        })
      ])

      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-second')
      )
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
    })

    it('keeps a chat picked in Chat history when restoring it opens its tab', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-newest',
            title: 'Newest chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          }),
          agentThread({
            id: 'th-picked',
            title: 'Picked chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-second'
          })
        ],
        { 'th-picked': { workflowId: 'wf-second' } }
      )

      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Picked chat'))
      await vi.waitFor(() =>
        expect(workflowStore.activeWorkflow?.path).toBe(second.path)
      )

      await settleFollow()
      expect(useAgentConversationStore().threadId).toBe('th-picked')
      expect(loadedThreads).toEqual(['th-picked'])
    })

    it('keeps the open chat when Show target opens its tab', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-newest',
            title: 'Newest chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-first'
          }),
          agentThread({
            id: 'th-open',
            title: 'Open chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-first'
          })
        ],
        { 'th-open': { workflowId: 'wf-first' } }
      )
      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Open chat'))
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-open'])
      )
      await activateTabAsUser(second)

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Show target workflow: first'
        })
      )
      await vi.waitFor(() =>
        expect(workflowStore.activeWorkflow?.path).toBe(first.path)
      )

      await settleFollow()
      expect(loadedThreads).not.toContain('th-newest')
      expect(useAgentConversationStore().threadId).toBe('th-open')
    })

    it('keeps the user on the activated tab when the followed chat last ran on another', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      workflowStore.activeWorkflow = first
      stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-second',
            title: 'Second chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          })
        ],
        { 'th-second': { workflowId: 'wf-first' } }
      )

      renderWithSelectedTarget()
      await activateTabAsUser(second)
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-second'])
      )
      await settleFollow()

      expect(workflowStore.activeWorkflow.path).toBe(second.path)
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(second.path)
      expect(useAgentConversationStore().threadId).toBe('th-second')
    })

    it("opens the tab's newest chat when it started after the list loaded", async () => {
      workflowStore.activeWorkflow = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const threads = [
        agentThread({
          id: 'th-old',
          title: 'Old chat',
          last_message_at: '2026-09-22T09:00:00Z',
          workflow_id: 'wf-second'
        })
      ]
      const { loadedThreads } = stubWorkflowBoundHistory(threads)
      renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
      )
      threads.push(
        agentThread({
          id: 'th-new',
          title: 'New chat',
          last_message_at: '2026-09-22T11:00:00Z',
          workflow_id: 'wf-second'
        })
      )

      await activateTabAsUser(second)

      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-new')
      )
      expect(loadedThreads).toEqual(['th-new'])
    })

    it.for([
      {
        stamps: 'no message time but a newer update time',
        last_message_at: '',
        updated_at: '2026-09-22T11:00:00Z',
        created_at: '2026-09-01T09:00:00Z',
        expectedThreadId: 'th-fallback'
      },
      {
        stamps: 'no valid message or update time but a newer creation time',
        last_message_at: 'yesterday',
        updated_at: 'unknown',
        created_at: '2026-09-22T11:00:00Z',
        expectedThreadId: 'th-fallback'
      },
      {
        stamps: 'no valid time at all',
        last_message_at: '',
        updated_at: 'unknown',
        created_at: '',
        expectedThreadId: 'th-recent'
      }
    ])(
      'ranks a chat with $stamps by its next valid time',
      async ({ last_message_at, updated_at, created_at, expectedThreadId }) => {
        workflowStore.activeWorkflow = addTab('workflows/first.json')
        const second = addTab('workflows/second.json')
        const { loadedThreads } = stubWorkflowBoundHistory([
          agentThread({
            id: 'th-fallback',
            title: 'Fallback chat',
            last_message_at,
            updated_at,
            created_at,
            workflow_id: 'wf-second'
          }),
          agentThread({
            id: 'th-recent',
            title: 'Recent chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-second'
          })
        ])
        renderWithSelectedTarget()

        await activateTabAsUser(second)

        await vi.waitFor(() =>
          expect(useAgentConversationStore().threadId).toBe(expectedThreadId)
        )
        expect(loadedThreads).toEqual([expectedThreadId])
      }
    )

    it('keeps the open chat when the user returns to the tab it targets', async () => {
      const first = addTab('workflows/first.json')
      const second = addTab('workflows/second.json')
      const third = addTab('workflows/third.json')
      workflowStore.activeWorkflow = first
      const { loadedThreads } = stubWorkflowBoundHistory(
        [
          agentThread({
            id: 'th-newer',
            title: 'Newer chat',
            last_message_at: '2026-09-22T10:00:00Z',
            workflow_id: 'wf-first'
          }),
          agentThread({
            id: 'th-older',
            title: 'Older chat',
            last_message_at: '2026-09-22T09:00:00Z',
            workflow_id: 'wf-first'
          }),
          agentThread({
            id: 'th-third',
            title: 'Third chat',
            last_message_at: '2026-09-22T08:00:00Z',
            workflow_id: 'wf-third'
          })
        ],
        { 'th-older': { workflowId: 'wf-first' } }
      )
      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Older chat'))
      await vi.waitFor(() =>
        expect(userPrompts()).toEqual(['Prompt in th-older'])
      )

      await activateTabAsUser(second)
      await activateTabAsUser(first)
      await settleFollow()

      expect(useAgentConversationStore().threadId).toBe('th-older')
      expect(loadedThreads).toEqual(['th-older'])

      await activateTabAsUser(third)
      await vi.waitFor(() =>
        expect(useAgentConversationStore().threadId).toBe('th-third')
      )
      expect(loadedThreads).toEqual(['th-older', 'th-third'])
    })
    it.for([
      { outcome: 'opens', answer: () => json(200, []) },
      {
        outcome: 'fails',
        answer: () => json(500, { error: 'unavailable' })
      }
    ])(
      'leaves the user on a later tab when an earlier follow $outcome',
      async ({ answer }) => {
        workflowStore.activeWorkflow = addTab('workflows/first.json')
        const second = addTab('workflows/second.json')
        const scratch = addTab('workflows/scratch.json', { isTemporary: true })
        let answerSecond!: () => void
        const { loadedThreads } = stubWorkflowBoundHistory(
          [
            agentThread({
              id: 'th-second',
              title: 'Second chat',
              last_message_at: '2026-09-22T10:00:00Z',
              workflow_id: 'wf-second'
            })
          ],
          {
            'th-second': {
              response: () =>
                new Promise<Response>((resolve) => {
                  answerSecond = () => resolve(answer())
                })
            }
          }
        )
        renderWithSelectedTarget()
        await activateTabAsUser(second)
        await vi.waitFor(() => expect(loadedThreads).toEqual(['th-second']))

        await activateTabAsUser(scratch)
        answerSecond()
        await settleFollow()

        expect(workflowStore.activeWorkflow.path).toBe(scratch.path)
        expect(useAgentConversationStore().threadId).toBeNull()
        expect(
          screen.queryByText(
            i18n.global.t('agent.followedChatOpenFailed', {
              workflowName: 'second'
            })
          )
        ).toBeNull()
      }
    )
  })

  describe('history row title for the active chat', () => {
    function stubActiveThread(serverTitle: string): void {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (threadListRoute.test(url))
          return json(
            200,
            agentThreadList([
              agentThread({
                id: 'th-active',
                title: serverTitle,
                preview: 'delete everything on this canvas',
                last_message_at: '2026-07-07T10:00:00Z'
              })
            ])
          )
        if (url.includes('/messages'))
          return json(200, [
            {
              id: 'active-user',
              thread_id: 'th-active',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'active-turn',
              content: { text: 'Clear entire canvas' }
            }
          ])
        return json(200, [])
      })
      useAgentConversationStore().setThreadId('th-active')
    }

    it('shows the first user message while the server title is empty', async () => {
      stubActiveThread('')
      renderWithSelectedTarget()
      await screen.findByRole('button', { name: 'Clear entire canvas' })

      await openHistory()

      expect(
        await screen.findByRole('button', { name: 'Clear entire canvas' })
      ).toBeInTheDocument()
      expect(
        screen.queryByText('delete everything on this canvas')
      ).not.toBeInTheDocument()
    })

    it('keeps the server title when one exists', async () => {
      stubActiveThread('Canvas cleanup')
      renderWithSelectedTarget()
      await screen.findByRole('button', { name: 'Clear entire canvas' })

      await openHistory()

      expect(
        await screen.findByRole('button', { name: 'Canvas cleanup' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Clear entire canvas' })
      ).not.toBeInTheDocument()
    })
  })

  it('surfaces a thread-list failure via the host error modal', async () => {
    executionErrors.showErrorOverlay.mockClear()
    telemetry.trackAgentError.mockClear()
    vi.mocked(fetch).mockImplementation(
      async () => new Response('{}', { status: 500 })
    )

    renderWithSelectedTarget()

    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    )
    expect(executionErrors.lastPromptError).toMatchObject({
      type: 'agent_api_failed'
    })
    expect(telemetry.trackAgentError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_class: 'thread_list_load_failed',
        failure_stage: 'pre_acceptance',
        retryable: true,
        turn_accepted: false,
        ui_treatment: 'error_overlay'
      })
    )
    expect(useAgentChatHistoryStore().sessions).toHaveLength(0)
  })

  it('keeps the loaded chat list and reports a non-retryable failure when a refresh ends before its last page', async () => {
    respondToFetch(threadListRoute, () =>
      json(
        200,
        agentThreadList([
          agentThread({
            id: 'th-kept',
            title: 'Kept chat',
            last_message_at: '2026-07-07T10:00:00Z'
          })
        ])
      )
    )
    renderWithSelectedTarget()
    const history = useAgentChatHistoryStore()
    await vi.waitFor(() =>
      expect(history.sessions.map(({ id }) => id)).toEqual(['th-kept'])
    )
    respondToFetch(threadListRoute, () =>
      json(
        200,
        agentThreadList(
          [
            agentThread({
              id: 'th-partial',
              title: 'Partial chat',
              last_message_at: '2026-07-07T11:00:00Z'
            })
          ],
          { has_more: true }
        )
      )
    )

    await openHistory()

    await vi.waitFor(() =>
      expect(executionErrors.showErrorOverlay).toHaveBeenCalledTimes(1)
    )
    expect(telemetry.trackAgentError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_class: 'thread_list_load_failed',
        retryable: false
      })
    )
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agent thread list ended before its last page'
      }),
      expect.objectContaining({ tags: { reason: 'missing_cursor' } })
    )
    expect(history.sessions.map(({ id }) => id)).toEqual(['th-kept'])
  })

  const staleRefreshOutcomes = [
    {
      outcome: 'a list',
      staleResponse: () =>
        json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-stale',
              title: 'Stale chat',
              last_message_at: '2026-07-07T09:00:00Z'
            })
          ])
        )
    },
    { outcome: 'a failure', staleResponse: () => json(500, {}) }
  ]

  it.for(staleRefreshOutcomes)(
    'ignores a closed panel history refresh that ends with $outcome after the panel reopens',
    async ({ staleResponse }) => {
      const secondPageRoute = /\/api\/agent\/threads\?.*after=page-2/
      let resolveStale!: (response: Response) => void
      const staleSecondPage = new Promise<Response>((resolve) => {
        resolveStale = resolve
      })
      respondToFetch(threadListRoute, () =>
        json(
          200,
          agentThreadList(
            [
              agentThread({
                id: 'th-old',
                title: 'Old chat',
                last_message_at: '2026-07-07T08:00:00Z'
              })
            ],
            { has_more: true, next_cursor: 'page-2' }
          )
        )
      )
      respondToFetch(secondPageRoute, () => staleSecondPage, { times: 1 })
      const closedPanel = renderWithSelectedTarget()
      await vi.waitFor(() =>
        expect(fetchRequests(secondPageRoute)).toHaveLength(1)
      )
      closedPanel.unmount()
      const secondPageInit = vi
        .mocked(fetch)
        .mock.calls.find(([input]) => secondPageRoute.test(String(input)))?.[1]
      expect(secondPageInit?.signal?.aborted).toBe(true)
      respondToFetch(threadListRoute, () =>
        json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-new',
              title: 'New chat',
              last_message_at: '2026-07-07T10:00:00Z'
            })
          ])
        )
      )
      renderWithSelectedTarget()
      const history = useAgentChatHistoryStore()
      await vi.waitFor(() =>
        expect(history.sessions.map(({ id }) => id)).toEqual(['th-new'])
      )

      const stale = staleResponse()
      resolveStale(stale)
      await vi.waitFor(() => expect(stale.bodyUsed).toBe(true))

      expect(history.sessions.map(({ id }) => id)).toEqual(['th-new'])
      expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
    }
  )

  it('does not refresh chat history once the panel closes while a picked chat loads', async () => {
    const pickedMessagesRoute = /\/th-picked\/messages/
    let resolveMessages!: (response: Response) => void
    const pickedMessages = new Promise<Response>((resolve) => {
      resolveMessages = resolve
    })
    respondToFetch(threadListRoute, () =>
      json(
        200,
        agentThreadList([
          agentThread({
            id: 'th-picked',
            title: 'Picked chat',
            last_message_at: '2026-07-07T10:00:00Z'
          })
        ])
      )
    )
    respondToFetch(pickedMessagesRoute, () => pickedMessages, { times: 1 })
    const panel = renderWithSelectedTarget()
    await openHistory()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Picked chat' })
    )
    await vi.waitFor(() =>
      expect(fetchRequests(pickedMessagesRoute)).toHaveLength(1)
    )
    const listRequestsBeforeClose = fetchRequests(threadListRoute).length
    panel.unmount()

    const messages = json(200, [])
    resolveMessages(messages)
    await vi.waitFor(() => expect(messages.bodyUsed).toBe(true))

    expect(fetchRequests(threadListRoute)).toHaveLength(listRequestsBeforeClose)
    expect(executionErrors.showErrorOverlay).not.toHaveBeenCalled()
  })

  it('marks the restored thread as the current session', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      return threadListRoute.test(url)
        ? new Response(JSON.stringify(agentThreadList()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        : new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
    })
    const convo = useAgentConversationStore()
    convo.setThreadId('th-active')
    renderWithSelectedTarget()

    const history = useAgentChatHistoryStore()
    await vi.waitFor(() => expect(history.activeId).toBe('th-active'))
  })
})

describe('AgentPanelRoot transcript copy', () => {
  beforeEach(() => {
    clipboard.copy.mockClear()
  })

  it.for(['current', 'pending'])(
    'copies only the current transcript when the loaded transcript is %s',
    async (loaded) => {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)
        return threadListRoute.test(url)
          ? new Response(
              JSON.stringify(
                agentThreadList([
                  agentThread({
                    id: 'th-1',
                    title: 'make a cat',
                    last_message_at: '2026-07-07T10:00:00Z'
                  })
                ])
              ),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          : new Response('[]', { status: 200 })
      })

      renderWithSelectedTarget()
      const convo = useAgentConversationStore()
      const turnId = 'turn-1' as TurnId
      convo.setThreadId('th-1')
      useAgentChatHistoryStore().setActive('th-1')
      convo.recordUser(
        turnId,
        'make a cat with ',
        [{ name: 'brief.txt', ref: 'brief.txt' }],
        ['KSampler #12'],
        [{ id: 'reference', name: 'Portrait', textOffset: 16 }]
      )
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
      if (loaded === 'pending') convo.setThreadId('th-pending')

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

      if (loaded === 'current') {
        expect(clipboard.copy).toHaveBeenCalledWith(
          '**You:** make a cat with @[Workflow: Portrait]\n@[Node: KSampler #12]\n@[File: brief.txt]\n\n**Agent:** Here is a cat.'
        )
      } else {
        expect(clipboard.copy).not.toHaveBeenCalled()
        expect(useToast().toasts).toContainEqual(
          expect.objectContaining({
            title: i18n.global.t('agent.copyUnavailable')
          })
        )
      }
    }
  )
})

describe('AgentPanelRoot feedback capture', () => {
  beforeEach(() => {
    vi.mocked(useTelemetry())!.trackAgentMessageFeedback.mockClear()
  })

  it('forwards a thumbs vote to telemetry with the message id and vote', async () => {
    renderWithSelectedTarget()

    const store = useAgentConversationStore()
    const turnId = 'turn-9' as TurnId
    store.recordUser(turnId, 'make a cat')
    store.startTurn(turnId)
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_active_tab',
        data: {
          workflow_id: 'wf-rated',
          message_id: 'turn-9',
          thread_id: 'th'
        }
      })
    )
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
      [
        {
          message_id: 'turn-9',
          turn_id: 'turn-9',
          vote: 'up',
          workflow_id: 'wf-rated'
        }
      ],
      [
        {
          message_id: 'turn-9',
          turn_id: 'turn-9',
          vote: null,
          workflow_id: 'wf-rated'
        }
      ]
    ])
  })

  it('attributes the vote to the last tab the rated message linked', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const store = useAgentConversationStore()
    const turnId = 'turn-10' as TurnId
    store.recordUser(turnId, 'make two cats')
    store.startTurn(turnId)
    for (const workflowId of ['wf-first', 'wf-last']) {
      store.ingest(
        zAgentWsEventForTest({
          type: 'agent_active_tab',
          data: {
            workflow_id: workflowId,
            message_id: 'turn-10',
            thread_id: 'th'
          }
        })
      )
    }
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_delta',
        data: { delta: 'Two cats', message_id: 'turn-10', thread_id: 'th' }
      })
    )
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: 'turn-10', thread_id: 'th', usage: null }
      })
    )
    await nextTick()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Helpful' })
    )

    expect(telemetry.trackAgentMessageFeedback.mock.calls).toEqual([
      [
        {
          message_id: 'turn-10',
          turn_id: 'turn-10',
          vote: 'up',
          workflow_id: 'wf-last'
        }
      ]
    ])
  })

  it('reports a null workflow when the rated message never linked a tab', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    const store = useAgentConversationStore()
    const turnId = 'turn-11' as TurnId
    store.recordUser(turnId, 'hello')
    store.startTurn(turnId)
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_delta',
        data: { delta: 'Hi there', message_id: 'turn-11', thread_id: 'th' }
      })
    )
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_message_done',
        data: { message_id: 'turn-11', thread_id: 'th', usage: null }
      })
    )
    await nextTick()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Helpful' })
    )

    expect(telemetry.trackAgentMessageFeedback.mock.calls).toEqual([
      [
        {
          message_id: 'turn-11',
          turn_id: 'turn-11',
          vote: 'up',
          workflow_id: null
        }
      ]
    ])
  })
})

describe('AgentPanelRoot run approval telemetry', () => {
  it('keeps the timer for a terminal decision after workflow inspection', async () => {
    let resolveAnswer!: (response: Response) => void
    const answerResponse = new Promise<Response>((resolve) => {
      resolveAnswer = resolve
    })
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/asks/') && init?.method === 'POST')
          return answerResponse
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        if (url.includes('/workflows'))
          return json(200, {
            data: [],
            pagination: {
              offset: 0,
              limit: 100,
              total: 0,
              has_more: false
            }
          })
        return json(200, {})
      }
    )
    telemetry.trackAgentRunApprovalShown.mockClear()
    telemetry.trackAgentRunApprovalResolved.mockClear()
    let currentTime = 1_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    const workflow = addTab('workflows/Portrait workflow.json')
    workflowStore.activeWorkflow = workflow

    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const store = useAgentConversationStore()
    store.setThreadId('th-1')
    const turnId = 'turn-approval' as TurnId
    store.recordUser(turnId, 'run it')
    store.startTurn(turnId)
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_ask',
        data: {
          thread_id: 'th-1',
          message_id: turnId,
          ask_id: 'turn-approval:call-1',
          kind: 'run_approval',
          context: {
            workflow_id: 'workflow-1',
            workflow_name: 'Portrait workflow'
          },
          prompt: 'Run it?',
          options: [
            { id: 'run', label: 'Run' },
            { id: 'cancel', label: 'Cancel' }
          ],
          min_selections: 1,
          max_selections: 1,
          allow_other: false
        }
      })
    )

    expect(await screen.findByRole('button', { name: 'Run' })).toBeVisible()
    await nextTick()
    expect(
      telemetry.trackAgentRunApprovalShown
    ).toHaveBeenCalledExactlyOnceWith({
      turn_id: 'turn-approval',
      workflow_id: 'workflow-1'
    })

    currentTime = 1_100
    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(await screen.findByRole('button', { name: 'Run' })).toBeVisible()
    await nextTick()
    expect(telemetry.trackAgentRunApprovalShown).toHaveBeenCalledOnce()

    currentTime = 1_150
    await userEvent.click(
      screen.getByRole('button', { name: 'Portrait workflow' })
    )
    await vi.waitFor(() =>
      expect(telemetry.trackAgentRunApprovalResolved).toHaveBeenCalledWith({
        decision: 'open_workflow',
        time_to_decide_ms: 150
      })
    )

    currentTime = 1_275
    await userEvent.click(screen.getByRole('button', { name: 'Run' }))
    await vi.waitFor(() =>
      expect(fetchRequests({ method: 'POST', url: /\/asks\// })).toHaveLength(1)
    )
    dispatchApiEvent('agent_ask_resolved', {
      thread_id: 'th-1',
      message_id: turnId,
      ask_id: 'turn-approval:call-1',
      status: 'answered',
      selected: ['run']
    })
    currentTime = 1_900
    resolveAnswer(json(200, { status: 'answered' }))
    await vi.waitFor(() =>
      expect(telemetry.trackAgentRunApprovalResolved.mock.calls).toEqual([
        [{ decision: 'open_workflow', time_to_decide_ms: 150 }],
        [{ decision: 'run', time_to_decide_ms: 275 }]
      ])
    )
    expect(fetchRequests({ method: 'POST', url: /\/asks\// })).toHaveLength(1)
    now.mockRestore()
  })
})

describe('AgentPanelRoot ask_user answer telemetry', () => {
  it('never reports an ask_user answer as a run approval, even one named run', async () => {
    respondToFetch({}, () => json(200, {}))
    respondToFetch(/\/agent\/threads/, () => json(200, agentThreadList()))
    respondToFetch({ method: 'POST', url: /\/asks\// }, () =>
      json(200, { status: 'answered' })
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const store = useAgentConversationStore()
    store.setThreadId('th-1')
    const turnId = toTurnId('turn-question')
    store.recordUser(turnId, 'go on')
    store.startTurn(turnId)
    store.ingest(
      zAgentWsEventForTest({
        type: 'agent_ask',
        data: {
          thread_id: 'th-1',
          message_id: turnId,
          ask_id: 'turn-question:call-1',
          kind: 'ask_user',
          prompt: 'Should I run it now?',
          options: [
            { id: 'run', label: 'Run now' },
            { id: 'cancel', label: 'Not yet' }
          ],
          min_selections: 1,
          max_selections: 1,
          allow_other: false
        }
      })
    )

    await userEvent.click(await screen.findByRole('radio', { name: 'Run now' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await vi.waitFor(() =>
      expect(fetchRequests({ method: 'POST', url: /\/asks\// })).toHaveLength(1)
    )
    dispatchApiEvent('agent_ask_resolved', {
      thread_id: 'th-1',
      message_id: turnId,
      ask_id: 'turn-question:call-1',
      status: 'answered',
      selected: ['run']
    })
    expect(await screen.findByText('Answered')).toBeVisible()

    expect(telemetry.trackAgentRunApprovalShown).not.toHaveBeenCalled()
    expect(telemetry.trackAgentRunApprovalResolved).not.toHaveBeenCalled()
  })
})

describe('AgentPanelRoot lifecycle', () => {
  it('reports the header close click and attributes the panel close to it', async () => {
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    const selection = await startVueNodeSelection()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.close') })
    )

    expect(canvasStore.isPickingNodes).toBe(false)
    expect(useTelemetry()!.trackAgentCloseButtonClicked).toHaveBeenCalled()
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: null
    })
    expect(useAgentPanelStore().isOpen).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('ends node selection when the panel unmounts', async () => {
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    const selection = await startVueNodeSelection()

    selection.unmount()

    expect(canvasStore.isPickingNodes).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('does not cancel the in-flight turn when the panel unmounts', async () => {
    const tab = addTab('workflows/current.json')
    workflowStore.activeWorkflow = tab
    useAgentWorkflowTabBindingStore().bind('wf-42', tab.path)
    respondToFetch({}, () =>
      json(202, { thread_id: 'th-1', message_id: 'm-1' })
    )

    const { unmount } = renderWithSelectedTarget()

    await sendFromComposer('hello')

    unmount()
    await new Promise((resolve) => setTimeout(resolve))

    expect(fetchRequests(/\/cancel$/)).toEqual([])
  })

  it('releases the minimap graph-activity layer even when another teardown step throws', () => {
    const errorHandler = vi.fn()
    const first = render(AgentPanelRoot, {
      global: { plugins: [i18n], config: { errorHandler } }
    })
    vi.spyOn(
      useWorkflowTabActivityStore(),
      'setCreating'
    ).mockImplementationOnce(() => {
      throw new Error('teardown failed')
    })

    first.unmount()
    // Contained and reported, not escaped: a step that throws must not reach
    // Vue's error handling, which re-throws out of `invokeArrayFns` and would
    // abandon the remaining hooks and the rest of `unmountComponent`.
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'teardown failed' }),
      expect.objectContaining({
        errorType: 'failure_tearing_down_agent_panel',
        tags: { step: 'clearCreatingTab' }
      })
    )
    expect(errorHandler).not.toHaveBeenCalled()

    renderWithSelectedTarget().unmount()

    expect(reportError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'minimap_decoration_layer_duplicate'
      })
    )
  })

  it('resets the canvas sync gate when an earlier teardown step throws', () => {
    const errorHandler = vi.fn()
    vi.mocked(attachDocOpMinter).mockImplementationOnce((deps) => {
      docOpMinterDeps.current = deps
      return fromPartial<DocOpMinter>({
        detach: vi.fn(() => {
          throw new Error('detach failed')
        })
      })
    })
    const panel = render(AgentPanelRoot, {
      global: { plugins: [i18n], config: { errorHandler } }
    })
    const setCanvasSyncGate = vi.spyOn(
      useAgentConversationStore(),
      'setCanvasSyncGate'
    )
    // Cleared so the only recorded call is the teardown reset, not this
    // instance's own live gate registered while it was mounted.
    setCanvasSyncGate.mockClear()

    panel.unmount()

    // PM-1575: the gate is reset to the always-safe default even though a
    // step three places ahead of it threw.
    expect(setCanvasSyncGate).toHaveBeenCalledOnce()
    const [gate] = setCanvasSyncGate.mock.lastCall ?? []
    expect(gate?.()).toBe('none')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'detach failed' }),
      expect.objectContaining({
        errorType: 'failure_tearing_down_agent_panel',
        tags: { step: 'detachDocOpMinter' }
      })
    )
    expect(errorHandler).not.toHaveBeenCalled()
  })

  it('resets the canvas sync gate when reporting a failed teardown step throws', () => {
    const errorHandler = vi.fn()
    vi.mocked(attachDocOpMinter).mockImplementationOnce((deps) => {
      docOpMinterDeps.current = deps
      return fromPartial<DocOpMinter>({
        detach: vi.fn(() => {
          throw new Error('detach failed')
        })
      })
    })
    const panel = render(AgentPanelRoot, {
      global: { plugins: [i18n], config: { errorHandler } }
    })
    const setCanvasSyncGate = vi.spyOn(
      useAgentConversationStore(),
      'setCanvasSyncGate'
    )
    setCanvasSyncGate.mockClear()
    // The reporter is the one part of the loop outside its own try/catch; a
    // telemetry sink torn down ahead of the panel must not take the remaining
    // releases with it.
    vi.mocked(reportError).mockImplementationOnce(() => {
      throw new Error('reporter failed')
    })

    panel.unmount()

    expect(setCanvasSyncGate).toHaveBeenCalledOnce()
    const [gate] = setCanvasSyncGate.mock.lastCall ?? []
    expect(gate?.()).toBe('none')
    expect(errorHandler).not.toHaveBeenCalled()
  })

  it('does not claim the minimap graph-activity layer when setup throws', () => {
    vi.mocked(useBillingContext).mockImplementationOnce(() => {
      throw new Error('setup failed')
    })
    // Mounted without Testing Library, whose error handler lets a failed
    // setup finish mounting; Vue itself aborts the mount.
    const app = createApp(AgentPanelRoot).use(i18n)
    expect(() => app.mount(document.createElement('div'))).toThrow(
      'setup failed'
    )

    renderWithSelectedTarget().unmount()

    expect(reportError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'minimap_decoration_layer_duplicate'
      })
    )
  })

  it('still paints graph activity when a replacement panel sets up before the old one unmounts', async () => {
    workflowStore.activeWorkflow = addTab('workflows/current.json')
    const outgoing = renderWithSelectedTarget()
    // The handover order the fix above cannot cover: a replacement host builds
    // its panel while the outgoing one is still mounted and holding the id.
    renderWithSelectedTarget()
    outgoing.unmount()

    useAgentGraphActivityStore().recordMaterialized(
      { workflowId: 'wf-42', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(301)]
    )
    await nextTick()

    expect(
      getMinimapDecorations({
        rootGraphId: toRootGraphId('graph-1'),
        owningGraphId: toOwningGraphId('graph-1')
      }).map(({ target }) => target.nodeId)
    ).toEqual(['301'])
  })

  it('clears workflow activity when the panel unmounts', () => {
    const activity = useWorkflowTabActivityStore()
    activity.setAgentTurnTabs([
      { path: 'workflows/active.json', awaitingApproval: false }
    ])
    activity.setCreating(true)

    const { unmount } = renderWithSelectedTarget()

    unmount()

    expect(activity.editingPaths.size).toBe(0)
    expect(activity.$state.creatingTab).toBe(false)
  })
})

describe('AgentPanelRoot node definition refresh', () => {
  const restartSucceeded = {
    tool_call_id: 'call-restart',
    tool_name: 'restart_comfyui',
    status: 'success',
    duration_ms: 900,
    thread_id: 'th-1',
    message_id: 'm-1'
  }

  beforeEach(() => {
    ws.clear()
    vi.useFakeTimers()
  })

  it('refreshes node definitions when ComfyUI reconnects after the agent restarts it while the panel is open', async () => {
    const refreshNodeDefinitions = vi.fn()
    useCommandStore().registerCommand({
      id: 'Comfy.RefreshNodeDefinitions',
      function: refreshNodeDefinitions
    })
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    ws.emit('agent_tool_call', restartSucceeded)
    await vi.advanceTimersByTimeAsync(0)
    expect(refreshNodeDefinitions).not.toHaveBeenCalled()

    ws.emit('reconnected')
    await vi.advanceTimersByTimeAsync(0)

    expect(refreshNodeDefinitions).toHaveBeenCalledOnce()
  })

  it('stops observing restarts once the panel unmounts', async () => {
    const refreshNodeDefinitions = vi.fn()
    useCommandStore().registerCommand({
      id: 'Comfy.RefreshNodeDefinitions',
      function: refreshNodeDefinitions
    })
    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })

    unmount()
    ws.emit('agent_tool_call', restartSucceeded)
    ws.emit('reconnected')
    await vi.advanceTimersByTimeAsync(0)

    expect(refreshNodeDefinitions).not.toHaveBeenCalled()
  })
})

describe('AgentPanelRoot greeting', () => {
  it('personalizes the empty-state greeting with the account first name', async () => {
    renderWithSelectedTarget()

    expect(await screen.findByText('Hello Jo,')).toBeInTheDocument()
  })
})

describe('AgentPanelRoot a11y id guard', () => {
  // R-193 residual: a duplicated #agent-panel-title (the FE #16912 regression
  // class) reached main unnoticed because the fast suite never asserted the id
  // count. Assert the document-level count, not a getBy* query, so a second
  // copy of the id fails loudly here instead of only in the Playwright suite
  // (agentPanelLifecycle.spec.ts, re-enabled in #17132).
  it('renders exactly one #agent-panel-title on the success path', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(await screen.findByText(i18n.global.t('agent.title'))).toBeVisible()
    // Document-level count is the point: the guard must see any duplicate id
    // anywhere in the document, not just within the panel subtree.
    /* oxlint-disable testing-library/no-node-access */
    expect(document.querySelectorAll('#agent-panel-title')).toHaveLength(1)
    /* oxlint-enable testing-library/no-node-access */
  })
})

function mockMessagesEndpoint(
  ackWorkflowId: string | (() => string),
  cloudWorkflows:
    | { id: string; name: string }[]
    | (() => { id: string; name: string }[]) = [],
  threads: AgentThreadSummary[] = []
): unknown[] {
  const bodies: unknown[] = []
  const resolveAckWorkflowId =
    typeof ackWorkflowId === 'function' ? ackWorkflowId : () => ackWorkflowId
  vi.mocked(fetch).mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/messages') && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)))
        return json(202, ack(resolveAckWorkflowId(), `m-${bodies.length}`))
      }
      if (url.includes('/messages')) return json(200, [])
      if (url.includes('/agent/threads')) {
        return json(200, agentThreadList(threads))
      }
      if (url.includes('/assets')) {
        return json(200, { assets: [], total: 0, has_more: false })
      }
      if (url.includes('/workflows')) {
        const workflows =
          typeof cloudWorkflows === 'function'
            ? cloudWorkflows()
            : cloudWorkflows
        return json(200, {
          data: workflows,
          pagination: {
            offset: 0,
            limit: 100,
            total: workflows.length,
            has_more: false
          }
        })
      }
      return new Response('{}', { status: 200 })
    }
  )
  return bodies
}

describe('AgentPanelRoot workflow binding', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    vi.mocked(app.loadGraphData).mockClear()
    vi.mocked(validateComfyWorkflow).mockClear()
    vi.mocked(useTelemetry())!.trackAgentNodeTagged.mockClear()
    vi.mocked(useTelemetry())!.trackAgentWorkflowApplied.mockClear()
    executionErrors.showErrorOverlay.mockClear()
  })

  function makeTab(id?: string): LoadedComfyWorkflow {
    const tab = addTab(
      'workflows/current.json',
      id === undefined
        ? {}
        : { activeState: fromPartial<ComfyWorkflowJSON>({ id }) }
    )
    workflowStore.activeWorkflow = tab
    if (id !== undefined) useAgentWorkflowTabBindingStore().bind(id, tab.path)
    return tab
  }

  it.for([
    { existingThread: null, thread_id: null },
    { existingThread: 'th-1', thread_id: 'th-1' }
  ])(
    'sends the message with thread_id $thread_id and the targeted workflow',
    async ({ existingThread, thread_id }) => {
      makeTab('wf-42')
      if (existingThread !== null)
        useAgentConversationStore().setThreadId(existingThread)
      mockMessagesEndpoint('wf-42')
      vi.mocked(useTelemetry())!.trackAgentMessageSent.mockClear()
      renderWithSelectedTarget()

      await sendFromComposer('build me a workflow')

      expect(
        vi.mocked(useTelemetry())!.trackAgentMessageSent.mock.calls
      ).toEqual([
        [
          {
            attachment_count: 0,
            node_tag_count: 0,
            thread_id,
            workflow_id: 'wf-42',
            client_message_id: 'client-message-1',
            input_method: 'typed',
            starter_prompt_id: null,
            starter_prompt_click_id: null
          }
        ]
      ])
    }
  )

  it('keeps the first send pending until consent succeeds, then resumes it', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    Object.assign(useAgentConsentStore(), { accepted: false })
    let accept = () => {}
    withConsent.mockImplementationOnce(
      (_trigger, onAccept) =>
        new Promise<void>((resolve) => {
          accept = () => {
            Object.assign(useAgentConsentStore(), { accepted: true })
            onAccept()
            resolve()
          }
        })
    )
    renderWithSelectedTarget()

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('build me a workflow')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(withConsent).toHaveBeenCalledExactlyOnceWith(
      'first_message',
      expect.any(Function)
    )
    expect(bodies).toHaveLength(0)

    accept()
    await screen.findByRole('button', { name: 'Stop' })
    await waitFor(() => expect(bodies).toHaveLength(1))
  })

  it('asks signed-out users in a browser tab on a local Core to sign in before consent', async () => {
    distribution.isCloud = false
    makeTab('wf-42')
    useAuthStore().currentUser = null
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValue(false)
    Object.assign(useAgentConsentStore(), { accepted: false })
    const bodies = mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('build me a workflow')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(useAgentComposerStore().submission).toBeNull())

    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    expect(withConsent).not.toHaveBeenCalled()
    expect(bodies).toHaveLength(0)
  })

  it('asks signed-out Desktop users for consent before opening sign-in and keeps their draft on Skip', async () => {
    distribution.isCloud = false
    distribution.isDesktop = true
    makeTab('wf-42')
    useAuthStore().currentUser = null
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValue(false)
    Object.assign(useAgentConsentStore(), { accepted: false })
    withConsent.mockResolvedValueOnce()
    const bodies = mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('build me a workflow')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(useAgentComposerStore().submission).toBeNull())

    expect(withConsent).toHaveBeenCalledExactlyOnceWith(
      'first_message',
      expect.any(Function)
    )
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    expect(bodies).toHaveLength(0)
    expect(useAgentComposerStore().draft).toBe('build me a workflow')
  })

  it.for([
    {
      scenario: 'the pending submission is canceled',
      change: () => useAgentComposerStore().invalidateSubmission(),
      sent: false,
      messages: []
    },
    {
      scenario: 'consent is cleared',
      change: () => Object.assign(useAgentConsentStore(), { accepted: false }),
      sent: false,
      messages: []
    },
    {
      scenario: 'the workspace changes',
      change: () =>
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-b'
        }),
      sent: false,
      messages: []
    },
    {
      scenario: 'the submission and consent scope remain current',
      change: () => undefined,
      sent: true,
      messages: [{ content: 'hold this Desktop submission during sign-in' }]
    }
  ])(
    'checks the pending Desktop send after sign-in when $scenario',
    async ({ change, sent, messages }) => {
      distribution.isCloud = false
      distribution.isDesktop = true
      makeTab('wf-42')
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-a'
      })
      useAuthStore().currentUser = null
      vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(null)
      let finishSignIn!: (signedIn: boolean) => void
      const signIn = new Promise<boolean>((resolve) => {
        finishSignIn = resolve
      })
      vi.mocked(useAuthDialogs().showSignInDialog).mockReturnValueOnce(signIn)
      const composer = useAgentComposerStore()
      const settleSubmission = vi.spyOn(composer, 'settleSubmission')
      const bodies = mockMessagesEndpoint('wf-42')
      renderWithSelectedTarget()

      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('hold this Desktop submission during sign-in')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await waitFor(() =>
        expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
      )
      assert.exists(composer.submission)
      const submissionId = composer.submission.id
      expect(settleSubmission).not.toHaveBeenCalled()
      expect(bodies).toHaveLength(0)

      change()
      useAuthStore().currentUser = fromPartial<User>({ uid: 'account-a' })
      vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue({
        Authorization: 'Bearer renewed-id-token'
      })
      vi.mocked(useAuthStore().getWorkspaceAuthTokenOrThrow).mockResolvedValue(
        'workspace-token'
      )
      finishSignIn(true)

      await waitFor(() =>
        expect(settleSubmission).toHaveBeenCalledWith(submissionId, sent)
      )
      expect(bodies).toMatchObject(messages)
    }
  )

  it('sends the original Desktop submission once after sign-in and consent persistence succeed', async () => {
    distribution.isCloud = false
    distribution.isDesktop = true
    makeTab('wf-42')
    currentUserInfo.value = null
    useCurrentUser().isLoggedIn = computed(() => currentUserInfo.value !== null)
    useAuthStore().currentUser = null
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(null)
    Object.assign(useAgentConsentStore(), { accepted: undefined })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    localStorage.setItem(
      'Comfy.AgentPanel.onboarded.account-a.workspace-a',
      'true'
    )
    let finishSignIn!: () => void
    const signIn = new Promise<void>((resolve) => {
      finishSignIn = resolve
    })
    let confirmPersistence!: (response: Response) => void
    const persistence = new Promise<Response>((resolve) => {
      confirmPersistence = resolve
    })
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
      async () => {
        await signIn
        useAuthStore().currentUser = fromPartial<User>({ uid: 'account-a' })
        vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue({
          Authorization: 'Bearer id-token'
        })
        vi.mocked(
          useAuthStore().getWorkspaceAuthTokenOrThrow
        ).mockResolvedValue('workspace-token')
        currentUserInfo.value = { id: 'account-a' }
        return true
      }
    )
    vi.mocked(useAgentConsent).mockReset()
    const bodies = mockMessagesEndpoint('wf-42')
    const consentPost = { method: 'POST', url: /\/api\/global-settings$/ }
    respondToFetch(consentPost, () => persistence)
    renderWithSelectedTarget()
    render(GlobalDialog, { global: { plugins: [i18n] } })

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('continue this submission')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    const agree = await screen.findByRole('button', {
      name: 'Agree and continue'
    })
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    expect(fetchRequests(consentPost)).toHaveLength(0)
    expect(bodies).toHaveLength(0)

    await userEvent.click(agree)
    await waitFor(() =>
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    )
    expect(fetchRequests(consentPost)).toHaveLength(0)
    expect(bodies).toHaveLength(0)

    finishSignIn()
    await waitFor(() => expect(fetchRequests(consentPost)).toHaveLength(1))
    expect(useAgentConsentStore().accepted).toBe(false)
    expect(bodies).toHaveLength(0)

    confirmPersistence(
      json(200, {
        key: 'Comfy.AgentPanel.ConsentAccepted',
        value: true,
        updated_at: '2026-10-21T00:00:00Z'
      } satisfies GlobalSetting)
    )
    await screen.findByRole('button', { name: 'Stop' })

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({
      content: 'continue this submission',
      workflow_id: 'wf-42'
    })
    expect(useAgentConsentStore().accepted).toBe(true)
    expect(fetchRequests(consentPost)).toHaveLength(1)
    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
  })

  it('restores a consent-held Desktop draft when its scope changes during the coach', async () => {
    distribution.isCloud = false
    distribution.isDesktop = true
    makeTab('wf-42')
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    localStorage.removeItem('Comfy.AgentPanel.onboarded')
    localStorage.removeItem('Comfy.AgentPanel.onboarded.account-a.workspace-a')
    Object.assign(useAgentConsentStore(), { accepted: false })
    withConsent.mockImplementationOnce(async (_trigger, onAccept) => {
      Object.assign(useAgentConsentStore(), { accepted: true })
      onAccept()
    })
    const bodies = mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('keep this draft in its original scope')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    expect(useAgentComposerStore().submission?.phase).toBe('pending')

    Object.assign(useAgentConsentStore(), { accepted: false })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    await waitFor(() => expect(useAgentComposerStore().submission).toBeNull())

    expect(useAgentComposerStore().draft).toBe(
      'keep this draft in its original scope'
    )
    expect(bodies).toHaveLength(0)
  })

  it('does not resume a consent-held send after closing in App Mode', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    const settleSubmission = vi.spyOn(
      useAgentComposerStore(),
      'settleSubmission'
    )
    Object.assign(useAgentConsentStore(), { accepted: false })
    let accept = () => {}
    withConsent.mockImplementationOnce(
      (_trigger, onAccept) =>
        new Promise<void>((resolve) => {
          accept = () => {
            Object.assign(useAgentConsentStore(), { accepted: true })
            onAccept()
            resolve()
          }
        })
    )
    const { unmount } = renderWithSelectedTarget()

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('build me a workflow')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    canvasStore.linearMode = true
    useAgentPanelStore().close('close_button')
    unmount()
    expect(useAgentComposerStore().submission).toBeNull()
    accept()
    await waitFor(() =>
      expect(settleSubmission).toHaveBeenCalledWith(expect.any(Number), false)
    )
    expect(bodies).toHaveLength(0)
  })

  describe('a first send held by the coach', () => {
    const HOLD_NOTICE =
      'Your message will send when you finish or skip the tour.'

    beforeEach(() => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-hold'
      })
      Object.assign(useAgentConsentStore(), { accepted: false })
      withConsent.mockImplementationOnce(async (_trigger, onAccept) => {
        Object.assign(useAgentConsentStore(), { accepted: true })
        onAccept()
      })
    })

    async function sendHeldByCoach(text: string) {
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste(text)
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      return screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
    }

    it('tells the user why the send is waiting, and sends once on Skip', async () => {
      makeTab('wf-42')
      const bodies = mockMessagesEndpoint('wf-42')
      renderWithSelectedTarget()

      const coach = await sendHeldByCoach('build me a workflow')

      expect(
        within(coach).getByTestId('agent-coach-hold-notice')
      ).toHaveTextContent(HOLD_NOTICE)
      expect(bodies).toHaveLength(0)

      await userEvent.click(within(coach).getByRole('button', { name: 'Skip' }))
      await waitFor(() => expect(bodies).toHaveLength(1))
    })

    it('shows no hold notice on a replay with nothing held', async () => {
      withConsent.mockReset()
      Object.assign(useAgentConsentStore(), { accepted: true })
      localStorage.setItem(
        'Comfy.AgentPanel.onboarded.account-a.workspace-hold',
        'true'
      )
      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      await userEvent.click(
        screen.getByRole('button', { name: 'Take the tour' })
      )

      await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
      expect(screen.queryByTestId('agent-coach-hold-notice')).toBeNull()
    })

    it('sends once when a coach step never finds its target', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      makeTab('wf-42')
      const bodies = mockMessagesEndpoint('wf-42')
      renderWithSelectedTarget()

      await sendHeldByCoach('build me a workflow')
      await user.click(
        within(
          await screen.findByRole('dialog', { name: 'Meet your Comfy Agent' })
        ).getByRole('button', { name: 'Next' })
      )
      await user.click(
        within(
          await screen.findByRole('dialog', {
            name: "Your agent edits the workflow you're viewing"
          })
        ).getByRole('button', { name: 'Next' })
      )
      expect(bodies).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(8_000)

      await waitFor(() => expect(bodies).toHaveLength(1))
      await vi.advanceTimersByTimeAsync(8_000)
      expect(bodies).toHaveLength(1)
      expect(
        localStorage.getItem(
          'Comfy.AgentPanel.onboarded.account-a.workspace-hold'
        )
      ).not.toBe('true')
    })

    it.for([
      { teardown: 'before', flush: 'sync' },
      { teardown: 'after', flush: 'post' }
    ] as const)(
      'sends once when App Mode tears the panel down $teardown the panel releases the hold',
      async ({ flush }) => {
        Object.assign(useAgentPanelStore(), { enabled: true, isOpen: true })
        makeTab('wf-42')
        const bodies = mockMessagesEndpoint('wf-42')
        const { unmount } = renderWithSelectedTarget()
        await sendHeldByCoach('build me a workflow')
        const stopUnmountOnAppMode = watch(
          () => canvasStore.linearMode,
          () => unmount(),
          { flush }
        )

        try {
          canvasStore.linearMode = true

          await waitFor(() => expect(bodies).toHaveLength(1))
        } finally {
          stopUnmountOnAppMode()
        }
      }
    )

    it('puts the draft back when consent is cleared before App Mode releases the hold', async () => {
      makeTab('wf-42')
      const bodies = mockMessagesEndpoint('wf-42')
      const settleSubmission = vi.spyOn(
        useAgentComposerStore(),
        'settleSubmission'
      )
      renderWithSelectedTarget()
      await sendHeldByCoach('build me a workflow')

      Object.assign(useAgentConsentStore(), { accepted: false })
      canvasStore.linearMode = true

      await waitFor(() =>
        expect(settleSubmission).toHaveBeenCalledWith(expect.any(Number), false)
      )
      expect(bodies).toHaveLength(0)
    })

    it('puts the draft back instead of sending when the panel closes', async () => {
      makeTab('wf-42')
      const bodies = mockMessagesEndpoint('wf-42')
      const settleSubmission = vi.spyOn(
        useAgentComposerStore(),
        'settleSubmission'
      )
      const { unmount } = renderWithSelectedTarget()
      await sendHeldByCoach('build me a workflow')

      useAgentPanelStore().close('close_button')
      unmount()

      await waitFor(() =>
        expect(settleSubmission).toHaveBeenCalledWith(expect.any(Number), false)
      )
      expect(bodies).toHaveLength(0)
      renderWithSelectedTarget()
      expect(await screen.findByRole('textbox')).toHaveTextContent(
        'build me a workflow'
      )
      expect(bodies).toHaveLength(0)
    })
  })

  it('reports a message sent from an empty-state suggestion chip as a suggestion', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    vi.mocked(useTelemetry())!.trackAgentMessageSent.mockClear()
    vi.mocked(useTelemetry())!.trackAgentStarterPromptClicked.mockClear()
    renderWithSelectedTarget()

    const prompt = i18n.global.t('agent.suggestedPrompts.cloud.1')
    await userEvent.click(await screen.findByRole('button', { name: prompt }))
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('button', { name: 'Stop' })

    // The click is reported when it happens, so it holds the first minted id and
    // the send that follows holds the second.
    expect(
      vi.mocked(useTelemetry())!.trackAgentStarterPromptClicked.mock.calls
    ).toEqual([
      [
        {
          prompt_id: 'slot_2',
          prompt_index: 1,
          prompt_count: 5,
          // Nothing is hidden at this width, so both counts agree here.
          visible_prompt_count: 5,
          prompt_text_hash: expect.stringMatching(/^[0-9a-f]{8}$/),
          locale: 'en',
          click_id: 'client-message-1',
          draft_was_empty: true
        }
      ]
    ])
    expect(vi.mocked(useTelemetry())!.trackAgentMessageSent.mock.calls).toEqual(
      [
        [
          {
            attachment_count: 0,
            node_tag_count: 0,
            thread_id: null,
            workflow_id: 'wf-42',
            client_message_id: 'client-message-2',
            input_method: 'suggestion',
            starter_prompt_id: 'slot_2',
            starter_prompt_click_id: 'client-message-1'
          }
        ]
      ]
    )
  })

  it('keeps the report on the turn’s own workflow when the target changes mid-send', async () => {
    makeTab('wf-42')
    const other = addTab('workflows/other.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'wf-99' })
    })
    useAgentWorkflowTabBindingStore().bind('wf-99', other.path)
    // Switch target only while the send's own refresh is in flight — not the
    // one on mount. The turn is pinned to the tab it started on, so the report
    // has to stay there too.
    let sending = false
    let listings = 0
    const bodies = mockMessagesEndpoint('wf-42', () => {
      listings++
      if (sending)
        useAgentPanelStore().setWorkflowTarget(
          fromPartial<ComfyWorkflow>(other)
        )
      return [
        { id: 'wf-42', name: 'current' },
        { id: 'wf-99', name: 'other' }
      ]
    })
    vi.mocked(useTelemetry())!.trackAgentMessageSent.mockClear()
    renderWithSelectedTarget()
    await screen.findByRole('textbox')
    await vi.waitFor(() => expect(listings).toBeGreaterThan(0))
    sending = true

    await sendFromComposer('build me a workflow')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })
    expect(vi.mocked(useTelemetry())!.trackAgentMessageSent.mock.calls).toEqual(
      [
        [
          {
            attachment_count: 0,
            node_tag_count: 0,
            thread_id: null,
            workflow_id: 'wf-42',
            client_message_id: 'client-message-1',
            input_method: 'typed',
            starter_prompt_id: null,
            starter_prompt_click_id: null
          }
        ]
      ]
    )
  })

  it('reports the workflow the turn was posted against, not the id known before it resolved', async () => {
    // No binding, and the cloud index does not list the tab until the send's
    // own refresh — so the id is genuinely unresolved at the moment the user
    // hits Send, the state a first send of a session starts from.
    makeTab()
    let listed = false
    const bodies = mockMessagesEndpoint('wf-77', () =>
      listed ? [{ id: 'wf-77', name: 'current' }] : []
    )
    vi.mocked(useTelemetry())!.trackAgentMessageSent.mockClear()
    renderWithSelectedTarget()
    await screen.findByRole('textbox')
    listed = true

    await sendFromComposer('build me a workflow')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-77' })
    expect(vi.mocked(useTelemetry())!.trackAgentMessageSent.mock.calls).toEqual(
      [
        [
          {
            attachment_count: 0,
            node_tag_count: 0,
            thread_id: null,
            workflow_id: 'wf-77',
            client_message_id: 'client-message-1',
            input_method: 'typed',
            starter_prompt_id: null,
            starter_prompt_click_id: null
          }
        ]
      ]
    )
  })

  function setupWorkflowContext({
    targetId,
    references
  }: {
    targetId: string
    references: { path: string; workflowId?: string }[]
  }) {
    const target = makeTab(targetId)
    const bindings = useAgentWorkflowTabBindingStore()
    const referenceTabs = references.map(({ path, workflowId }) => {
      const tab = addTab(path)
      if (workflowId !== undefined) bindings.bind(workflowId, tab.path)
      return tab
    })
    return { target, references: referenceTabs }
  }

  it('preserves active-turn graph activity across remount and delayed hydration', async () => {
    makeTab('wf-42')
    let resolveHistory!: (response: Response) => void
    const delayedHistory = new Promise<Response>((resolve) => {
      resolveHistory = resolve
    })
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST')
          return json(202, ack('wf-42'))
        if (url.includes('/messages')) return delayedHistory
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        return new Response('{}', { status: 200 })
      }
    )

    const first = renderWithSelectedTarget()
    await sendFromComposer('build two nodes')
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-42', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(301), toNodeId(302)]
    )

    first.unmount()
    renderWithSelectedTarget()
    expect(activity.state).toMatchObject({
      phase: 'settling',
      nodeIds: ['301', '302']
    })

    resolveHistory(json(200, []))
    await vi.waitFor(() =>
      expect(useAgentConversationStore().activeTurnId).toBe('m-1')
    )
    expect(activity.state).toMatchObject({
      phase: 'running',
      nodeIds: ['301', '302']
    })
  })

  it('starts a fresh activity report when the session starts its next turn', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()
    const activity = useAgentGraphActivityStore()

    await sendFromComposer('first turn')
    activity.recordMaterialized(
      { workflowId: 'wf-42', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(401)]
    )
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    await sendFromComposer('second turn')
    activity.recordMaterialized(
      { workflowId: 'wf-42', rootGraphId: toRootGraphId('graph-1') },
      [toNodeId(402)]
    )

    expect(activity.state).toMatchObject({
      phase: 'running',
      nodeIds: ['402']
    })
  })

  it('automatically targets an unsaved canvas on first entry without saving', async () => {
    Object.assign(makeTab(), { isTemporary: true })
    const bodies = mockMessagesEndpoint('wf-new')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(
      workflowStore.activeWorkflow?.path
    )
    await sendFromComposer('build here')
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ current_tab_unbound: true })
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
  })

  it('follows the visible workflow while preserving a typed draft before Send', async () => {
    const {
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const bodies = mockMessagesEndpoint('wf-other')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('continue this draft')

    workflowStore.activeWorkflow = other
    await nextTick()

    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    expect(textbox).toHaveTextContent('continue this draft')
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-other' })
  })

  it.for(['current', 'other'])(
    'retains a successful explicit pick of %s before Send',
    async (name) => {
      const {
        target,
        references: [other]
      } = setupWorkflowContext({
        targetId: 'wf-42',
        references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
      })
      const picked = name === 'current' ? target : other
      const viewed = name === 'current' ? other : target
      const workflowId = name === 'current' ? 'wf-42' : 'wf-other'
      const bodies = mockMessagesEndpoint(workflowId)
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('keep this draft')
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      )
      await userEvent.click(await screen.findByRole('menuitemradio', { name }))
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

      workflowStore.activeWorkflow = viewed
      await nextTick()
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(picked.path)
      expect(screen.getByRole('textbox')).toHaveTextContent('keep this draft')
      expect(screen.getByRole('note')).toHaveTextContent(
        i18n.global.t('agent.viewingDifferentWorkflow')
      )
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ workflow_id: workflowId })
    }
  )

  it('resumes following on New Chat after an explicit pick while preserving draft text', async () => {
    const {
      target,
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    mockMessagesEndpoint('wf-other')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('keep this draft')
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'other' })
    )
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    workflowStore.activeWorkflow = target
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    workflowStore.activeWorkflow = other
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    expect(screen.getByRole('textbox')).toHaveTextContent('keep this draft')
  })

  it('retains the first Send target through failure, reopen and retry until New Chat', async () => {
    const {
      target,
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const bodies = mockMessagesEndpoint('wf-42')
    let finishSend = (_response: Response) => {}
    const firstSend = new Promise<Response>((resolve) => {
      finishSend = resolve
    })
    respondToFetch({ method: 'POST', url: /\/messages/ }, () => firstSend, {
      times: 1
    })
    const panel = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('keep my target')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    workflowStore.activeWorkflow = other
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    finishSend(json(503, { error: 'temporarily unavailable' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveTextContent('keep my target')
    )
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    expect(useAgentConversationStore().threadId).toBeNull()

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    workflowStore.activeWorkflow = target
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
  })

  it('keeps the target after removing node references and Show target only changes the view', async () => {
    const {
      target,
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const bodies = mockMessagesEndpoint('wf-42')
    setupNodeSelectionCanvas()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true
    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
    )

    workflowStore.activeWorkflow = other
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    expect(screen.getByRole('note')).toHaveTextContent(
      i18n.global.t('agent.viewingDifferentWorkflow')
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Show target workflow: current' })
    )
    await waitFor(() =>
      expect(workflowStore.activeWorkflow?.path).toBe(target.path)
    )
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    expect(
      screen.queryByText(i18n.global.t('agent.viewingDifferentWorkflow'))
    ).toBeNull()
    expect(bodies).toHaveLength(0)
  })

  it('keeps a saving row open until automatic save and target selection complete', async () => {
    makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    const cloudWorkflows: { id: string; name: string }[] = []
    const bodies = mockMessagesEndpoint('wf-scratch', cloudWorkflows)
    let resolveSave = () => {}
    const save = new Promise<boolean>((resolve) => {
      resolveSave = () => resolve(true)
    })
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
      async () => {
        await save
        Object.assign(scratch, { isTemporary: false })
        cloudWorkflows.push({ id: 'wf-scratch', name: 'scratch' })
        return true
      }
    )
    renderWithSelectedTarget()
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('keep this prompt')
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'scratch' })
    )
    const row = await screen.findByRole('menuitemradio', { name: /scratch/ })
    expect(within(row).getByRole('status')).toHaveTextContent('Saving workflow')
    expect(row).not.toBeChecked()
    expect(screen.getByRole('menuitemradio', { name: 'current' })).toBeChecked()
    expect(
      screen.getByRole('menuitemradio', { name: 'current' })
    ).toHaveAttribute('aria-disabled', 'true')
    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledWith(scratch, {
      filename: 'scratch'
    })
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    resolveSave()
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('scratch')
    expect(useAgentComposerStore().draft).toBe('keep this prompt')
    expect(bodies).toHaveLength(0)
  })

  it('keeps a newer visible target when an earlier picker save completes', async () => {
    const {
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    const cloudWorkflows: { id: string; name: string }[] = []
    const bodies = mockMessagesEndpoint('wf-other', cloudWorkflows)
    let finishSave = () => {}
    const saved = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
      async () => {
        await saved
        Object.assign(scratch, { isTemporary: false })
        cloudWorkflows.push({ id: 'wf-scratch', name: 'scratch' })
        return true
      }
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'scratch' })
    )
    await waitFor(() =>
      expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledOnce()
    )

    workflowStore.activeWorkflow = other
    await nextTick()
    finishSave()
    await waitFor(() =>
      expect(
        screen.getByRole('menuitemradio', { name: 'scratch' })
      ).not.toHaveAttribute('aria-busy', 'true')
    )
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    expect(useAgentPanelStore().followsVisibleWorkflow).toBe(true)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    await sendFromComposer('continue here')
    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-other' })
  })

  it.for(['failed save', 'cancelled save', 'failed open'])(
    'keeps following after a picker operation ends with %s',
    async (outcome) => {
      const {
        target,
        references: [other]
      } = setupWorkflowContext({
        targetId: 'wf-42',
        references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
      })
      addTab('workflows/scratch.json', { isTemporary: true })
      mockMessagesEndpoint('wf-other')
      if (outcome === 'failed save')
        vi.mocked(useWorkflowService()).saveWorkflowAs.mockRejectedValueOnce(
          new Error('Save failed')
        )
      else if (outcome === 'cancelled save')
        vi.mocked(useWorkflowService()).saveWorkflowAs.mockResolvedValueOnce(
          false
        )
      else
        vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(
          false
        )
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      )
      await userEvent.click(
        await screen.findByRole('menuitemradio', {
          name: outcome === 'failed open' ? 'other' : 'scratch'
        })
      )
      await waitFor(() => expect(useToast().toasts).toHaveLength(1))
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
      workflowStore.activeWorkflow = other
      await nextTick()
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
      expect(useAgentPanelStore().followsVisibleWorkflow).toBe(true)
    }
  )

  it('keeps the menu and draft available to retry after an automatic save failure', async () => {
    makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    const cloudWorkflows: { id: string; name: string }[] = []
    mockMessagesEndpoint('wf-scratch', cloudWorkflows)
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockRejectedValueOnce(
      new Error('save unavailable')
    )
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
      async () => {
        Object.assign(scratch, { isTemporary: false })
        cloudWorkflows.push({ id: 'wf-scratch', name: 'scratch' })
        return true
      }
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('keep draft')
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'scratch' })
    )
    await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))
    expect(
      screen.getByRole('menuitemradio', { name: 'scratch' })
    ).not.toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('status')).toBeNull()
    expect(useAgentComposerStore().draft).toBe('keep draft')
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'scratch' })
    )
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledTimes(2)
  })

  it('retries the Cloud binding without saving a successfully saved workflow twice', async () => {
    const current = makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    const cloudWorkflows: { id: string; name: string }[] = []
    mockMessagesEndpoint('wf-scratch', cloudWorkflows)
    renderWithSelectedTarget()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'scratch' })
    )
    await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))
    expect(scratch.isTemporary).toBe(false)
    expect(workflowStore.activeWorkflow?.path).toBe(current.path)
    expect(screen.getByRole('menuitemradio', { name: 'current' })).toBeChecked()

    cloudWorkflows.push({ id: 'wf-scratch', name: 'scratch' })
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'scratch' })
    )
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('scratch')
    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledTimes(1)
  })

  it('does not apply a target selection that finishes after panel teardown', async () => {
    const current = makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    mockMessagesEndpoint('wf-scratch', [{ id: 'wf-scratch', name: 'scratch' }])
    let finishSave = () => {}
    const saved = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
      async () => {
        await saved
        Object.assign(scratch, { isTemporary: false })
        return true
      }
    )
    const { unmount } = renderWithSelectedTarget()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'scratch' })
    )
    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledTimes(1)
    unmount()
    finishSave()
    await saved
    await nextTick()
    expect(scratch.isTemporary).toBe(false)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(current.path)
  })

  it('keeps a persisted startup target unresolved until history hydration completes', async () => {
    const {
      target,
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    mockMessagesEndpoint('wf-other', [{ id: 'wf-other', name: 'other' }])
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-restored')
    let finishHistory = (_response: Response) => {}
    const history = new Promise<Response>((resolve) => {
      finishHistory = resolve
    })
    respondToFetch({ method: 'GET', url: /\/messages/ }, () => history)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const panel = useAgentPanelStore()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.canRestoreWorkflow).toBe(true)
    workflowStore.activeWorkflow = addTab('workflows/third.json')
    await nextTick()
    expect(panel.selectedWorkflow).toBeNull()
    expect(panel.canRestoreWorkflow).toBe(true)

    finishHistory(
      json(200, [
        {
          id: 'row',
          thread_id: 'th-restored',
          seq: 1,
          role: 'user',
          status: 'complete',
          turn_id: 'turn',
          workflow_id: 'wf-other',
          content: { text: 'Earlier request' }
        }
      ])
    )
    await waitFor(() => expect(panel.selectedWorkflow?.path).toBe(other.path))
    expect(panel.canRestoreWorkflow).toBe(false)
    workflowStore.activeWorkflow = target
    await nextTick()
    expect(panel.selectedWorkflow?.path).toBe(other.path)
  })

  it.for([
    { targetVisible: true, restored: false },
    { targetVisible: false, restored: false },
    { targetVisible: true, restored: true },
    { targetVisible: false, restored: true }
  ])(
    'returns to Current without refetching (targetVisible=$targetVisible, restored=$restored)',
    async ({ targetVisible, restored }) => {
      const target = makeTab('wf-42')
      mockMessagesEndpoint(
        'wf-42',
        [{ id: 'wf-42', name: 'current' }],
        [
          agentThread({
            id: 'th-1',
            title: 'Current chat',
            last_message_at: '2026-09-25T00:00:00Z'
          })
        ]
      )
      if (restored) {
        useAgentConversationStore().setThreadId('th-1')
        const messages: AgentMessages = [
          {
            id: 'earlier',
            thread_id: 'th-1',
            seq: 1,
            role: 'user',
            status: 'complete',
            turn_id: 'earlier',
            workflow_id: 'wf-42',
            content: { text: 'Keep working on this workflow' }
          }
        ]
        respondToFetch(/\/messages/, () => json(200, messages))
      }
      renderWithSelectedTarget()
      if (restored) await screen.findByTestId('user-message-bubble')
      else await sendFromComposer('Keep working on this workflow')
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('Keep my unsent follow-up')
      if (!targetVisible)
        workflowStore.activeWorkflow = addTab('workflows/other.json')

      const blockedRoute = /\/(messages|workflows)/
      const requestsBeforeSwitch = fetchRequests(blockedRoute).length
      respondToFetch(blockedRoute, () => new Promise<Response>(() => {}))
      let finishOpening = () => {}
      const opening = new Promise<void>((resolve) => {
        finishOpening = resolve
      })
      const openWorkflow = vi.mocked(useWorkflowService().openWorkflow)
      const open = openWorkflow.getMockImplementation()
      assert.exists(open)
      if (!targetVisible)
        openWorkflow.mockImplementationOnce(async (...args) => {
          await opening
          return open(...args)
        })
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      const currentRow = await screen.findByRole('button', {
        name: 'Current chat'
      })
      expect(currentRow).toBeEnabled()
      await userEvent.click(currentRow)
      if (!targetVisible) {
        expect(currentRow).toHaveAttribute('aria-busy', 'true')
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        finishOpening()
      }

      expect(await screen.findByRole('textbox')).toHaveTextContent(
        'Keep my unsent follow-up'
      )
      expect(screen.getByTestId('user-message-bubble')).toHaveTextContent(
        'Keep working on this workflow'
      )
      if (restored)
        expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
      else expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
      expect(screen.queryByRole('heading', { name: 'Chat history' })).toBeNull()
      expect(workflowStore.activeWorkflow?.path).toBe(target.path)
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
      expect(useAgentChatHistoryStore().activeId).toBe('th-1')
      expect(useToast().toasts).toHaveLength(0)
      expect(fetchRequests(blockedRoute)).toHaveLength(requestsBeforeSwitch)
    }
  )

  it.for([
    { failure: 'false', leaveHistory: false },
    { failure: 'throw', leaveHistory: false },
    { failure: 'false', leaveHistory: true },
    { failure: 'throw', leaveHistory: true }
  ])(
    'handles a $failure Current switch failure with leaveHistory=$leaveHistory',
    async ({ failure, leaveHistory }) => {
      const target = makeTab('wf-42')
      mockMessagesEndpoint(
        'wf-42',
        [{ id: 'wf-42', name: 'current' }],
        [
          agentThread({
            id: 'th-1',
            title: 'Current chat',
            last_message_at: '2026-09-25T00:00:00Z'
          })
        ]
      )
      renderWithSelectedTarget()
      await sendFromComposer('Keep working on this workflow')
      const other = addTab('workflows/other.json')
      workflowStore.activeWorkflow = other
      let finishOpening = () => {}
      const opening = new Promise<void>((resolve) => {
        finishOpening = resolve
      })
      const openWorkflow = vi.mocked(useWorkflowService().openWorkflow)
      openWorkflow.mockImplementationOnce(async () => {
        await opening
        if (failure === 'throw') throw new Error('Workflow switch failed')
        return false
      })
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Current chat' })
      )
      expect(
        screen.getByRole('button', { name: 'Current chat' })
      ).toHaveAttribute('aria-busy', 'true')
      if (leaveHistory)
        await userEvent.click(
          screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
        )
      finishOpening()
      await Promise.allSettled(
        openWorkflow.mock.results.map(({ value }) => value)
      )
      await nextTick()

      if (leaveHistory) {
        expect(
          screen.queryByRole('heading', { name: 'Chat history' })
        ).toBeNull()
        expect(
          screen.queryByText(i18n.global.t('agent.historyOpenFailed'))
        ).toBeNull()
        expect(useToast().toasts).toHaveLength(0)
        expect(useAgentChatHistoryStore().activeId).toBeNull()
        expect(workflowStore.activeWorkflow.path).toBe(other.path)
      } else {
        expect(await screen.findByRole('alert')).toHaveTextContent(
          i18n.global.t('agent.historyOpenFailed')
        )
        expect(useToast().toasts).not.toContainEqual(
          expect.objectContaining({ kind: 'warning' })
        )
        expect(useAgentChatHistoryStore().activeId).toBe('th-1')
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
        await userEvent.click(
          screen.getByRole('button', { name: 'Current chat' })
        )
        expect(
          await screen.findByTestId('user-message-bubble')
        ).toHaveTextContent('Keep working on this workflow')
        expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
        expect(workflowStore.activeWorkflow.path).toBe(target.path)
      }
    }
  )

  it('returns to the intact Current chat on Back after its switch fails, without reopening', async () => {
    const target = makeTab('wf-42')
    mockMessagesEndpoint(
      'wf-42',
      [{ id: 'wf-42', name: 'current' }],
      [
        agentThread({
          id: 'th-1',
          title: 'Current chat',
          last_message_at: '2026-09-25T00:00:00Z'
        })
      ]
    )
    renderWithSelectedTarget()
    await sendFromComposer('Keep working on this workflow')
    const other = addTab('workflows/other.json')
    workflowStore.activeWorkflow = other
    const openWorkflow = vi.mocked(useWorkflowService().openWorkflow)
    openWorkflow.mockResolvedValueOnce(false)
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Current chat' })
    )
    await screen.findByRole('alert')
    const attempts = openWorkflow.mock.calls.length

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to previous chat' })
    )

    expect(screen.queryByRole('heading', { name: 'Chat history' })).toBeNull()
    expect(await screen.findByTestId('user-message-bubble')).toHaveTextContent(
      'Keep working on this workflow'
    )
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
    expect(openWorkflow).toHaveBeenCalledTimes(attempts)
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    expect(workflowStore.activeWorkflow.path).toBe(other.path)
  })

  it('restores Current after remounting an interrupted return instead of reusing stale messages', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint(
      'wf-42',
      [{ id: 'wf-42', name: 'current' }],
      [
        agentThread({
          id: 'th-1',
          title: 'Current chat',
          last_message_at: '2026-09-25T00:00:00Z'
        })
      ]
    )
    const first = renderWithSelectedTarget()
    await sendFromComposer('Before closing the panel')
    workflowStore.activeWorkflow = addTab('workflows/other.json')
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValueOnce(false)
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Current chat' })
    )
    await screen.findByRole('alert')
    first.unmount()
    await nextTick()

    let finishHistory = () => {}
    const pendingHistory = new Promise<void>((resolve) => {
      finishHistory = resolve
    })
    const messages: AgentMessages = [
      {
        id: 'later',
        thread_id: 'th-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'later',
        workflow_id: 'wf-42',
        content: { text: 'Server update while panel closed' }
      }
    ]
    respondToFetch(/\/messages/, async () => {
      await pendingHistory
      return json(200, messages)
    })
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Current chat' })
    )
    expect(
      screen.getByRole('button', { name: 'Current chat' })
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    finishHistory()
    expect(await screen.findByTestId('user-message-bubble')).toHaveTextContent(
      'Server update while panel closed'
    )
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
  })

  it('switches between historical chats with open targets without refetching known Cloud identities', async () => {
    makeTab('wf-current')
    const other = addTab('workflows/other.json')
    mockMessagesEndpoint(
      'wf-current',
      [
        { id: 'wf-current', name: 'current' },
        { id: 'wf-other', name: 'other' }
      ],
      ['th-current', 'th-other'].map((id) =>
        agentThread({ id, title: id, last_message_at: '2026-09-25T00:00:00Z' })
      )
    )
    const originalFetch = vi.mocked(fetch).getMockImplementation()
    assert.exists(originalFetch)
    let identitiesFetched = false
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/workflows')) {
        if (identitiesFetched) return new Promise<Response>(() => {})
        identitiesFetched = true
      }
      if (url.includes('/messages')) {
        const threadId = url.includes('/th-other/') ? 'th-other' : 'th-current'
        const messages: AgentMessages = [
          {
            id: `message-${threadId}`,
            thread_id: threadId,
            seq: 1,
            role: 'user',
            status: 'complete',
            turn_id: `turn-${threadId}`,
            workflow_id: threadId === 'th-other' ? 'wf-other' : 'wf-current',
            content: { text: `Transcript of ${threadId}` }
          }
        ]
        return Promise.resolve(json(200, messages))
      }
      return originalFetch(input, init)
    })
    renderWithSelectedTarget()
    for (const threadId of ['th-current', 'th-other']) {
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: threadId })
      )
      expect(
        await screen.findByTestId('user-message-bubble')
      ).toHaveTextContent(`Transcript of ${threadId}`)
      expect(useAgentChatHistoryStore().activeId).toBe(threadId)
      expect(screen.getByRole('button', { name: threadId })).toBeInTheDocument()
    }

    expect(workflowStore.activeWorkflow?.path).toBe(other.path)
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    expect(fetchRequests(/\/workflows/).length).toBeLessThanOrEqual(1)
    expect(useToast().toasts).toHaveLength(0)
  })

  it.for([null, 'th-current'])(
    'reopens a saved workflow from chat history while keeping %s current until ready',
    async (previousThread) => {
      makeTab('wf-current')
      const saved = addTab('workflows/portrait.json')
      await workflowStore.closeWorkflow(saved)
      let finishHistory = () => {}
      const historyReady = new Promise<void>((resolve) => {
        finishHistory = resolve
      })
      let finishOpening = () => {}
      const workflowReady = new Promise<void>((resolve) => {
        finishOpening = resolve
      })
      const openWorkflow = vi.mocked(useWorkflowService().openWorkflow)
      const open = openWorkflow.getMockImplementation()
      assert.exists(open)
      openWorkflow.mockImplementationOnce(async (...args) => {
        await workflowReady
        return open(...args)
      })
      const bodies: unknown[] = []
      const messages: AgentMessages = [
        {
          id: 'history-user',
          thread_id: 'th-history',
          seq: 1,
          role: 'user',
          status: 'complete',
          turn_id: 'history-turn',
          workflow_id: 'wf-portrait',
          content: { text: 'Earlier portrait request' }
        }
      ]
      vi.mocked(fetch).mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)

          if (url.includes('/messages') && init?.method === 'POST') {
            bodies.push(JSON.parse(String(init.body)))
            return json(202, ack('wf-portrait'))
          }
          if (url.includes('/th-current/messages')) return json(200, [])
          if (url.includes('/messages')) {
            await historyReady
            return json(200, messages)
          }
          if (url.includes('/workflows'))
            return json(200, {
              data: [{ id: 'wf-portrait', name: 'portrait' }],
              pagination: { offset: 0, limit: 100, total: 1, has_more: false }
            })
          return json(
            200,
            agentThreadList([
              ...(previousThread === null
                ? []
                : [
                    agentThread({
                      id: previousThread,
                      title: 'Current chat',
                      last_message_at: '2026-09-25T01:00:00Z'
                    })
                  ]),
              agentThread({
                id: 'th-history',
                title: 'Portrait chat',
                last_message_at: '2026-09-25T00:00:00Z'
              })
            ])
          )
        }
      )
      useAgentConversationStore().setThreadId(previousThread)
      renderWithSelectedTarget()
      const history = useAgentChatHistoryStore()
      await vi.waitFor(() => expect(history.activeId).toBe(previousThread))
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Portrait chat'))

      expect(
        screen.getByRole('button', { name: 'Portrait chat' })
      ).toHaveAttribute('aria-busy', 'true')
      expect(
        screen.getByRole('heading', { name: 'Chat history' })
      ).toBeVisible()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(history.grouped.current.map(({ id }) => id)).toEqual(
        previousThread === null ? [] : [previousThread]
      )
      expect(workflowStore.activeWorkflow?.path).toBe('workflows/current.json')
      finishHistory()
      await vi.waitFor(() => expect(openWorkflow).toHaveBeenCalled())
      expect(
        screen.getByRole('heading', { name: 'Chat history' })
      ).toBeVisible()
      expect(history.grouped.current.map(({ id }) => id)).toEqual(
        previousThread === null ? [] : [previousThread]
      )
      expect(
        screen.queryByText('Earlier portrait request')
      ).not.toBeInTheDocument()
      expect(workflowStore.activeWorkflow?.path).toBe('workflows/current.json')
      finishOpening()

      await vi.waitFor(() => {
        expect(workflowStore.activeWorkflow?.path).toBe(saved.path)
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(saved.path)
        expect(useAgentChatHistoryStore().activeId).toBe('th-history')
      })
      expect(workflowStore.openWorkflows.map(({ path }) => path)).toEqual([
        'workflows/current.json',
        'workflows/portrait.json'
      ])
      expect(useToast().toasts).toHaveLength(0)
      await sendFromComposer('Continue the portrait')
      expect(bodies[0]).toMatchObject({ workflow_id: 'wf-portrait' })
      expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
    }
  )

  it.for([
    { previous: null, outcome: 'pending' },
    { previous: null, outcome: 'failed' },
    { previous: 'th-current', outcome: 'pending' },
    { previous: 'th-current', outcome: 'failed' }
  ])(
    'keeps an unfinished history selection hidden after remount: %o',
    async ({ previous, outcome }) => {
      makeTab('wf-current')
      const saved = addTab('workflows/portrait.json')
      await workflowStore.closeWorkflow(saved)
      useAgentConversationStore().setThreadId(previous)
      if (previous)
        localStorage.setItem(StorageKeys.agentThread('personal'), previous)
      let finishOpening = () => {}
      const opening = new Promise<boolean>((resolve) => {
        finishOpening = () => resolve(false)
      })
      const openWorkflow = vi.mocked(useWorkflowService().openWorkflow)
      openWorkflow.mockReturnValueOnce(opening)
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/th-current/messages')) return json(200, [])
        if (url.includes('/messages'))
          return json(200, [
            {
              id: 'history-user',
              thread_id: 'th-history',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'history-turn',
              workflow_id: 'wf-portrait',
              content: { text: 'Earlier portrait request' }
            }
          ])
        if (url.includes('/workflows'))
          return json(200, {
            data: [{ id: 'wf-portrait', name: 'portrait' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        return json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-history',
              title: 'Portrait chat',
              last_message_at: '2026-09-25T00:00:00Z'
            })
          ])
        )
      })
      const first = renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', { name: 'Show chat history' })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Portrait chat' })
      )
      await vi.waitFor(() => expect(openWorkflow).toHaveBeenCalledOnce())
      if (outcome === 'failed') {
        finishOpening()
        await screen.findByRole('alert')
      }
      first.unmount()
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      finishOpening()
      await opening
      await nextTick()

      expect(
        screen.getByRole('heading', { name: 'Chat history' })
      ).toBeVisible()
      expect(
        screen.queryByText('Earlier portrait request')
      ).not.toBeInTheDocument()
      expect(useAgentChatHistoryStore().activeId).toBe(previous)
      expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
        previous
      )
      if (outcome === 'pending') {
        await userEvent.click(
          screen.getByRole('button', { name: 'Back to previous chat' })
        )
        await screen.findByRole('button', { name: 'Show chat history' })
        expect(useAgentChatHistoryStore().activeId).toBe(previous)
        expect(workflowStore.activeWorkflow?.path).toBe(
          'workflows/current.json'
        )
        expect(
          screen.queryByText('Earlier portrait request')
        ).not.toBeInTheDocument()
        return
      }
      await userEvent.click(
        screen.getByRole('button', { name: 'Portrait chat' })
      )
      await screen.findAllByText('Earlier portrait request')
      expect(useAgentChatHistoryStore().activeId).toBe('th-history')
      expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
        'th-history'
      )
      expect(workflowStore.activeWorkflow?.path).toBe(saved.path)
    }
  )

  it.for([
    { failure: 'missing messages', status: 404, listingStatus: 200 },
    { failure: 'message server error', status: 500, listingStatus: 200 },
    { failure: 'failed workflow listing', status: 200, listingStatus: 500 }
  ])(
    'preserves Current after deleting a chat with $failure',
    async ({ status, listingStatus }) => {
      makeTab('wf-current')
      useAgentConversationStore().setThreadId('th-current')
      localStorage.setItem(StorageKeys.agentThread('personal'), 'th-current')
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/th-failed/messages'))
          return json(status, [
            {
              id: 'failed-user',
              thread_id: 'th-failed',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'failed-turn',
              workflow_id: 'wf-unavailable',
              content: { text: 'Failed request' }
            }
          ] satisfies AgentMessages)
        if (url.includes('/messages'))
          return json(200, [
            {
              id: 'current-user',
              thread_id: 'th-current',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'current-turn',
              content: { text: 'Current request' }
            }
          ])
        if (url.includes('/workflows'))
          return json(listingStatus, {
            data: [],
            pagination: { offset: 0, limit: 100, total: 0, has_more: false }
          })
        return json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-current',
              title: 'Current chat',
              last_message_at: '2026-09-25T01:00:00Z'
            }),
            agentThread({
              id: 'th-failed',
              title: 'Failed chat',
              last_message_at: '2026-09-25T00:00:00Z'
            })
          ])
        )
      })
      const first = renderWithSelectedTarget()
      await screen.findAllByText('Current request')
      await userEvent.click(
        screen.getByRole('button', { name: 'Show chat history' })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Failed chat' })
      )
      await screen.findByRole('alert')
      await userEvent.click(
        screen.getAllByRole('button', {
          name: i18n.global.t('agent.chatOptions')
        })[1]
      )
      await userEvent.click(
        await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
      )
      expect(useAgentChatHistoryStore().activeId).toBe('th-current')
      expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
        'th-current'
      )
      first.unmount()
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await nextTick()

      expect(
        screen.getByRole('heading', { name: 'Chat history' })
      ).toBeVisible()
      expect(useAgentChatHistoryStore().activeId).toBe('th-current')
      expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
        'th-current'
      )
      expect(
        screen.queryByRole('button', { name: 'Failed chat' })
      ).not.toBeInTheDocument()
      await userEvent.click(
        screen.getByRole('button', { name: 'Back to previous chat' })
      )
      await screen.findAllByText('Current request')
      expect(useAgentChatHistoryStore().activeId).toBe('th-current')
      expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
        'th-current'
      )
      expect(screen.queryByText('Failed request')).not.toBeInTheDocument()
    }
  )

  it('restores an agent-minted draft target after reload and keeps its Cloud identity on send', async () => {
    const draftGraphId = '3d4d7f1e-3c8b-4a0a-9a3c-1d2e3f4a5b6c'
    localStorage.setItem(
      StorageKeys.agentWorkflowTabBindings('personal'),
      JSON.stringify({
        'wf-minted': {
          tabPath: 'workflows/minted.json',
          graphId: draftGraphId,
          confirmedAt: Date.now()
        }
      })
    )
    const restored = addTab('workflows/minted.json', {
      isTemporary: true,
      activeState: fromPartial<ComfyWorkflowJSON>({ id: draftGraphId })
    })
    useAgentConversationStore().setThreadId('th-1')
    const bodies: unknown[] = []
    const history: AgentMessages = [
      {
        id: 'row',
        thread_id: 'th-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn',
        workflow_id: 'wf-minted',
        content: { text: 'Earlier request' }
      }
    ]
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)))
          return json(202, ack('wf-minted'))
        }
        if (url.includes('/messages')) return json(200, history)
        if (url.includes('/workflows'))
          return json(200, {
            data: [{ id: 'wf-minted', name: 'minted' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        return json(200, agentThreadList())
      }
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow).toEqual(restored)
    )
    expect(useToast().toasts).toHaveLength(0)
    await sendFromComposer('continue editing')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-minted',
      open_tabs: [{ workflow_id: 'wf-minted', name: 'minted' }]
    })
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
  })

  it('binds the session to the workflow its transcript restored', async () => {
    const restored = addTab('workflows/restored.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'graph-restored' })
    })
    useAgentConversationStore().setThreadId('th-1')
    const history: AgentMessages = [
      {
        id: 'row',
        thread_id: 'th-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn',
        workflow_id: 'wf-restored',
        content: { text: 'Earlier request' }
      }
    ]
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(200, history)
      if (url.includes('/workflows'))
        return json(200, {
          data: [{ id: 'wf-restored', name: 'restored' }],
          pagination: { offset: 0, limit: 100, total: 1, has_more: false }
        })
      return json(200, agentThreadList())
    })

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow).toEqual(restored)
    )
    await vi.waitFor(() =>
      expect(docOpMinterDeps.current?.isDocBound()).toBe(true)
    )
    expect(useToast().toasts).toHaveLength(0)
  })

  it('leaves the restored workflow unbound while its canvas holds edits the shared document may lack', async () => {
    const restored = addTab('workflows/unsynced.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'graph-unsynced' })
    })
    useAgentConversationStore().setThreadId('th-1')
    const history: AgentMessages = [
      {
        id: 'row',
        thread_id: 'th-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn',
        workflow_id: 'wf-unsynced',
        content: { text: 'Earlier request' }
      }
    ]
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(200, history)
      if (url.includes('/workflows'))
        return json(200, {
          data: [{ id: 'wf-unsynced', name: 'unsynced' }],
          pagination: { offset: 0, limit: 100, total: 1, has_more: false }
        })
      return json(200, agentThreadList())
    })
    recordUnsyncedHumanOps('previous-panel', ['wf-unsynced'])

    try {
      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      await vi.waitFor(() =>
        expect(useAgentPanelStore().selectedWorkflow).toEqual(restored)
      )
      await screen.findAllByText('Earlier request')
      await vi.waitFor(() =>
        expect(useAgentChatHistoryStore().activeId).toBe('th-1')
      )
      expect(docOpMinterDeps.current?.boundRootGraphId()).toBeNull()
      expect(docOpMinterDeps.current?.isDocBound()).toBe(false)
    } finally {
      recordUnsyncedHumanOps('previous-panel', [])
    }
  })

  it('binds the session to the workflow a history thread restored, not only a reload', async () => {
    makeTab('wf-42')
    const old = addTab('workflows/old.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'graph-old' })
    })
    useAgentWorkflowTabBindingStore().bind('wf-old', old.path)
    const history: AgentMessages = [
      {
        id: 'row',
        thread_id: 'th-history',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn',
        workflow_id: 'wf-old',
        content: { text: 'Historical prompt' }
      }
    ]
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(200, history)
      if (url.includes('/workflows'))
        return json(200, {
          data: [{ id: 'wf-old', name: 'old' }],
          pagination: { offset: 0, limit: 100, total: 1, has_more: false }
        })
      return json(
        200,
        agentThreadList([
          agentThread({
            id: 'th-history',
            title: 'Earlier chat',
            last_message_at: '2026-09-01T00:00:00Z'
          })
        ])
      )
    })
    renderWithSelectedTarget()
    expect(docOpMinterDeps.current?.isDocBound()).toBe(false)

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await userEvent.click(await screen.findByText('Earlier chat'))
    await screen.findAllByText('Historical prompt')

    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(old.path)
    )
    await vi.waitFor(() =>
      expect(docOpMinterDeps.current?.isDocBound()).toBe(true)
    )
    expect(workflowStore.activeWorkflow?.path).toBe(old.path)
    expect(useToast().toasts).toHaveLength(0)
  })

  it('leaves the session unbound when its transcript restores nothing', async () => {
    useAgentConversationStore().setThreadId('th-1')
    const history: AgentMessages = [
      {
        id: 'row',
        thread_id: 'th-1',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn',
        content: { text: 'Earlier request' }
      }
    ]
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(200, history)
      if (url.includes('/workflows'))
        return json(200, {
          data: [],
          pagination: { offset: 0, limit: 100, total: 0, has_more: false }
        })
      return json(200, agentThreadList())
    })

    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await screen.findAllByText('Earlier request')
    await nextTick()
    expect(docOpMinterDeps.current?.isDocBound()).toBe(false)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it.for(['wf-old', '', 'missing'])(
    'retains the explicit target when reopening history for %s',
    async (restoredId) => {
      const current = makeTab('wf-42')
      const old = addTab('workflows/old.json')
      useAgentWorkflowTabBindingStore().bind('wf-old', old.path)
      useAgentConversationStore().setThreadId('th-1')
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/messages'))
          return json(200, [
            {
              id: 'row',
              thread_id: 'th-1',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'turn',
              workflow_id: restoredId,
              content: { text: 'Restored prompt' }
            }
          ])
        if (url.includes('/workflows'))
          return json(200, {
            data: [],
            pagination: { offset: 0, limit: 100, total: 0, has_more: false }
          })
        return json(200, agentThreadList())
      })
      renderWithSelectedTarget()
      await screen.findAllByText('Restored prompt')
      await nextTick()
      expect(useAgentPanelStore().selectedWorkflow).toEqual(current)
      expect(workflowStore.activeWorkflow).toEqual(current)
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(useToast().toasts).toHaveLength(0)
    }
  )

  it.for(['hidden', 'reopened'] as const)(
    'keeps a target closed while the panel is %s cleared after history hydration',
    async (panelState) => {
      const target = makeTab('wf-42')
      const old = addTab('workflows/old.json')
      const viewed = addTab('workflows/viewed.json')
      useAgentWorkflowTabBindingStore().bind('wf-old', old.path)
      useAgentConversationStore().setThreadId('th-1')
      let reads = 0
      let finishHistory = () => {}
      const pendingHistory = new Promise<void>((resolve) => {
        finishHistory = resolve
      })
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/messages')) {
          const read = ++reads
          if (read === 2) await pendingHistory
          const messages: AgentMessages = [
            {
              id: 'row',
              thread_id: 'th-1',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'turn',
              workflow_id: 'wf-old',
              content: { text: `History loaded ${read}` }
            }
          ]
          return json(200, messages)
        }
        if (url.includes('/assets'))
          return json(200, { assets: [], total: 0, has_more: false })
        if (url.includes('/workflows'))
          return json(200, {
            data: [{ id: 'wf-old', name: 'old' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        return json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-1',
              title: 'Earlier chat',
              last_message_at: '2026-09-01T00:00:00Z'
            })
          ])
        )
      })
      const first = render(AgentPanelRoot, { global: { plugins: [i18n] } })
      const selector = () =>
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      await vi.waitFor(() => expect(selector()).toHaveTextContent('old'))
      await userEvent.click(selector())
      await userEvent.click(
        await screen.findByRole('menuitemradio', { name: 'current' })
      )
      await vi.waitFor(() => expect(selector()).toHaveTextContent('current'))
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('Keep this draft')
      workflowStore.activeWorkflow = viewed
      first.unmount()
      if (panelState === 'hidden') await workflowStore.closeWorkflow(target)
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      await vi.waitFor(() => expect(reads).toBe(2))
      if (panelState === 'reopened') await workflowStore.closeWorkflow(target)
      finishHistory()
      await screen.findAllByText('History loaded 2')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(await screen.findByRole('menu')).toBeVisible()
      await userEvent.keyboard('{Escape}')
      expect(selector()).toHaveTextContent(
        i18n.global.t('agent.selectWorkflowForAgent')
      )
      expect(workflowStore.activeWorkflow).toEqual(viewed)
      expect(screen.getByRole('textbox')).toHaveTextContent('Keep this draft')
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Earlier chat'))
      await screen.findAllByText('History loaded 3')
      await vi.waitFor(() => expect(selector()).toHaveTextContent('old'))
      expect(workflowStore.activeWorkflow).toEqual(old)
    }
  )

  it('opens a history chat whose workflow the Cloud no longer lists and marks its target unavailable', async () => {
    makeTab('wf-42')
    stubHistoryWithWorkflowListing(200)
    renderWithSelectedTarget()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await userEvent.click(await screen.findByText('Earlier chat'))

    await screen.findAllByText('Historical prompt')
    expect(
      screen.getByText(i18n.global.t('agent.targetWorkflowUnavailable'))
    ).toBeVisible()
    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
    expect(useAgentChatHistoryStore().activeId).toBe('th-history')
    expect(localStorage.getItem(StorageKeys.agentThread('personal'))).toBe(
      'th-history'
    )
    expect(useToast().toasts).not.toContainEqual(
      expect.objectContaining({ kind: 'warning' })
    )

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(
      screen.queryByText(i18n.global.t('agent.targetWorkflowUnavailable'))
    ).not.toBeInTheDocument()
  })

  it('says the target workflow is no longer available after the user deletes it', async () => {
    const target = addTab('workflows/current.json', {
      delete: vi.fn(async () => {})
    })
    workflowStore.activeWorkflow = target
    useAgentWorkflowTabBindingStore().bind('wf-42', target.path)
    const other = addTab('workflows/other.json')
    renderWithSelectedTarget()
    workflowStore.activeWorkflow = other

    await workflowStore.closeWorkflow(target)
    await workflowStore.deleteWorkflow(target)

    expect(
      await screen.findByText(i18n.global.t('agent.targetWorkflowUnavailable'))
    ).toBeVisible()
    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
  })

  it.for([
    {
      listing: 'omits the workflow',
      listingStatus: 200,
      notices: [i18n.global.t('agent.targetWorkflowUnavailable')],
      toasts: [],
      current: 'th-history'
    },
    {
      listing: 'fails',
      listingStatus: 500,
      notices: [],
      toasts: [i18n.global.t('agent.targetWorkflowOpenFailed')],
      current: null
    }
  ])(
    'restores a stored chat on startup when the workflow listing $listing',
    async ({ listingStatus, notices, toasts, current }) => {
      makeTab('wf-42')
      useAgentConversationStore().setThreadId('th-history')
      localStorage.setItem(StorageKeys.agentThread('personal'), 'th-history')
      stubHistoryWithWorkflowListing(listingStatus)
      render(AgentPanelRoot, { global: { plugins: [i18n] } })

      await screen.findAllByText('Historical prompt')
      await vi.waitFor(() => {
        expect(
          useToast().toasts.flatMap((toast) =>
            toast.kind === 'warning' ? [toast.title] : []
          )
        ).toEqual(toasts)
        expect(
          screen
            .queryAllByText(i18n.global.t('agent.targetWorkflowUnavailable'))
            .map((notice) => notice.textContent.trim())
        ).toEqual(notices)
      })
      expect(useAgentPanelStore().selectedWorkflow).toBeNull()
      expect(useAgentChatHistoryStore().activeId).toBe(current)
    }
  )

  it('does not mark a stored chat Current when its messages fail to load on startup', async () => {
    telemetry.trackAgentError.mockClear()
    makeTab('wf-42')
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-history')
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(500, { error: 'down' })
      if (url.includes('/agent/threads'))
        return json(
          200,
          agentThreadList([
            agentThread({
              id: 'th-history',
              title: 'Earlier chat',
              last_message_at: '2026-09-01T00:00:00Z'
            })
          ])
        )
      return json(200, {})
    })
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    await vi.waitFor(() =>
      expect(telemetry.trackAgentError).toHaveBeenCalledWith(
        expect.objectContaining({ error_class: 'history_load_failed' })
      )
    )
    expect(useAgentChatHistoryStore().activeId).toBeNull()
  })

  it('toasts a startup restoration failure that lands while history is open without a selection', async () => {
    let failListing = () => {}
    const listing = new Promise<number>((resolve) => {
      failListing = () => resolve(500)
    })
    makeTab('wf-42')
    useAgentConversationStore().setThreadId('th-history')
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-history')
    stubHistoryWithWorkflowListing(listing)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await screen.findAllByText('Historical prompt')
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.showChatHistory')
      })
    )
    await screen.findByRole('heading', { name: 'Chat history' })

    failListing()

    await vi.waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'warning',
          title: i18n.global.t('agent.targetWorkflowOpenFailed')
        })
      )
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.for(['false', 'throw', 'missing-id'])(
    'handles a history restoration with %s without showing an unready chat',
    async (outcome) => {
      makeTab('wf-42')
      const other = addTab('workflows/history-target.json')
      useAgentWorkflowTabBindingStore().bind('wf-history', other.path)
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/messages'))
          return json(200, [
            {
              id: 'history-user',
              thread_id: 'th-history',
              seq: 1,
              role: 'user',
              status: 'complete',
              turn_id: 'history-turn',
              ...(outcome === 'missing-id'
                ? {}
                : { workflow_id: 'wf-history' }),
              content: { text: 'Historical prompt' }
            }
          ])
        if (url.includes('/agent/threads'))
          return json(
            200,
            agentThreadList([
              agentThread({
                id: 'th-history',
                title: 'Earlier chat',
                last_message_at: '2026-09-01T00:00:00Z'
              })
            ])
          )
        if (url.includes('/workflows'))
          return json(200, {
            data: [{ id: 'wf-history', name: 'history-target' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        return json(200, {})
      })
      if (outcome === 'false')
        vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(
          false
        )
      if (outcome === 'throw')
        vi.mocked(useWorkflowService()).openWorkflow.mockRejectedValueOnce(
          new Error('unavailable')
        )
      renderWithSelectedTarget()
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.showChatHistory')
        })
      )
      await userEvent.click(await screen.findByText('Earlier chat'))
      if (outcome !== 'missing-id') {
        expect(await screen.findByRole('alert')).toHaveTextContent(
          i18n.global.t('agent.historyOpenFailed')
        )
        expect(
          screen.getByRole('heading', { name: 'Chat history' })
        ).toBeVisible()
        expect(screen.queryByText('Historical prompt')).not.toBeInTheDocument()
        expect(useToast().toasts).not.toContainEqual(
          expect.objectContaining({ kind: 'warning' })
        )
        expect(useAgentPanelStore().selectedWorkflow).toBeNull()
        expect(useAgentChatHistoryStore().activeId).toBeNull()
        await userEvent.click(
          screen.getByRole('button', { name: 'Earlier chat' })
        )
        await screen.findAllByText('Historical prompt')
        expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
        expect(workflowStore.activeWorkflow?.path).toBe(other.path)
        expect(useAgentChatHistoryStore().activeId).toBe('th-history')
      } else {
        await screen.findAllByText('Historical prompt')
        expect(useAgentPanelStore().selectedWorkflow).toBeNull()
        expect(
          screen.getByRole('button', {
            name: i18n.global.t('agent.switchWorkflow')
          })
        ).toHaveTextContent(i18n.global.t('agent.selectWorkflowForAgent'))
      }
    }
  )

  it('does not commit a pending selection after its tab closes', async () => {
    const current = makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    mockMessagesEndpoint('wf-scratch')
    let finishSave = () => {}
    const saved = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
      async () => {
        await saved
        Object.assign(scratch, { isTemporary: false })
        return true
      }
    )
    renderWithSelectedTarget()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'scratch' })
    )
    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledOnce()
    await workflowStore.closeWorkflow(scratch)
    finishSave()
    await saved
    await nextTick()
    expect(scratch.isTemporary).toBe(false)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(scratch.path)
    ).toBeUndefined()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(current.path)
  })

  it('promotes a reference to target without changing earlier message references', async () => {
    const {
      references: [b]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [
        { path: 'workflows/reference-b.json', workflowId: 'wf-b' },
        { path: 'workflows/reference-c.json', workflowId: 'wf-c' }
      ]
    })
    const bodies = mockMessagesEndpoint('wf-b')
    renderWithSelectedTarget()
    const oldTurn = 'previous-turn' as TurnId
    const conversation = useAgentConversationStore()
    conversation.startTurn(oldTurn)
    conversation.recordUser(oldTurn, 'Earlier prompt', undefined, undefined, [
      { id: 'wf-b', name: 'reference-b', textOffset: 0 }
    ])
    conversation.ingest({
      type: 'agent_message_done',
      data: { message_id: oldTurn, thread_id: 'th-1' }
    })
    for (const name of ['reference-b', 'reference-c']) {
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('@')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(await screen.findByRole('menuitem', { name }))
    }
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'reference-b' })
    )
    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(b.path)
    )
    const composer = screen.getByTestId('composer-inline-input')
    expect(
      within(composer).queryByRole('button', { name: 'Open reference-b' })
    ).toBeNull()
    expect(
      within(composer).getByRole('button', { name: 'Open reference-c' })
    ).toBeVisible()
    await sendFromComposer('Use C to edit B')
    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-b',
      workflow_references: [{ workflow_id: 'wf-c', name: 'reference-c' }]
    })
    expect(
      conversation.entries.find(
        (entry) => entry.role === 'user' && entry.text === 'Earlier prompt'
      )
    ).toMatchObject({
      workflowReferences: [{ id: 'wf-b', name: 'reference-b' }]
    })
  })

  it('keeps the old target when the selected workflow cannot open', async () => {
    setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    mockMessagesEndpoint('wf-42')
    vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(false)
    renderWithSelectedTarget()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'other' })
    )
    await vi.waitFor(() => expect(useToast().toasts).toHaveLength(1))
    expect(screen.getByRole('menuitemradio', { name: 'current' })).toBeChecked()
  })

  it('retains an explicitly chosen target across a plain panel reopen', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    const { unmount } = render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'current' })
    )
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('current')
  })

  // PM-1321/PM-1322: onNewChat() used to leave the previous chat's target in
  // place, so "in this workflow" silently kept acting on a tab that was no
  // longer on screen. A new chat now targets whatever tab is active when it
  // starts, matching onSelectHistory()'s reset-then-restore pattern.
  it('retargets New Chat to the tab now on screen instead of the old chat target', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'current' })
    )
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    workflowStore.activeWorkflow = addTab('workflows/other.json')
    await nextTick()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('other')
  })

  it('clears the New Chat target when no tab is open', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()
    expect(await screen.findAllByText('current')).not.toHaveLength(0)

    await useWorkflowService().closeWorkflow(workflowStore.activeWorkflow!)
    await nextTick()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent(i18n.global.t('agent.selectWorkflowForAgent'))
  })

  // PM-1415: the same fix must cover a brand new, still-unsaved tab, not just
  // switching to an already-open one - activeWorkflow tracks whichever tab is
  // on screen regardless of isTemporary.
  it('retargets New Chat to a freshly created, unsaved tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'current' })
    )
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    workflowStore.activeWorkflow = addTab('workflows/new-tab.json', {
      isTemporary: true
    })
    await nextTick()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('new-tab')
  })

  it('keeps the selected Agent target when the visible graph tab changes after Send', async () => {
    const {
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const bodies = mockMessagesEndpoint('wf-42')

    renderWithSelectedTarget()
    await sendFromComposer('start editing current')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    workflowStore.activeWorkflow = other
    await nextTick()

    expect(await screen.findAllByText('current')).not.toHaveLength(0)
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    const visibleRow = within(
      await screen.findByRole('group', { name: 'Current tab' })
    ).getByRole('menuitemradio')
    const targetRow = within(
      screen.getByRole('group', { name: 'Other open workflows' })
    ).getByRole('menuitemradio')
    expect(visibleRow).toHaveTextContent('other')
    expect(visibleRow).not.toBeChecked()
    expect(targetRow).toHaveTextContent('current')
    expect(targetRow).toBeChecked()
    await userEvent.keyboard('{Escape}')

    await sendFromComposer('keep editing current')
    expect(bodies[1]).toMatchObject({
      workflow_id: 'wf-42',

      open_tabs: [
        { workflow_id: 'wf-42', name: 'current' },
        { workflow_id: 'wf-other', name: 'other' }
      ],
      workflow_references: []
    })
  })

  it('hides the active workflow in history and restores it on return', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    renderWithSelectedTarget()
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
    useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
    mockMessagesEndpoint('wf-42')

    renderWithSelectedTarget()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByText('other'))

    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(other)
    )
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('other')
  })

  it.for([true, false])(
    'only waits for the Cloud index when target identity is missing (bound: %s)',
    async (hasBinding) => {
      makeTab('wf-42')
      const other = addTab('workflows/other.json')
      if (hasBinding)
        useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
      let finishLookup = () => {}
      const pendingLookup = new Promise<void>((resolve) => {
        finishLookup = resolve
      })
      let lookupCount = 0
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/workflows')) {
          lookupCount++
          await pendingLookup
          return json(200, {
            data: [{ id: 'wf-other', name: 'other' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        }
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        return json(200, {})
      })
      renderWithSelectedTarget()
      await vi.waitFor(() => expect(lookupCount).toBe(1))
      try {
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.switchWorkflow')
          })
        )
        await userEvent.click(
          await screen.findByRole('menuitemradio', { name: 'other' })
        )
        if (hasBinding) {
          await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
          expect(lookupCount).toBe(1)
        } else {
          await vi.waitFor(() => expect(lookupCount).toBe(2))
          expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
          expect(
            screen.getByRole('menuitemradio', { name: 'current' })
          ).toBeChecked()
          finishLookup()
          await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
        }
        expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(other)
        expect(
          screen.getByRole('button', {
            name: i18n.global.t('agent.switchWorkflow')
          })
        ).toHaveTextContent('other')
      } finally {
        finishLookup()
        await pendingLookup
        await nextTick()
      }
    }
  )

  it.for(['binding', 'cloud index', 'temporary binding'] as const)(
    'selects an existing Cloud workflow without saving its edits via %s',
    async (identitySource) => {
      makeTab('wf-42')
      const draft = fromPartial<ComfyWorkflowJSON>({
        id: 'local-graph-id',
        nodes: [
          { id: 91, type: 'CLIPTextEncode', widgets_values: ['latest edit'] }
        ]
      })
      const other = addTab('workflows/other.json', {
        isTemporary: identitySource === 'temporary binding',
        isModified: true,
        activeState: draft
      })
      if (identitySource !== 'cloud index')
        useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
      const bodies = mockMessagesEndpoint(
        'wf-other',
        identitySource === 'cloud index'
          ? [{ id: 'wf-other', name: 'other' }]
          : []
      )
      renderWithSelectedTarget()

      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      )
      await userEvent.click(
        await screen.findByRole('menuitemradio', { name: 'other' })
      )
      await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      ).toHaveTextContent('other')
      expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalled()
      expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
      expect(other.isModified).toBe(true)

      await sendFromComposer('use my latest edits')
      expect(bodies[0]).toMatchObject({
        workflow_id: 'wf-other',

        draft: { content: draft }
      })
    }
  )

  it('automatically numbers a Cloud name collision before changing target and view', async () => {
    makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    mockMessagesEndpoint('wf-scratch', () => [
      { id: 'wf-existing', name: 'scratch' },
      ...(!scratch.isTemporary
        ? [{ id: 'wf-scratch', name: 'scratch (2)' }]
        : [])
    ])

    renderWithSelectedTarget()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(await screen.findByText('scratch'))

    await vi.waitFor(() =>
      expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledWith(
        scratch,
        {
          filename: 'scratch (2)'
        }
      )
    )
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(scratch)
    expect(workflowStore.activeWorkflow?.path).toBe(scratch.path)
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('scratch (2)')
  })

  it.for([
    ['unsuccessful save', false] as const,
    ['save failure', new Error('save failed')] as const
  ])('preserves target, view, and draft after %s', async ([_label, result]) => {
    const current = makeTab('wf-42')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    if (result instanceof Error)
      vi.mocked(useWorkflowService()).saveWorkflowAs.mockRejectedValueOnce(
        result
      )
    else
      vi.mocked(useWorkflowService()).saveWorkflowAs.mockResolvedValueOnce(
        result
      )
    mockMessagesEndpoint('wf-42')

    renderWithSelectedTarget()
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('keep this draft')
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(await screen.findByText('scratch'))

    await vi.waitFor(() =>
      expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledWith(
        scratch,
        {
          filename: 'scratch'
        }
      )
    )
    expect(workflowStore.activeWorkflow?.path).toBe(current.path)
    expect(useAgentComposerStore().draft).toBe('keep this draft')
    expect(screen.getByRole('menuitemradio', { name: 'current' })).toBeChecked()
  })

  it('transitions the bound tab from editing to modified when the turn completes', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })
    expect(activity.editingPaths.size).toBe(0)
    expect(activity.unseenModifiedPaths.has('workflows/current.json')).toBe(
      true
    )
  })

  it('clears the spinner and creating flags when the panel unmounts mid-turn', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    const { unmount } = renderWithSelectedTarget()
    await sendFromComposer('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])
    activity.setCreating(true)

    unmount()

    expect(activity.editingPaths.size).toBe(0)
    expect(activity.creatingTab).toBe(false)
  })

  it('holds the creating flag for 500 ms before an unbound agent tab materializes', async () => {
    makeTab('wf-42')
    let resolveLookup: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(202, ack('wf-42', 'm-1'))
      if (url.includes('/agent/threads')) return json(200, agentThreadList())
      if (url.includes('workflow_id=wf-new')) {
        return new Promise<Response>((resolve) => {
          resolveLookup = resolve
        })
      }
      return new Response('{}', { status: 200 })
    })

    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderAndSend('work here')
    vi.useFakeTimers({ shouldAdvanceTime: false })

    const activity = useWorkflowTabActivityStore()
    expect(activity.creatingTab).toBe(false)

    dispatchApiEvent('agent_active_tab', {
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
    expect(workflowStore.getWorkflowByPath('workflows/Fresh.json')).toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    expect(activity.creatingTab).toBe(false)
    expect(
      workflowStore.getWorkflowByPath('workflows/Fresh.json')
    ).not.toBeNull()
  })

  it('does not refresh the agent credential while a cloud turn runs', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderAndSend('keep going')
    vi.mocked(fetch).mockClear()

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000 + 1)

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    const refreshes = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('limit=1'))
    expect(refreshes).toEqual([])
  })

  it('lowers the creating flag when a newer focus event supersedes the fetch', async () => {
    const bound = makeTab('wf-42')
    let resolveLookup: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(202, ack('wf-42', 'm-1'))
      if (url.includes('/agent/threads')) return json(200, agentThreadList())
      if (url.includes('workflow_id=wf-new')) {
        return new Promise<Response>((resolve) => {
          resolveLookup = resolve
        })
      }
      return new Response('{}', { status: 200 })
    })

    await renderAndSend('work here')
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-new',
      name: 'Fresh',
      thread_id: 'th-1'
    })
    const activity = useWorkflowTabActivityStore()
    await vi.advanceTimersByTimeAsync(0)
    expect(activity.creatingTab).toBe(true)

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-42',
      thread_id: 'th-1'
    })
    resolveLookup?.(json(404, { error: 'none' }))

    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(bound)
    )
    expect(activity.creatingTab).toBe(false)
    expect(workflowStore.getWorkflowByPath('workflows/Fresh.json')).toBeNull()
  })

  it('pins the spinner to the tab that sent the turn, not the tab active at ack', async () => {
    makeTab('wf-42')
    const other = addTab('workflows/other.json')
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) {
        workflowStore.activeWorkflow = other
        return json(202, ack('wf-42', 'm-1'))
      }
      if (url.includes('/agent/threads')) return json(200, agentThreadList())
      return new Response('{}', { status: 200 })
    })

    await renderAndSend('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])
  })

  // PM-1575 regression: the canvas-sync gate was wired to
  // `agentPanelStore.enabled` (the panel feature flag), not to whether a CRDT
  // doc subscription is actually connected. This suite -- like
  // agentPanel.spec.ts and most of this file -- never sends a
  // `doc_subscribed` frame, so the follower never connects; with the wrong
  // gate, a mutating tool call's own successful frame was held at
  // 'streaming' forever, since nothing was ever going to call
  // `notifyCanvasCaughtUp()` to release it. The composing "Working..."
  // status (every part settled, turn still streaming) never appeared.
  it('settles a mutating tool call immediately when no CRDT doc subscription is connected', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add a node')

    dispatchApiEvent('agent_tool_call', {
      tool_call_id: 'call-add-node',
      tool_name: 'add_node',
      status: 'success',
      duration_ms: 90,
      thread_id: 'th-1',
      message_id: 'm-1'
    })

    expect(
      await screen.findByText(i18n.global.t('agent.working'))
    ).toBeInTheDocument()
  })

  it('marks a mismatched or switched-away canvas unavailable', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    const setCanvasSyncGate = vi.spyOn(
      useAgentConversationStore(),
      'setCanvasSyncGate'
    )

    await renderAndSend('add a node')

    const [gate] = setCanvasSyncGate.mock.calls.at(-1) ?? []
    expect(gate?.('wf-other')).toBe('unavailable')

    workflowStore.activeWorkflow = addTab('workflows/other.json')
    await nextTick()

    expect(gate?.('wf-42')).toBe('unavailable')
  })

  it('clears an empty-canvas correction when the thread changes', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('inspect this canvas')
    dispatchApiEvent('agent_tool_call', {
      tool_call_id: 'call-print-workflow',
      tool_name: 'print_workflow',
      status: 'success',
      duration_ms: 90,
      thread_id: 'th-1',
      message_id: 'm-1'
    })
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })

    expect(
      await screen.findByText(i18n.global.t('agent.canvasIsEmptyAfterTurn'))
    ).toBeVisible()

    useAgentConversationStore().setThreadId('th-next')
    await nextTick()

    expect(
      screen.queryByText(i18n.global.t('agent.canvasIsEmptyAfterTurn'))
    ).not.toBeInTheDocument()
  })

  type ToolOutcomes = [string, 'success' | 'error'][]

  function reportTools(tools: ToolOutcomes): void {
    tools.forEach(([toolName, status], index) => {
      dispatchApiEvent('agent_tool_call', {
        tool_call_id: `call-${index}-${toolName}`,
        tool_name: toolName,
        status,
        duration_ms: 90,
        thread_id: 'th-1',
        message_id: 'm-1'
      })
    })
  }

  it.for([
    { name: 'a single clear', tools: [['clear_canvas', 'success']] },
    {
      name: 'an inspect then clear',
      tools: [
        ['print_workflow', 'success'],
        ['clear_canvas', 'success']
      ]
    },
    {
      name: 'an add then clear',
      tools: [
        ['add_node', 'success'],
        ['clear_canvas', 'success']
      ]
    }
  ] satisfies { name: string; tools: ToolOutcomes }[])(
    'does not contradict an empty canvas after $name',
    async ({ tools }) => {
      makeTab('wf-42')
      mockMessagesEndpoint('wf-42')

      await renderAndSend('empty the canvas')
      reportTools(tools)
      dispatchApiEvent('agent_message_done', {
        message_id: 'm-1',
        thread_id: 'th-1'
      })

      expect(
        await screen.findByRole('button', {
          name: i18n.global.t('agent.worked')
        })
      ).toBeVisible()
      expect(
        screen.queryByText(i18n.global.t('agent.canvasIsEmptyAfterTurn'))
      ).not.toBeInTheDocument()
    }
  )

  it.for([
    {
      name: 'content was added after a clear',
      tools: [
        ['clear_canvas', 'success'],
        ['add_node', 'success']
      ]
    },
    {
      name: 'a clear after an add failed',
      tools: [
        ['add_node', 'success'],
        ['clear_canvas', 'error']
      ]
    },
    {
      name: 'nodes were added and one was deleted',
      tools: [
        ['add_node', 'success'],
        ['add_node', 'success'],
        ['delete_node', 'success']
      ]
    }
  ] satisfies { name: string; tools: ToolOutcomes }[])(
    'flags an empty canvas when $name',
    async ({ tools }) => {
      makeTab('wf-42')
      mockMessagesEndpoint('wf-42')

      await renderAndSend('build on the canvas')
      reportTools(tools)
      dispatchApiEvent('agent_message_done', {
        message_id: 'm-1',
        thread_id: 'th-1'
      })

      expect(
        await screen.findByText(i18n.global.t('agent.canvasIsEmptyAfterTurn'))
      ).toBeVisible()
    }
  )

  it('registers an Agent run job only when its workflow resolves', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('run this workflow')
    const registerJobOwner = vi.spyOn(useExecutionStore(), 'registerJobOwner')

    dispatchApiEvent('agent_tool_call', {
      tool_call_id: 'call-run',
      tool_name: 'run',
      status: 'success',
      duration_ms: 40,
      job_id: 'job-unknown-workflow',
      job_workflow_id: 'wf-unknown',
      thread_id: 'th-1',
      message_id: 'm-1'
    })

    expect(registerJobOwner).not.toHaveBeenCalled()

    dispatchApiEvent('agent_tool_call', {
      tool_call_id: 'call-run-known',
      tool_name: 'run',
      status: 'success',
      duration_ms: 40,
      job_id: 'job-known-workflow',
      job_workflow_id: 'wf-42',
      thread_id: 'th-1',
      message_id: 'm-1'
    })

    expect(registerJobOwner).toHaveBeenCalledExactlyOnceWith(
      'job-known-workflow',
      tab
    )
  })

  it('shows a sticky error toast when the doc-host permanently refuses the subscribe', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add a node')

    dispatchApiEvent('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-42',
      ok: false,
      code: 'schema_version_mismatch',
      message: 'Expected schema 2, found 1'
    })

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title: i18n.global.t('agent.workflowSyncFailedTitle'),
        description: `${i18n.global.t('agent.workflowSyncFailedDetail')} (Expected schema 2, found 1)`,
        duration: Number.POSITIVE_INFINITY
      })
    )
  })

  it('moves the spinner to the tab the agent creates mid-turn', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    const activity = useWorkflowTabActivityStore()
    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)

    await vi.waitFor(() =>
      expect([...activity.editingPaths]).toEqual(['workflows/Video test.json'])
    )
  })

  it('re-arms a resumed turn spinner on the bound tab, not the active tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    const { unmount } = renderWithSelectedTarget()
    await sendFromComposer('add an upscaler')

    const activity = useWorkflowTabActivityStore()
    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])

    unmount()
    expect(activity.editingPaths.size).toBe(0)

    const other = addTab('workflows/other.json')
    useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
    workflowStore.activeWorkflow = other
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/messages')) return json(200, [])
      if (url.includes('/agent/threads')) return json(200, agentThreadList())
      return new Response('{}', { status: 200 })
    })

    renderWithSelectedTarget()
    await vi.waitFor(() =>
      expect([...activity.editingPaths]).toEqual(['workflows/current.json'])
    )

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await vi.waitFor(() => expect(activity.editingPaths.size).toBe(0))
  })

  it("sends the active tab's saved workflow id with the turn", async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-42' })
    expect(bodies[0]).toMatchObject({ draft: { content: { id: 'wf-42' } } })
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('keeps sending the pinned target after viewing an unbound tab', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    await renderAndSend('first message')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    const scratch = addTab('workflows/scratch.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'local-scratch' })
    })
    workflowStore.activeWorkflow = scratch
    await sendFromComposer('second message')

    expect(bodies[1]).toMatchObject({ workflow_id: 'wf-42' })
    expect(bodies[1]).toHaveProperty('draft')
  })

  it('keeps an explicitly detached workflow after a remount', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    const panel = renderWithSelectedTarget()

    await sendFromComposer('attached turn')
    expect(bodies[0]).toHaveProperty('workflow_id', 'wf-42')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })
    useAgentPanelStore().setWorkflowTarget(null)

    panel.unmount()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const textbox = screen.getByRole('textbox')
    await userEvent.type(textbox, 'still detached')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(
      await screen.findByPlaceholderText(i18n.global.t('agent.searchWorkflows'))
    ).toHaveFocus()
    expect(bodies).toHaveLength(1)
  })

  it('re-attaches by picking a row so the next send carries the workflow again', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
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

  it('preserves the explicitly selected target when starting a new chat', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )

    expect(await screen.findAllByText('current')).not.toHaveLength(0)

    await sendFromComposer('fresh chat')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',

      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
  })

  it('keeps the draft and opens the workflow picker instead of posting without a target', async () => {
    const tab = makeTab('wf-42')
    workflowStore.activeWorkflow = null
    const bodies = mockMessagesEndpoint('wf-42')

    renderWithSelectedTarget()
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('do not lose this')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(bodies).toHaveLength(0)
    expect(useAgentComposerStore().draft).toBe('do not lose this')
    expect(
      screen.getByPlaceholderText(i18n.global.t('agent.searchWorkflows'))
    ).toBeVisible()
    expect(workflowStore.activeWorkflow).toBeNull()
    expect(tab.path).toBe('workflows/current.json')
  })

  it('a fresh-chat send re-arms the spinner on its preserved target', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    renderWithSelectedTarget()

    await sendFromComposer('attached turn')
    const activity = useWorkflowTabActivityStore()
    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await vi.waitFor(() => expect(activity.editingPaths.size).toBe(0))

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )
    await sendFromComposer('detached turn')

    expect([...activity.editingPaths]).toEqual(['workflows/current.json'])
  })

  it('agent_active_tab activates the bound tab', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-42',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(tab)
    )
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
    // The whole FE-1310 chain: wire event -> session -> store -> rendered card.
    expect(
      await screen.findByRole('button', { name: /^Open / })
    ).toBeInTheDocument()

    // Content sync rides the CRDT follower; activation never reloads the
    // canvas itself.
    expect(app.loadGraphData).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(useTelemetry()!.trackAgentWorkflowApplied).toHaveBeenCalledWith({
        workflow_id: 'wf-42',
        target: 'active_tab_switch'
      })
    )
  })

  it('agent_active_tab reports when a bound tab cannot be opened', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    await renderAndSend('work here')
    telemetry.trackAgentError.mockClear()
    vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(false)

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-42',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(telemetry.trackAgentError).toHaveBeenCalledWith(
        expect.objectContaining({
          error_class: 'workflow_open_failed',
          ui_treatment: 'toast'
        })
      )
    )
    expect(useTelemetry()!.trackAgentWorkflowApplied).not.toHaveBeenCalled()
  })

  // A browser tab closed without the SPA's own unbind() left 'wf-abandoned'
  // bound to the default unsaved path in localStorage, and the thread pointer
  // survived beside it. On the next boot the thread hydrates and names that
  // workflow; the panel must not resolve it to the brand-new tab that merely
  // reuses the path, or the next turn posts as that workflow and the real CRDT
  // follower pulls the abandoned document onto the empty canvas.
  it('does not restore an abandoned tab binding onto a brand-new default-path tab', async () => {
    const staleWorkflowId = 'wf-abandoned'
    const defaultPath = 'workflows/Unsaved Workflow.json'
    localStorage.setItem(
      StorageKeys.agentWorkflowTabBindings('personal'),
      JSON.stringify({
        [staleWorkflowId]: {
          tabPath: defaultPath,
          graphId: '3d4d7f1e-3c8b-4a0a-9a3c-1d2e3f4a5b6c',
          confirmedAt: Date.now()
        }
      })
    )
    localStorage.setItem(StorageKeys.agentThread('personal'), 'th-stale')
    const fresh = addTab(defaultPath, {
      isTemporary: true,
      activeState: fromPartial<ComfyWorkflowJSON>({
        id: '5c1c3a7e-2a44-4c8e-9a44-0f1e2d3c4b5a'
      })
    })
    workflowStore.activeWorkflow = fresh
    const history: AgentMessages = [
      {
        id: 'row',
        thread_id: 'th-stale',
        seq: 1,
        role: 'user',
        status: 'complete',
        turn_id: 'turn',
        workflow_id: staleWorkflowId,
        content: { text: 'Earlier request' }
      }
    ]
    const bodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)))
          return json(202, ack(staleWorkflowId))
        }
        if (url.includes('/messages')) return json(200, history)
        if (url.includes('/workflows'))
          return json(200, {
            // Re-targeting the fresh tab saves it as a new cloud workflow.
            data: fresh.isTemporary
              ? []
              : [{ id: 'wf-new', name: 'Unsaved Workflow' }],
            pagination: { offset: 0, limit: 100, total: 0, has_more: false }
          })
        return json(200, agentThreadList())
      }
    )

    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await vi.waitFor(() =>
      expect(useAgentPanelStore().canRestoreWorkflow).toBe(false)
    )

    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor(staleWorkflowId)
    ).toBeUndefined()
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(defaultPath)
    ).toBeUndefined()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Unsaved Workflow' })
    )
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await sendFromComposer('continue here')

    expect(bodies).toHaveLength(1)
    expect(bodies[0]).not.toMatchObject({ workflow_id: staleWorkflowId })
    expect(workflowStore.activeWorkflow.path).toBe(defaultPath)
    const subscribedStaleDoc = socketSend.mock.calls.some(([frame]) => {
      if (typeof frame !== 'string') return false
      const parsed: unknown = JSON.parse(frame)
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as { type?: unknown }).type === 'doc_subscribe' &&
        (parsed as { data?: { workflow_id?: unknown } }).data?.workflow_id ===
          staleWorkflowId
      )
    })
    expect(subscribedStaleDoc).toBe(false)
  })

  it('reports a selected binding once when the next turn acknowledges it', async () => {
    setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    let acknowledgedWorkflowId = 'wf-42'
    mockMessagesEndpoint(() => acknowledgedWorkflowId)
    await renderAndSend('work here')
    await vi.waitFor(() =>
      expect(useAgentConversationStore().activeTurnId).toBe('m-1')
    )
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1',
      usage: null
    })
    await screen.findByRole('button', { name: 'Send' })
    telemetry.trackAgentWorkflowBound.mockClear()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'other' })
    )
    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(
        'workflows/other.json'
      )
    )
    acknowledgedWorkflowId = 'wf-other'
    await sendFromComposer('continue there')
    await vi.waitFor(() =>
      expect(useAgentConversationStore().activeTurnId).toBe('m-2')
    )

    expect(telemetry.trackAgentWorkflowBound).toHaveBeenCalledExactlyOnceWith({
      thread_id: 'th-1',
      workflow_id: 'wf-other',
      prev_workflow_id: 'wf-42',
      bind_source: 'selector_chip'
    })
  })

  it('attributes a pre-thread binding when the first turn acknowledges it', async () => {
    setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    mockMessagesEndpoint('wf-other')
    renderWithSelectedTarget()
    telemetry.trackAgentWorkflowBound.mockClear()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'other' })
    )
    expect(telemetry.trackAgentWorkflowBound).not.toHaveBeenCalled()

    await sendFromComposer('work there')
    await vi.waitFor(() =>
      expect(useAgentConversationStore().activeTurnId).toBe('m-1')
    )

    expect(telemetry.trackAgentWorkflowBound).toHaveBeenCalledExactlyOnceWith({
      thread_id: 'th-1',
      workflow_id: 'wf-other',
      prev_workflow_id: 'wf-42',
      bind_source: 'selector_chip'
    })
  })

  it('attributes the thread started after deleting the open chat', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint(
      'wf-42',
      [],
      [
        agentThread({
          id: 'th-1',
          title: 'build a duck',
          last_message_at: '2026-07-07T10:00:00Z'
        })
      ]
    )
    await renderAndSend('work here')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1',
      usage: null
    })
    await screen.findByRole('button', { name: 'Send' })
    telemetry.trackAgentThreadStarted.mockClear()

    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
    )
    expect(telemetry.trackAgentThreadStarted).not.toHaveBeenCalled()

    await sendFromComposer('start again')

    await vi.waitFor(() =>
      expect(telemetry.trackAgentThreadStarted).toHaveBeenCalledExactlyOnceWith(
        { source: 'history_delete' }
      )
    )
  })

  it('agent_active_tab opens an unknown workflow as a blank named tab', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    const mint = vi.spyOn(workflowStore, 'createNewTemporary')
    telemetry.trackAgentWorkflowBound.mockClear()
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)

    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalled()
    )
    const minted = workflowStore.getWorkflowByPath('workflows/Video test.json')
    expect(mint).toHaveBeenCalledOnce()
    expect(minted?.filename).toBe('Video test')
    expect(JSON.parse(minted?.originalContent ?? 'null')).toMatchObject({
      nodes: [],
      links: [],
      extra: { ds: { offset: [0, 0], scale: 1 } }
    })
    // The host minted the doc server-side; the follower fills the canvas.
    // Nothing loads, saves, or adopts here.
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-77')).toBe(
      'workflows/Video test.json'
    )
    expect(useTelemetry()!.trackAgentWorkflowApplied).toHaveBeenCalledWith({
      workflow_id: 'wf-77',
      target: 'active_tab_open'
    })
    expect(telemetry.trackAgentWorkflowBound).toHaveBeenCalledExactlyOnceWith({
      thread_id: 'th-1',
      workflow_id: 'wf-77',
      prev_workflow_id: 'wf-42',
      bind_source: 'active_tab'
    })
  })
  it.for(['saved', 'new'] as const)(
    'does not apply an activation when opening a %s tab is refused',
    async (kind) => {
      const current = makeTab('wf-42')
      if (kind === 'saved') addTab('workflows/Other.json')
      mockMessagesEndpoint(
        'wf-42',
        kind === 'saved' ? [{ id: 'wf-other', name: 'Other' }] : []
      )
      await renderAndSend('work here')
      vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(false)
      vi.mocked(useTelemetry())!.trackAgentWorkflowApplied.mockClear()
      vi.useFakeTimers()

      dispatchApiEvent('agent_active_tab', {
        workflow_id: 'wf-other',
        name: 'Other',
        thread_id: 'th-1'
      })
      await vi.advanceTimersByTimeAsync(500)

      await vi.waitFor(() =>
        expect(useToast().toasts).toContainEqual(
          expect.objectContaining({
            kind: 'warning',
            title: i18n.global.t('agent.targetNavigationUnavailable')
          })
        )
      )
      expect(workflowStore.activeWorkflow).toEqual(current)
      expect(useAgentPanelStore().selectedWorkflow).toEqual(current)
      expect(
        useAgentWorkflowTabBindingStore().tabPathFor('wf-other')
      ).toBeUndefined()
      expect(useTelemetry()!.trackAgentWorkflowApplied).not.toHaveBeenCalled()
      expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
        current.path
      ])
      expect(useWorkflowTabActivityStore().creatingTab).toBe(false)
      expect(
        Boolean(workflowStore.getWorkflowByPath('workflows/Other.json'))
      ).toBe(kind === 'saved')
    }
  )

  it('drops an activation unmounted during the tab creation delay', async () => {
    const current = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    const { unmount } = renderWithSelectedTarget()
    await sendFromComposer('work here')
    vi.useFakeTimers()
    vi.mocked(useTelemetry())!.trackAgentWorkflowApplied.mockClear()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-late',
      name: 'Late',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(useWorkflowTabActivityStore().creatingTab).toBe(true)
    unmount()
    await vi.advanceTimersByTimeAsync(500)

    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(workflowStore.getWorkflowByPath('workflows/Late.json')).toBeNull()
    expect(workflowStore.activeWorkflow).toEqual(current)
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('wf-late')
    ).toBeUndefined()
    expect(useTelemetry()!.trackAgentWorkflowApplied).not.toHaveBeenCalled()
    expect(useWorkflowTabActivityStore().creatingTab).toBe(false)
  })

  it.for(['saved', 'new'] as const)(
    'does not bind a %s activation that finishes opening after unmount',
    async (kind) => {
      const current = makeTab('wf-42')
      if (kind === 'saved') addTab('workflows/Late.json')
      mockMessagesEndpoint(
        'wf-42',
        kind === 'saved' ? [{ id: 'wf-late', name: 'Late' }] : []
      )
      const { unmount } = renderWithSelectedTarget()
      await sendFromComposer('work here')
      vi.useFakeTimers()
      vi.mocked(useTelemetry())!.trackAgentWorkflowApplied.mockClear()
      let finishOpen: ((opened: boolean) => void) | undefined
      vi.mocked(useWorkflowService()).openWorkflow.mockImplementationOnce(
        async (tab) => {
          const opened = await new Promise<boolean>((resolve) => {
            finishOpen = resolve
          })
          const known = workflowStore.getWorkflowByPath(tab.path)
          if (opened && known) workflowStore.activeWorkflow = await known.load()
          return opened
        }
      )

      dispatchApiEvent('agent_active_tab', {
        workflow_id: 'wf-late',
        name: 'Late',
        thread_id: 'th-1'
      })
      await vi.advanceTimersByTimeAsync(500)
      expect(finishOpen).toBeDefined()
      unmount()
      finishOpen?.(true)
      await vi.advanceTimersByTimeAsync(0)

      expect(
        useAgentWorkflowTabBindingStore().tabPathFor('wf-late')
      ).toBeUndefined()
      expect(useTelemetry()!.trackAgentWorkflowApplied).not.toHaveBeenCalled()
      expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)
      if (kind === 'new') expect(workflowStore.activeWorkflow).toEqual(current)
      expect(
        Boolean(workflowStore.getWorkflowByPath('workflows/Late.json'))
      ).toBe(kind === 'saved')
    }
  )

  it('drops queued activations when an in-flight open outlives the panel', async () => {
    const current = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    const { unmount } = renderWithSelectedTarget()
    await sendFromComposer('work here')
    vi.useFakeTimers()
    vi.mocked(useTelemetry())!.trackAgentWorkflowApplied.mockClear()
    let finishOpen: ((opened: boolean) => void) | undefined
    vi.mocked(useWorkflowService()).openWorkflow.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishOpen = resolve
        })
    )

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-42',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(finishOpen).toBeDefined()
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-queued',
      name: 'Queued',
      thread_id: 'th-1'
    })
    unmount()
    finishOpen?.(true)
    await vi.advanceTimersByTimeAsync(500)

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledExactlyOnceWith(
      current
    )
    expect(workflowStore.getWorkflowByPath('workflows/Queued.json')).toBeNull()
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('wf-queued')
    ).toBeUndefined()
    expect(useTelemetry()!.trackAgentWorkflowApplied).not.toHaveBeenCalled()
    expect(useWorkflowTabActivityStore().creatingTab).toBe(false)
  })

  it('agent_active_tab sanitizes slashes and falls back on empty names', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-88',
      name: 'a/b',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/a-b.json')
      ).not.toBeNull()
    )

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-89',
      name: '  ',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Unsaved Workflow.json')
      ).not.toBeNull()
    )
  })

  it('agent_active_tab reports when a minted tab cannot be opened', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    telemetry.trackAgentError.mockClear()
    vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(false)
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)

    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'workflows/Video test.json' })
      )
    )
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Video test.json')
      ).toBeNull()
    )
    expect(telemetry.trackAgentError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_class: 'workflow_open_failed',
        ui_treatment: 'toast'
      })
    )
  })

  it('agent_active_tab closes the minted tab when opening it throws', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    telemetry.trackAgentError.mockClear()
    vi.mocked(useWorkflowService()).openWorkflow.mockRejectedValueOnce(
      new Error('open boom')
    )
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-77',
      name: 'Video test',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)

    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'workflows/Video test.json' })
      )
    )
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Video test.json')
      ).toBeNull()
    )
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('wf-77')
    ).toBeUndefined()
    expect(useTelemetry()!.trackAgentWorkflowApplied).not.toHaveBeenCalled()
    expect(telemetry.trackAgentError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_class: 'workflow_open_failed',
        failure_stage: 'post_acceptance',
        retryable: false,
        turn_accepted: true,
        ui_treatment: 'error_overlay'
      })
    )
  })

  it('agent_active_tab strips dotfile prefixes hidden behind whitespace', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-95',
      name: ' .hidden',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/hidden.json')
      ).not.toBeNull()
    )
  })

  it('two unnamed agent tabs mint distinct tabs with distinct bindings', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-a',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Unsaved Workflow.json')
      ).not.toBeNull()
    )
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-b',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Unsaved Workflow (2).json')
      ).not.toBeNull()
    )
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()

    const activity = useWorkflowTabActivityStore()
    await vi.waitFor(() =>
      expect([...activity.editingPaths]).toEqual([
        'workflows/Unsaved Workflow (2).json'
      ])
    )
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-a',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect([...activity.editingPaths]).toEqual([
        'workflows/Unsaved Workflow.json'
      ])
    )
  })

  it('a slow tab activation cannot finish after a newer focus event', async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    let resolveSlowOpen: (() => void) | undefined
    vi.mocked(useWorkflowService()).openWorkflow.mockImplementationOnce(
      async (slow: { path: string }) => {
        await new Promise<void>((resolve) => {
          resolveSlowOpen = resolve
        })

        const known = workflowStore.getWorkflowByPath(slow.path)
        if (known) workflowStore.activeWorkflow = await known.load()
        return true
      }
    )

    await renderAndSend('work here')
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-42',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(resolveSlowOpen).toBeDefined()
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-quick',
      name: 'Quick tab',
      thread_id: 'th-1'
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledTimes(1)
    expect(
      workflowStore.getWorkflowByPath('workflows/Quick tab.json')
    ).toBeNull()
    resolveSlowOpen?.()
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Quick tab.json')
      ).not.toBeNull()
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(workflowStore.activeWorkflow?.filename).toBe('Quick tab')
    expect(tab).not.toBe(workflowStore.activeWorkflow)
  })

  it('a stale agent_active_tab resolving late cannot steal focus from the newest', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    vi.useFakeTimers()

    // Hold the SLOW tab's open so the newer activation lands mid-flight.
    let releaseSlowOpen: (() => void) | undefined
    vi.mocked(useWorkflowService().openWorkflow).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseSlowOpen = () => resolve(true)
        })
    )
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-slow',
      name: 'Slow tab',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)
    expect(releaseSlowOpen).toBeDefined()
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-fast',
      name: 'Fast tab',
      thread_id: 'th-1'
    })
    releaseSlowOpen?.()
    await vi.advanceTimersByTimeAsync(500)

    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/Fast tab.json')
      ).not.toBeNull()
    )
    await vi.advanceTimersByTimeAsync(0)

    // The superseded activation closed its own minted tab and bound nothing.
    expect(
      workflowStore.getWorkflowByPath('workflows/Slow tab.json')
    ).toBeNull()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-slow')).toBe(
      undefined
    )
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-fast')).toBe(
      'workflows/Fast tab.json'
    )
  })
  it('an activation superseded before it starts does nothing at all', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('work here')
    vi.useFakeTimers()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-a',
      name: 'A tab',
      thread_id: 'th-1'
    })
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-b',
      name: 'B tab',
      thread_id: 'th-1'
    })
    await vi.advanceTimersByTimeAsync(500)

    await vi.waitFor(() =>
      expect(
        workflowStore.getWorkflowByPath('workflows/B tab.json')
      ).not.toBeNull()
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(workflowStore.getWorkflowByPath('workflows/A tab.json')).toBeNull()
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-b')).toBe(
      'workflows/B tab.json'
    )
  })

  it('T-03 / PM-655 / FE-1311 sends the active canvas workflow in the agent snapshot', async () => {
    makeTab('wf-42')
    addTab('workflows/scratch.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({
        id: 'graph-internal-id-not-a-cloud-id'
      })
    })
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
  })

  it('refreshes the cloud index before each send, not just on mount', async () => {
    makeTab()
    const bodies: unknown[] = []
    let workflowsCalls = 0
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)))
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
      }
    )

    await startVueNodeSelection()
    await sendFromComposer('first message')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-cloud-current',
      selection: {
        node_ids: ['9', '12'],
        workflow_id: 'wf-cloud-current'
      }
    })
  })

  it('does not resolve two same-named open saved tabs to one cloud id', async () => {
    const current = makeTab()
    const archived = addTab('workflows/archive/current.json')
    const bodies = mockMessagesEndpoint('wf-fresh', [
      { id: 'wf-cloud-current', name: 'current' }
    ])

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(current.path)
    ).toBeUndefined()
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(archived.path)
    ).toBeUndefined()
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
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)))
          return new Response(JSON.stringify(ack('wf-42', 'm-1')), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        if (url.includes('/workflows')) {
          return json(500, { error: 'internal server error' })
        }
        return new Response('{}', { status: 200 })
      }
    )

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
  })

  it('does not adopt a minted workflow when a saved tab cloud lookup fails', async () => {
    const tab = makeTab()
    const bodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)))
          return json(202, ack('wf-fresh'))
        }
        if (url.includes('/workflows')) return json(500, { error: 'failed' })
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        return json(200, [])
      }
    )

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(tab.path)
    ).toBeUndefined()
  })

  it('does not adopt a minted workflow after cloud preparation times out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const tab = makeTab()
    const bodies: unknown[] = []
    let workflowRequests = 0
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)))
          return json(202, ack('wf-fresh'))
        }
        if (url.includes('/workflows')) {
          workflowRequests++
          if (workflowRequests > 1)
            return new Promise<Response>(() => undefined)
          return json(200, {
            data: [],
            pagination: { offset: 0, limit: 100, total: 0, has_more: false }
          })
        }
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        return json(200, [])
      }
    )

    renderWithSelectedTarget()
    await vi.waitFor(() => expect(workflowRequests).toBe(1))
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('first message')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(workflowRequests).toBe(2))
    await vi.advanceTimersByTimeAsync(3000)

    await vi.waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(tab.path)
    ).toBeUndefined()
  })

  it('sends ordinary open tabs without selecting them as references', async () => {
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
      workflow_references: []
    })
  })

  it('sends a saved app workflow instead of the existing thread workflow', async () => {
    const activeState = fromPartial<ComfyWorkflowJSON>({
      nodes: Array.from({ length: 19 }, (_, index) => ({
        id: index + 1,
        type: index === 0 ? 'LoadImage' : `ImageEditNode${index}`
      })),
      links: []
    })
    const appTab = addTab('workflows/all-in-one-image-edit-models.app.json', {
      activeState
    })
    workflowStore.activeWorkflow = appTab
    useAgentConversationStore().setThreadId('th-two-node-workflow')
    const bodies = mockMessagesEndpoint('wf-all-in-one', [
      { id: 'wf-all-in-one', name: 'all-in-one-image-edit-models.app' }
    ])

    await renderAndSend('replace the image in the Load Image node')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-all-in-one',
      open_tabs: [
        {
          workflow_id: 'wf-all-in-one',
          name: 'all-in-one-image-edit-models.app'
        }
      ],

      draft: { content: activeState }
    })
    expect(
      (bodies[0] as { draft: { content: { nodes: unknown[] } } }).draft.content
        .nodes
    ).toHaveLength(19)
  })

  it('does not resolve temporary tabs through the cloud workflow index', async () => {
    const tab = makeTab()
    Object.assign(tab, { isTemporary: true })
    const bodies = mockMessagesEndpoint('wf-fresh', [
      { id: 'wf-cloud-current', name: 'current' }
    ])

    await renderAndSend('first message')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
  })

  // PM-1429/PM-1430: a brand-new tab plus a brand-new chat session displays
  // the tab as bound (renderAndSend's target is the active workflow), but
  // the turn used to go out with neither workflow_id NOR any signal that a
  // tab was selected at all - indistinguishable, server-side, from no tab
  // being selected. The agent then refused to edit: "I can't because you
  // don't have a workflow selected to edit."
  it('flags a freshly created, unsaved tab as unbound rather than unselected', async () => {
    const tab = makeTab()
    Object.assign(tab, {
      isTemporary: true,
      activeState: fromPartial<ComfyWorkflowJSON>({
        nodes: [{ id: 1, type: 'TextInput' }],
        links: []
      })
    })
    const bodies = mockMessagesEndpoint('wf-fresh')

    await renderAndSend('add one text input node')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).toMatchObject({ current_tab_unbound: true })
  })

  // A restored/existing thread (no turn of THIS session has bound anything
  // yet - `New Chat` is what puts the session into that state here) whose
  // target tab is still unbound must flag it AND still send its draft -
  // dropping the draft here would hand the server's mint an empty canvas
  // instead of the node already on the tab.
  it('flags an unbound tab as unbound on a restored thread, with its draft attached', async () => {
    const tab = makeTab()
    Object.assign(tab, {
      isTemporary: true,
      activeState: fromPartial<ComfyWorkflowJSON>({
        nodes: [{ id: 1, type: 'TextInput' }],
        links: []
      })
    })
    const bodies = mockMessagesEndpoint('wf-fresh')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )
    useAgentConversationStore().setThreadId('th-existing')

    await sendFromComposer('add one text input node')

    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).toMatchObject({ current_tab_unbound: true })
    expect(bodies[0]).toHaveProperty('draft')
  })

  // Companion to the test above: this is the happy path a page reload
  // relies on. boundWorkflowId (module state, the session's own memory of
  // having bound something) resets on reload, but the tab-binding store
  // persists to localStorage and survives it. As long as that persisted
  // record's graphId still matches the tab's own graph id - guaranteed for
  // any tab created through workflowStore.createTemporary/createNewWorkflow,
  // which always mint one via ensureWorkflowId before the tab is ever open -
  // cloudIdFor resolves the bound id from that persisted record alone, so
  // the turn never re-flags the tab as unbound or re-mints a second
  // workflow for it.
  it('resolves a workflow bound before reload from persisted storage, without re-flagging the tab as unbound', async () => {
    const tab = makeTab()
    Object.assign(tab, {
      isTemporary: true,
      activeState: fromPartial<ComfyWorkflowJSON>({
        id: 'graph-abc',
        nodes: [{ id: 1, type: 'TextInput' }],
        links: []
      })
    })
    localStorage.setItem(
      StorageKeys.agentWorkflowTabBindings('personal'),
      JSON.stringify({
        'wf-from-before-reload': {
          tabPath: tab.path,
          graphId: 'graph-abc',
          confirmedAt: Date.now()
        }
      })
    )
    const bodies = mockMessagesEndpoint('wf-from-before-reload')
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
    )
    useAgentConversationStore().setThreadId('th-existing')

    await sendFromComposer('add one text input node')

    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-from-before-reload' })
    expect(bodies[0]).not.toHaveProperty('current_tab_unbound')
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

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-cloud-duck',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(duck)
    )
    expect(
      workflowStore.getWorkflowByPath('workflows/duck (2).json')
    ).toBeNull()
    // Resolving by cloud name has to leave the binding behind, or the transcript
    // link renders nothing for the tab the user was just moved to.
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-cloud-duck')).toBe(
      duck.path
    )
    expect(
      await screen.findByRole('button', { name: 'Open duck' })
    ).toBeInTheDocument()
  })

  it.for(['binding', 'index'])(
    'opens a reference resolved by %s without refreshing workflow lists',
    async (identitySource) => {
      const {
        target: current,
        references: [reference]
      } = setupWorkflowContext({
        targetId: 'wf-cloud-current',
        references: [
          {
            path: 'workflows/reference.json',
            workflowId:
              identitySource === 'binding' ? 'wf-reference' : undefined
          }
        ]
      })
      const bodies = mockMessagesEndpoint(
        'wf-cloud-current',
        identitySource === 'index'
          ? [{ id: 'wf-reference', name: 'reference' }]
          : []
      )
      renderWithSelectedTarget()
      await sendFromComposer('start editing current')
      dispatchApiEvent('agent_message_done', {
        message_id: 'm-1',
        thread_id: 'th-1'
      })
      await screen.findByRole('button', { name: 'Send' })
      expect(bodies).toHaveLength(1)
      const textbox = screen.getByRole('textbox')
      await userEvent.click(textbox)
      await userEvent.paste('@')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'reference' })
      )
      await userEvent.paste('Keep this draft')
      const workflowLookups = () =>
        vi
          .mocked(fetch)
          .mock.calls.filter(([url]) => String(url).includes('/workflows'))
          .length
      const lookupsBeforeNavigation = workflowLookups()

      await userEvent.click(
        screen.getByRole('button', { name: 'Open reference' })
      )
      await vi.waitFor(() =>
        expect(workflowStore.activeWorkflow?.path).toBe(reference.path)
      )
      expect(workflowStore.syncWorkflows).not.toHaveBeenCalled()
      expect(workflowLookups()).toBe(lookupsBeforeNavigation)
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(current.path)
      expect(useAgentComposerStore().draft).toBe(' Keep this draft')
    }
  )

  it.for(['mention', 'plus'] as const)(
    'references a saved workflow without opening its tab via %s',
    async (picker) => {
      const target = makeTab('wf-current')
      const bodies = mockMessagesEndpoint('wf-current', [
        { id: 'wf-closed', name: 'Closed workflow' }
      ])
      renderWithSelectedTarget()
      if (picker === 'mention') {
        await userEvent.click(screen.getByRole('textbox'))
        await userEvent.paste('@')
      } else {
        await userEvent.click(
          screen.getByRole('button', { name: 'Add to prompt' })
        )
      }
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'Closed workflow' })
      )
      expect(
        await screen.findByRole('button', { name: 'Open Closed workflow' })
      ).toBeVisible()
      expect(workflowStore.activeWorkflow).toEqual(target)
      expect(useAgentPanelStore().selectedWorkflow).toEqual(target)
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      await sendFromComposer('Compare these')
      expect(bodies[0]).toMatchObject({
        workflow_id: 'wf-current',
        open_tabs: [{ workflow_id: 'wf-current', name: 'current' }],
        workflow_references: [
          { workflow_id: 'wf-closed', name: 'Closed workflow' }
        ]
      })
    }
  )

  it('saves an inactive scratch reference without changing the canvas or target', async () => {
    const target = makeTab('wf-current')
    const scratch = addTab('workflows/scratch.json', { isTemporary: true })
    const cloudWorkflows = [{ id: 'wf-existing', name: 'scratch' }]
    const bodies = mockMessagesEndpoint('wf-current', cloudWorkflows)
    vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
      async (tab, options) => {
        await workflowStore.renameWorkflow(
          tab,
          `workflows/${options?.filename}.json`
        )
        Object.assign(tab, { isTemporary: false })
        cloudWorkflows.push({ id: 'wf-scratch', name: tab.filename })
        return true
      }
    )
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('Compare @')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /scratch\s*Unsaved/ })
    )
    expect(
      await screen.findByRole('button', { name: 'Open scratch (2)' })
    ).toBeVisible()
    expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledWith(scratch, {
      filename: 'scratch (2)'
    })
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(workflowStore.activeWorkflow).toEqual(target)
    expect(useAgentPanelStore().selectedWorkflow).toEqual(target)
    expect(useAgentComposerStore().draft).toBe('Compare  ')
    const other = addTab('workflows/other.json')
    workflowStore.activeWorkflow = other
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    expect(
      screen.getByRole('button', { name: 'Open scratch (2)' })
    ).toBeVisible()
    workflowStore.activeWorkflow = target
    await nextTick()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-current',
      content: 'Compare [scratch (2)](workflow://wf-scratch)',
      workflow_references: [{ workflow_id: 'wf-scratch', name: 'scratch (2)' }]
    })
  })

  it.for(['mention', 'plus'] as const)(
    'keeps a failed scratch reference selection retryable via %s',
    async (picker) => {
      const target = makeTab('wf-current')
      const scratch = addTab('workflows/scratch.json', { isTemporary: true })
      const cloudWorkflows: { id: string; name: string }[] = []
      mockMessagesEndpoint('wf-current', cloudWorkflows)
      vi.mocked(useWorkflowService()).saveWorkflowAs.mockRejectedValueOnce(
        new Error('Save unavailable')
      )
      vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
        async () => {
          Object.assign(scratch, { isTemporary: false })
          cloudWorkflows.push({ id: 'wf-scratch', name: 'scratch' })
          return true
        }
      )
      renderWithSelectedTarget()
      const textbox = screen.getByRole('textbox')
      await userEvent.click(textbox)
      await userEvent.paste(picker === 'mention' ? 'Compare @' : 'Compare')
      if (picker === 'plus')
        await userEvent.click(
          screen.getByRole('button', { name: 'Add to prompt' })
        )
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /scratch\s*Unsaved/ })
      )
      await vi.waitFor(() =>
        expect(useToast().toasts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ description: 'Save unavailable' })
          ])
        )
      )
      expect(useAgentComposerStore().draft).toBe(
        picker === 'mention' ? 'Compare @' : 'Compare'
      )
      expect(screen.queryByRole('button', { name: 'Open scratch' })).toBeNull()
      await userEvent.click(
        screen.getByRole('menuitem', { name: /scratch\s*Unsaved/ })
      )
      expect(
        await screen.findByRole('button', { name: 'Open scratch' })
      ).toBeVisible()
      expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledTimes(2)
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(useAgentPanelStore().selectedWorkflow).toEqual(target)
      expect(workflowStore.activeWorkflow).toEqual(target)
    }
  )

  it.for(['complete', 'new-chat', 'unmount', 'close-tab', 'history'] as const)(
    'guards a pending scratch reference save when it ends with %s',
    async (outcome) => {
      const target = makeTab('wf-current')
      const scratch = addTab('workflows/scratch.json', { isTemporary: true })
      const cloudWorkflows: { id: string; name: string }[] = []
      const bodies = mockMessagesEndpoint('wf-current', cloudWorkflows, [
        agentThread({
          id: 'th-earlier',
          title: 'Earlier chat',
          last_message_at: '2026-09-01T00:00:00Z'
        })
      ])
      let resolve = () => {}
      const promise = new Promise<void>((done) => {
        resolve = done
      })
      vi.mocked(useWorkflowService()).saveWorkflowAs.mockImplementationOnce(
        async () => {
          await promise
          Object.assign(scratch, { isTemporary: false })
          cloudWorkflows.push({ id: 'wf-scratch', name: 'scratch' })
          return true
        }
      )
      const view = renderWithSelectedTarget()
      const textbox = screen.getByRole('textbox')
      await userEvent.click(textbox)
      await userEvent.paste('Compare @')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /scratch\s*Unsaved/ })
      )
      await vi.waitFor(() =>
        expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledOnce()
      )
      expect(screen.getByRole('status')).toHaveTextContent('Saving workflow')
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
      expect(
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      ).toBeDisabled()
      expect(
        screen.getByRole('menuitem', { name: /scratch\s*Unsaved/ })
      ).toHaveAttribute('aria-disabled', 'true')
      await userEvent.keyboard('{Enter}')
      expect(bodies).toHaveLength(0)
      expect(useWorkflowService().saveWorkflowAs).toHaveBeenCalledOnce()
      if (outcome === 'new-chat')
        await userEvent.click(screen.getByRole('button', { name: 'New chat' }))
      if (outcome === 'unmount') view.unmount()
      if (outcome === 'close-tab') await workflowStore.closeWorkflow(scratch)
      if (outcome === 'history') {
        await userEvent.click(
          screen.getByRole('button', {
            name: i18n.global.t('agent.showChatHistory')
          })
        )
        await userEvent.click(await screen.findByText('Earlier chat'))
      }

      resolve()
      await promise
      if (outcome === 'unmount') {
        await vi.waitFor(() =>
          expect(useWorkflowService().saveWorkflowAs).toHaveResolvedTimes(1)
        )
      } else {
        await vi.waitFor(() =>
          expect(screen.queryByText('Saving workflow')).toBeNull()
        )
      }
      expect(useAgentComposerStore().workflowReferences).toEqual(
        outcome === 'complete'
          ? [{ id: 'wf-scratch', name: 'scratch', textOffset: 8 }]
          : []
      )
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.activeWorkflow).toEqual(target)
    }
  )

  it.for(['saved', 'agent-draft'] as const)(
    'does not implicitly save an already backed reference: %s',
    async (kind) => {
      makeTab('wf-current')
      const reference = addTab('workflows/reference.json', {
        isTemporary: kind === 'agent-draft',
        isModified: true
      })
      useAgentWorkflowTabBindingStore().bind('wf-reference', reference.path)
      mockMessagesEndpoint('wf-current')
      renderWithSelectedTarget()
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('@')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'reference' })
      )
      expect(
        await screen.findByRole('button', { name: 'Open reference' })
      ).toBeVisible()
      expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
      expect(useWorkflowService().saveWorkflow).not.toHaveBeenCalled()
      expect(reference.isModified).toBe(true)
    }
  )

  it.for(['send', 'new-chat'] as const)(
    'retains draft workflow references on panel reopen and clears them after %s',
    async (action) => {
      const { target } = setupWorkflowContext({
        targetId: 'wf-current',
        references: [
          { path: 'workflows/reference.json', workflowId: 'wf-reference' }
        ]
      })
      const bodies = mockMessagesEndpoint('wf-current', [
        { id: 'wf-reference', name: 'reference' }
      ])
      const first = renderWithSelectedTarget()
      useAgentPanelStore().isOpen = true
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste('@')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'reference' })
      )
      await userEvent.paste('Keep this draft')
      expect(
        screen.getByRole('button', { name: 'Open reference' })
      ).toBeVisible()

      first.unmount()
      const reopened = render(AgentPanelRoot, { global: { plugins: [i18n] } })
      expect(useAgentComposerStore().draft).toBe(' Keep this draft')
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
      expect(
        within(screen.getByTestId('composer-inline-input')).getByRole(
          'button',
          { name: 'Open reference' }
        )
      ).toBeVisible()

      if (action === 'send') {
        await userEvent.click(screen.getByRole('button', { name: 'Send' }))
        await vi.waitFor(() => expect(bodies).toHaveLength(1))
        expect(bodies[0]).toMatchObject({
          content: '[reference](workflow://wf-reference) Keep this draft',
          workflow_id: 'wf-current',
          workflow_references: [
            { workflow_id: 'wf-reference', name: 'reference' }
          ]
        })
      } else {
        await userEvent.click(
          screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
        )
      }

      reopened.unmount()
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      expect(
        within(screen.getByTestId('composer-inline-input')).queryByRole(
          'button',
          { name: 'Open reference' }
        )
      ).toBeNull()
    }
  )

  it.for(['open', 'closed'])(
    'navigates to a staged reference in an %s tab without changing the target or draft',
    async (tabState) => {
      const {
        target: current,
        references: [reference]
      } = setupWorkflowContext({
        targetId: 'wf-cloud-current',
        references: [
          { path: 'workflows/reference.json', workflowId: 'wf-reference' }
        ]
      })
      const bodies = mockMessagesEndpoint('wf-cloud-current', [
        { id: 'wf-reference', name: 'reference' }
      ])
      setupNodeSelectionCanvas()
      renderWithSelectedTarget()
      useAgentPanelStore().isOpen = true
      await openMentionPicker()
      await userEvent.click(await screen.findByText('KSampler'))
      const textbox = screen.getByRole('textbox')
      await userEvent.click(textbox)
      await userEvent.paste('@')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'reference' })
      )
      await userEvent.paste('Keep this draft')
      if (tabState === 'closed') await workflowStore.closeWorkflow(reference)

      await userEvent.click(
        screen.getByRole('button', { name: 'Open reference' })
      )
      await vi.waitFor(() =>
        expect(workflowStore.activeWorkflow?.path).toBe(reference.path)
      )
      expect(
        workflowStore.openWorkflows.some((tab) => tab.path === reference.path)
      ).toBe(true)
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(current.path)
      expect(useAgentComposerStore().draft).toBe('  Keep this draft')
      expect(
        screen.getByRole('button', { name: 'Open reference' })
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
      ).toBeVisible()
      expect(bodies).toHaveLength(0)

      await userEvent.click(
        screen.getByRole('button', { name: 'Remove reference reference' })
      )
      expect(
        screen.queryByRole('button', { name: 'Open reference' })
      ).toBeNull()
      expect(workflowStore.activeWorkflow?.path).toBe(reference.path)
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await vi.waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({
        content: '@[Node: KSampler #12] Keep this draft',
        workflow_id: 'wf-cloud-current',
        // The chip was staged while `wf-cloud-current` was viewed, and the
        // user then navigated to `wf-reference` before sending. Ownership must
        // follow the workflow the node came from, not the one on screen at
        // send time, so this asserts the owner rather than only `node_ids`.
        selection: { node_ids: ['12'], workflow_id: 'wf-cloud-current' },
        workflow_references: []
      })
    }
  )

  it.for(['false', 'throw'])(
    'keeps a staged reference and warns when navigation returns %s',
    async (failure) => {
      const { target: current } = setupWorkflowContext({
        targetId: 'wf-cloud-current',
        references: [
          { path: 'workflows/reference.json', workflowId: 'wf-reference' }
        ]
      })
      const bodies = mockMessagesEndpoint('wf-cloud-current', [
        { id: 'wf-reference', name: 'reference' }
      ])
      renderWithSelectedTarget()
      const textbox = screen.getByRole('textbox')
      await userEvent.click(textbox)
      await userEvent.paste('@')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'reference' })
      )
      await userEvent.paste('Keep this draft')
      if (failure === 'false')
        vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(
          false
        )
      else
        vi.mocked(useWorkflowService()).openWorkflow.mockRejectedValueOnce(
          new Error('Cannot open')
        )

      await userEvent.click(
        screen.getByRole('button', { name: 'Open reference' })
      )
      await vi.waitFor(() =>
        expect(useToast().toasts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: i18n.global.t('agent.targetNavigationUnavailable')
            })
          ])
        )
      )
      expect(workflowStore.activeWorkflow?.path).toBe(current.path)
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(current.path)
      expect(useAgentComposerStore().draft).toBe(' Keep this draft')
      expect(
        screen.getByRole('button', { name: 'Open reference' })
      ).toBeVisible()
      expect(bodies).toHaveLength(0)
    }
  )

  it('syncs and opens a closed workflow from a sent reference chip without changing the Agent target', async () => {
    const current = makeTab('wf-cloud-current')
    const reference = addTab('workflows/reference.json')
    await workflowStore.closeWorkflow(reference)
    mockMessagesEndpoint('wf-cloud-current', [
      { id: 'wf-cloud-current', name: 'current' },
      { id: 'wf-reference', name: 'reference' }
    ])

    renderWithSelectedTarget()
    const conversation = useAgentConversationStore()
    useAgentPanelStore().retainWorkflowTarget()
    const historyMessageId = 'history-message' as TurnId
    conversation.startTurn(historyMessageId)
    conversation.recordUser(
      historyMessageId,
      'Compare these',
      undefined,
      undefined,
      [{ id: 'wf-reference', name: 'reference', textOffset: 0 }]
    )
    conversation.ingest({
      type: 'agent_message_done',
      data: { message_id: 'history-message', thread_id: 'th-history' }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Open reference' })
    )

    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(reference)
    )
    expect(workflowStore.syncWorkflows).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent(current.filename)
  })

  it('sends every open tab that has a cloud id with the message', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')

    expect(bodies[0]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
  })

  it('includes a backgrounded tab whose binding was persisted before a reload', async () => {
    localStorage.setItem(
      StorageKeys.agentWorkflowTabBindings('personal'),
      JSON.stringify({
        'wf-old': {
          tabPath: 'workflows/mountain.json',
          graphId: null,
          confirmedAt: Date.now()
        }
      })
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
      workflow_references: []
    })
  })

  it('sends explicit references separately from the complete editor snapshot', async () => {
    makeTab('wf-42')
    const referenced = addTab('workflows/reference.json')
    const ordinary = addTab('workflows/ordinary.json')
    useAgentWorkflowTabBindingStore().bind('wf-reference', referenced.path)
    useAgentWorkflowTabBindingStore().bind('wf-ordinary', ordinary.path)
    workflowStore.reorderWorkflows(0, 2)
    const bodies = mockMessagesEndpoint('wf-42')

    renderWithSelectedTarget()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'reference' })
    )
    await sendFromComposer('compare these')

    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',
      open_tabs: [
        { workflow_id: 'wf-reference', name: 'reference' },
        { workflow_id: 'wf-ordinary', name: 'ordinary' },
        { workflow_id: 'wf-42', name: 'current' }
      ],
      workflow_references: [{ workflow_id: 'wf-reference', name: 'reference' }]
    })
    expect(bodies[0]).not.toHaveProperty('current_tab')
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

  describe('draft seed against the follower', () => {
    async function bindAndSettle(): Promise<unknown[]> {
      makeTab('wf-42')
      const bodies = mockMessagesEndpoint('wf-42')
      await renderAndSend('first message')
      ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
      await screen.findByRole('button', { name: 'Send' })
      return bodies
    }

    function subscribedWorkflowIds(): unknown[] {
      return socketSend.mock.calls
        .map(
          ([frame]) =>
            JSON.parse(String(frame)) as {
              type: string
              data: { workflow_id?: unknown }
            }
        )
        .filter(({ type }) => type === 'doc_subscribe')
        .map(({ data }) => data.workflow_id)
    }

    it('seeds the draft again once the follower has given up on a refused document', async () => {
      const bodies = await bindAndSettle()
      ws.emit('doc_subscribed', {
        v: 1,
        workflow_id: 'wf-42',
        ok: false,
        code: 'schema_version_mismatch'
      })

      await sendFromComposer('second message')

      expect(bodies[1]).toMatchObject({
        workflow_id: 'wf-42',
        draft: { content: { id: 'wf-42' } }
      })
    })

    it('keeps seeding the draft across an ordinary reconnect', async () => {
      const bodies = await bindAndSettle()
      ws.emit('doc_subscribed', {
        v: 1,
        workflow_id: 'wf-42',
        ok: true,
        seq: 1
      })

      agentSocket.open()

      await sendFromComposer('second message')

      expect(bodies[1]).toHaveProperty('workflow_id', 'wf-42')
      expect(bodies[1]).toHaveProperty('draft')
    })

    it('withholds a bound canvas after its subscribed socket drops', async () => {
      const bodies = await bindAndSettle()
      ws.emit('doc_subscribed', {
        v: 1,
        workflow_id: 'wf-42',
        ok: true,
        seq: 1
      })

      agentSocket.drop()
      await sendFromComposer('second message')

      expect(bodies[1]).toHaveProperty('workflow_id', 'wf-42')
      expect(bodies[1]).not.toHaveProperty('draft')
    })

    it('seeds the draft for a bound document while the agent identity is still pending', async () => {
      vi.mocked(resolveAgentIdentity).mockReturnValue({
        state: ref<AgentIdentityState>({ status: 'pending' }),
        reset: vi.fn(),
        stop: () => {}
      })
      const bodies = await bindAndSettle()

      await sendFromComposer('second message')

      expect(bodies[1]).toHaveProperty('workflow_id', 'wf-42')
      expect(bodies[1]).toHaveProperty('draft')
    })

    it('keeps seeding the draft once a retried identity lookup resolves and the follower subscribes', async () => {
      const state = ref<AgentIdentityState>({ status: 'pending' })
      vi.mocked(resolveAgentIdentity).mockReturnValue({
        state,
        reset: vi.fn(),
        stop: () => {}
      })
      const bodies = await bindAndSettle()
      await sendFromComposer('second message')
      ws.emit('agent_message_done', { message_id: 'm-2', thread_id: 'th-1' })
      await screen.findByRole('button', { name: 'Send' })
      expect(subscribedWorkflowIds()).toEqual([])

      state.value = { status: 'resolved', userId: 'account-a' }

      await vi.waitFor(() => expect(subscribedWorkflowIds()).toEqual(['wf-42']))
      await sendFromComposer('third message')
      expect(bodies.slice(1)).toEqual([
        expect.objectContaining({ draft: expect.anything() }),
        expect.objectContaining({ draft: expect.anything() })
      ])
    })

    it('seeds the draft again once the agent identity lookup is rejected', async () => {
      vi.mocked(resolveAgentIdentity).mockReturnValue({
        state: ref<AgentIdentityState>({ status: 'rejected' }),
        reset: vi.fn(),
        stop: () => {}
      })
      const bodies = await bindAndSettle()

      await sendFromComposer('second message')

      expect(bodies[1]).toMatchObject({
        workflow_id: 'wf-42',
        draft: { content: { id: 'wf-42' } }
      })
    })
  })

  it('keeps the editable target when viewing an unbound tab without current_tab fallback', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    const scratch = addTab('workflows/Scratch.json', { isTemporary: true })
    workflowStore.activeWorkflow = scratch

    await sendFromComposer('second message')

    expect(bodies[1]).toMatchObject({
      open_tabs: [{ workflow_id: 'wf-42', name: 'current' }]
    })
    expect(bodies[1]).toHaveProperty('workflow_id', 'wf-42')
    expect(bodies[1]).not.toHaveProperty('current_tab')
  })

  it('keeps an existing thread pinned when viewing an unsaved tab', async () => {
    const origin = makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first message')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    const scratch = addTab('workflows/Scratch.json', { isTemporary: true })
    workflowStore.activeWorkflow = scratch
    await nextTick()
    socketSend.mockClear()

    await sendFromComposer('second message')

    expect(bodies[1]).toMatchObject({ workflow_id: 'wf-42' })
    expect(bodies[1]).toHaveProperty('draft')
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-42')).toBe(
      origin.path
    )
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(scratch.path)
    ).toBeUndefined()
    expect(
      socketSend.mock.calls.some(([frame]) =>
        String(frame).includes('doc_subscribe')
      )
    ).toBe(false)
  })

  it('a new chat after clearing the canvas keeps the saved target and posts the cleared canvas as its first draft', async () => {
    const tab = makeTab('wf-42')
    tab.activeState = fromPartial<ComfyWorkflowJSON>({
      id: 'wf-42',
      nodes: [{ id: 1, type: 'LoadImage' }]
    })
    const posted: { threadId: string; body: Record<string, unknown> }[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          posted.push({
            threadId: url.split('/threads/')[1].split('/')[0],
            body: JSON.parse(String(init.body))
          })
          return json(202, ack('wf-42', `m-${posted.length}`))
        }
        if (url.includes('/messages')) return json(200, [])
        if (url.includes('/agent/threads'))
          return json(200, agentThreadList([]))
        if (url.includes('/workflows'))
          return json(200, {
            data: [{ id: 'wf-42', name: 'current' }],
            pagination: { offset: 0, limit: 100, total: 1, has_more: false }
          })
        return new Response('{}', { status: 200 })
      }
    )

    await renderAndSend('build a duck')
    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })
    expect(posted[0]).toMatchObject({
      threadId: 'new',
      body: { workflow_id: 'wf-42', draft: { content: { nodes: [{ id: 1 }] } } }
    })

    tab.activeState = fromPartial<ComfyWorkflowJSON>({ id: 'wf-42', nodes: [] })
    await userEvent.click(
      screen.getByRole('button', { name: i18n.global.t('agent.chatOptions') })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: i18n.global.t('g.delete') })
    )
    expect(useAgentConversationStore().threadId).toBeNull()

    await sendFromComposer('start over')

    expect(posted[1]).toMatchObject({
      threadId: 'new',
      body: { workflow_id: 'wf-42', draft: { content: { nodes: [] } } }
    })
    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-42')).toBe(tab.path)
  })

  it('does not bind an unsaved tab to a workflow that already has an open tab', async () => {
    addTab('workflows/current.json')
    const scratch = addTab('workflows/Scratch.json', { isTemporary: true })
    workflowStore.activeWorkflow = scratch
    mockMessagesEndpoint('wf-42', [{ id: 'wf-42', name: 'current' }])

    await renderAndSend('first message')

    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(scratch.path)
    ).toBeUndefined()
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('wf-42')
    ).toBeUndefined()
    expect(
      socketSend.mock.calls.some(([frame]) =>
        String(frame).includes('doc_subscribe')
      )
    ).toBe(false)
  })

  it('does not bind an unsaved tab to a workflow whose saved tab is closed', async () => {
    const saved = makeTab('wf-42')
    await workflowStore.closeWorkflow(
      workflowStore.getWorkflowByPath(saved.path)!
    )
    const scratch = addTab('workflows/Scratch.json', { isTemporary: true })
    workflowStore.activeWorkflow = scratch
    mockMessagesEndpoint('wf-42', [{ id: 'wf-42', name: 'current' }])

    await renderAndSend('first message')

    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('wf-42')
    ).toBeUndefined()
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(scratch.path)
    ).toBeUndefined()
  })

  it('stages a mention pick without selecting it on canvas', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    expect(await screen.findByText('KSampler')).toBeInTheDocument()
    expect([...state.selectedItems]).toEqual([])
    expect(state.selectItems).not.toHaveBeenCalled()
    expect(useTelemetry()!.trackAgentNodeTagged).toHaveBeenCalledTimes(1)
    expect(useTelemetry()!.trackAgentNodeTagged).toHaveBeenCalledWith({
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

    renderWithSelectedTarget()

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('@')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText('#5')).toBeInTheDocument()
    expect(screen.getByText('#7')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Tab}')

    expect(useAgentComposerStore().draft).toBe(' ')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getAllByText('KSampler')).toHaveLength(1)
    expect(screen.getByText('#7')).toBeInTheDocument()
    await sendFromComposer('tune it')

    expect(bodies[0]).toMatchObject({
      content: '@[Node: KSampler #7] tune it',
      selection: { node_ids: ['7'] }
    })
  })

  it('keeps asset actions out of the @ Reference menu', async () => {
    makeTab('wf-42')

    renderWithSelectedTarget()
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('@')

    expect(screen.getByRole('menuitem', { name: 'Nodes' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Workflows' })).toBeVisible()
    expect(screen.queryByText('Sunset.png')).not.toBeInTheDocument()
    expect(useAgentComposerStore().draft).toBe('@')
  })

  it('offers both open and closed Cloud-backed workflows', async () => {
    makeTab('wf-current')
    const other = addTab('workflows/other.json')
    useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
    mockMessagesEndpoint('wf-current', [
      { id: 'wf-remote', name: 'Remote workflow' }
    ])

    renderWithSelectedTarget()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))

    expect(await screen.findByRole('menuitem', { name: 'other' })).toBeVisible()
    expect(
      await screen.findByRole('menuitem', { name: 'Remote workflow' })
    ).toBeVisible()
  })

  it('offers an open tab after it is saved while the panel remains mounted', async () => {
    makeTab('wf-current')
    const savedLater = addTab('workflows/video_minimax_h3_i2v.json', {
      isTemporary: true
    })
    const cloudWorkflows: { id: string; name: string }[] = []
    mockMessagesEndpoint('wf-current', cloudWorkflows)

    renderWithSelectedTarget()
    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    expect(
      screen.getByRole('menuitem', { name: /video_minimax_h3_i2v\s*Unsaved/ })
    ).toBeVisible()

    await userEvent.keyboard('{Escape}')
    await userEvent.clear(textbox)
    Object.assign(workflowStore.getWorkflowByPath(savedLater.path)!, {
      isTemporary: false
    })
    cloudWorkflows.push({
      id: 'wf-video',
      name: 'video_minimax_h3_i2v'
    })

    await userEvent.click(textbox)
    await userEvent.paste('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))

    expect(
      await screen.findByRole('menuitem', { name: 'video_minimax_h3_i2v' })
    ).toBeVisible()
  })

  it('does not let an older workflow refresh overwrite a newer result', async () => {
    makeTab('wf-current')
    addTab('workflows/video_minimax_h3_i2v.json')
    let resolveInitial!: (response: Response) => void
    const initialWorkflowResponse = new Promise<Response>((resolve) => {
      resolveInitial = resolve
    })
    let workflowRequestCount = 0
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/workflows')) {
        workflowRequestCount++
        if (workflowRequestCount === 1) return initialWorkflowResponse
        return Promise.resolve(
          json(200, {
            data: [{ id: 'wf-video', name: 'video_minimax_h3_i2v' }],
            pagination: {
              offset: 0,
              limit: 100,
              total: 1,
              has_more: false
            }
          })
        )
      }
      if (url.includes('/agent/threads'))
        return Promise.resolve(json(200, agentThreadList()))
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    renderWithSelectedTarget()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    expect(
      await screen.findByRole('menuitem', { name: 'video_minimax_h3_i2v' })
    ).toBeVisible()

    resolveInitial(
      json(200, {
        data: [],
        pagination: {
          offset: 0,
          limit: 100,
          total: 0,
          has_more: false
        }
      })
    )
    await nextTick()
    await nextTick()

    expect(
      screen.getByRole('menuitem', { name: 'video_minimax_h3_i2v' })
    ).toBeVisible()
  })

  it('sends no workflow id for an unbound tab and posts exactly once', async () => {
    const tab = makeTab()
    tab.activeState = fromPartial<ComfyWorkflowJSON>({
      id: 'graph-internal-id-not-a-cloud-id'
    })
    appMock.graph.nodes = [{ id: 1 }]
    const bodies: unknown[] = []
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

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
      }
    )

    await renderAndSend('build a graph')

    expect(bodies).toHaveLength(1)
    expect(bodies[0]).not.toHaveProperty('workflow_id')
    expect(bodies[0]).not.toHaveProperty('open_tabs')
    expect(bodies[0]).not.toHaveProperty('current_tab')
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('disables target selection for an active turn and ignores agent tab changes for attribution', async () => {
    makeTab('wf-42')
    const other = addTab('workflows/other.json')
    useAgentWorkflowTabBindingStore().bind('wf-other', other.path)
    const bodies = mockMessagesEndpoint('wf-42')

    await renderAndSend('first turn')
    const selector = screen.getByRole('button', {
      name: i18n.global.t('agent.switchWorkflow')
    })
    expect(selector).toBeDisabled()

    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-other',
      name: 'other',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(other)
    )
    expect(selector).toHaveTextContent('current')

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })
    await sendFromComposer('second turn')
    expect(bodies[1]).toMatchObject({
      workflow_id: 'wf-42'
    })
  })

  it('binds a minted workflow to its unsaved tab and subscribes once', async () => {
    const tab = makeTab()
    Object.assign(tab, { isTemporary: true })
    mockMessagesEndpoint('wf-fresh')

    await renderAndSend('build a graph')

    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-fresh')).toBe(
      tab.path
    )
    const subscribes = socketSend.mock.calls
      .map(
        ([frame]) =>
          JSON.parse(String(frame)) as { type: string; data: unknown }
      )
      .filter(({ type }) => type === 'doc_subscribe')
    expect(subscribes).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ workflow_id: 'wf-fresh' })
      })
    ])
  })

  it('does not subscribe a minted workflow after its tab is backgrounded', async () => {
    const origin = makeTab()
    Object.assign(origin, { isTemporary: true })
    const background = addTab('workflows/background.json')
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          workflowStore.activeWorkflow = background
          return json(202, ack('wf-fresh', 'm-1'))
        }
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        if (url.includes('/workflows'))
          return json(200, {
            data: [],
            pagination: {
              offset: 0,
              limit: 100,
              total: 0,
              has_more: false
            }
          })
        return new Response('{}', { status: 200 })
      }
    )

    await renderAndSend('build a graph')

    expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-fresh')).toBe(
      origin.path
    )
    expect(
      socketSend.mock.calls.some(([frame]) =>
        String(frame).includes('doc_subscribe')
      )
    ).toBe(false)
  })

  it.for([
    ...[
      {
        nextAction: 'untouched',
        expectedDraft: '',
        act: () => Promise.resolve()
      },
      {
        nextAction: 'new-draft',
        expectedDraft: 'New input',
        act: async (textbox: HTMLElement) => {
          await userEvent.click(textbox)
          await userEvent.paste('New input')
        }
      },
      {
        nextAction: 'cleared-draft',
        expectedDraft: '',
        act: async (textbox: HTMLElement) => {
          await userEvent.click(textbox)
          await userEvent.paste('New input')
          await userEvent.clear(textbox)
        }
      },
      {
        nextAction: 'removed-reference',
        expectedDraft: '',
        act: async () => {
          await userEvent.click(
            screen.getByRole('button', {
              name: i18n.global.t('agent.addToPrompt')
            })
          )
          await userEvent.click(
            screen.getByRole('menuitem', { name: 'Workflows' })
          )
          await userEvent.click(
            await screen.findByRole('menuitem', { name: 'reference' })
          )
          await userEvent.click(
            screen.getByRole('button', { name: 'Remove reference reference' })
          )
        }
      },
      {
        nextAction: 'removed-attachment',
        expectedDraft: '',
        act: async () => {
          useAgentComposerStore().addAttachment({
            id: 'upload-2',
            name: 'new.png',
            ref: 'new.png'
          })
          await userEvent.click(
            await screen.findByRole('button', {
              name: i18n.global.t('agent.removeAsset', { name: 'new.png' })
            })
          )
        }
      },
      {
        nextAction: 'new-chat',
        expectedDraft: '',
        act: async () => {
          await userEvent.click(
            screen.getByRole('button', { name: i18n.global.t('agent.newChat') })
          )
        }
      },
      {
        nextAction: 'history',
        expectedDraft: '',
        act: async () => {
          await userEvent.click(
            screen.getByRole('button', {
              name: i18n.global.t('agent.showChatHistory')
            })
          )
          await userEvent.click(await screen.findByText('Earlier chat'))
        }
      }
    ].flatMap((scenario) =>
      ['mounted', 'reopened'].map((panel) => ({ ...scenario, panel }))
    ),
    {
      nextAction: 'untouched',
      panel: 'closed',
      expectedDraft: '',
      act: () => Promise.resolve()
    },
    {
      nextAction: 'stop',
      panel: 'reopened',
      expectedDraft: '',
      act: async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
      }
    }
  ])(
    'settles a submission without losing composer intent: $nextAction ($panel)',
    async ({ nextAction, panel, expectedDraft, act }) => {
      setupWorkflowContext({
        targetId: 'wf-42',
        references: [
          { path: 'workflows/reference.json', workflowId: 'wf-reference' }
        ]
      })
      const bodies: Record<string, unknown>[] = []
      const cancellations: string[] = []
      let finishSend: (response: Response) => void = () => {}
      const response = new Promise<Response>((resolve) => {
        finishSend = resolve
      })
      vi.mocked(fetch).mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)

          if (url.endsWith('/cancel')) {
            cancellations.push(url)
            return json(200, {})
          }
          if (url.includes('/messages') && init?.method === 'POST') {
            bodies.push(
              JSON.parse(String(init.body)) as Record<string, unknown>
            )
            return bodies.length === 1 ? response : json(202, ack('wf-42'))
          }
          if (url.includes('/messages')) return json(200, [])
          if (url.includes('/agent/threads'))
            return json(
              200,
              agentThreadList([
                agentThread({
                  id: 'th-earlier',
                  title: 'Earlier chat',
                  last_message_at: '2026-09-01T00:00:00Z'
                })
              ])
            )
          if (url.includes('/workflows'))
            return json(200, {
              data: [],
              pagination: { offset: 0, limit: 100, total: 0, has_more: false }
            })
          return json(200, {})
        }
      )
      setupNodeSelectionCanvas()
      const first = renderWithSelectedTarget()
      useAgentPanelStore().isOpen = true
      let textbox = screen.getByRole('textbox')
      const composer = useAgentComposerStore()
      composer.replaceDraft({
        text: 'Compare  Keep this draft ',
        workflowReferences: [
          { id: 'wf-reference', name: 'reference', textOffset: 8 }
        ],
        attachments: [
          {
            id: 'upload-1',
            name: 'cat.png',
            ref: 'uploaded_cat.png'
          }
        ]
      })
      composer.setNodes([{ id: '12', title: 'KSampler' }])
      composer.setInsertionPoint({
        textOffset: composer.draft.length,
        referenceIndex: composer.prompt.references.length
      })
      composer.referenceAttachment('upload-1')
      const originalDraft = composer.draft
      const originalReferences = [...composer.workflowReferences]
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await vi.waitFor(() => expect(bodies).toHaveLength(1))
      expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible()
      expect(useAgentComposerStore().draft).toBe('')
      expect(composer.attachments).toEqual([])
      expect(
        screen.queryByRole('button', { name: 'Open reference' })
      ).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Remove KSampler #12 reference' })
      ).toBeNull()
      if (panel !== 'mounted') first.unmount()
      if (panel === 'reopened') {
        render(AgentPanelRoot, { global: { plugins: [i18n] } })
        textbox = screen.getByRole('textbox')
        expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible()
      }
      await act(textbox)
      expect(cancellations).toHaveLength(0)
      finishSend(
        nextAction === 'stop'
          ? json(202, ack('wf-42', 'm-stopped'))
          : json(500, { error: 'Unavailable' })
      )
      if (nextAction === 'stop') {
        await vi.waitFor(() => expect(cancellations).toHaveLength(1))
        expect(cancellations[0]).toContain('m-stopped')
        expect(composer.draft).toBe('')
        expect(composer.workflowReferences).toEqual([])
        return
      }
      if (panel === 'closed') {
        await vi.waitFor(() =>
          expect(composer.submission?.phase).toBe('failed')
        )
        render(AgentPanelRoot, { global: { plugins: [i18n] } })
      }
      await vi.waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
      )
      if (nextAction === 'untouched') {
        expect(useAgentComposerStore().draft).toBe(originalDraft)
        expect(composer.workflowReferences).toEqual(originalReferences)
        expect(composer.attachments).toMatchObject([
          { ref: 'uploaded_cat.png' }
        ])
        expect(
          screen.getByRole('button', { name: 'Open reference' })
        ).toBeVisible()
        expect(
          screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
        ).toBeVisible()
        await userEvent.click(screen.getByRole('button', { name: 'Send' }))
        await vi.waitFor(() => expect(bodies).toHaveLength(2))
        expect(bodies[1]).toMatchObject({
          workflow_id: 'wf-42',
          content:
            '@[Node: KSampler #12] Compare [reference](workflow://wf-reference) Keep this draft @[Image: cat.png]',
          selection: { node_ids: ['12'] },
          attachments: ['uploaded_cat.png'],
          workflow_references: [
            { workflow_id: 'wf-reference', name: 'reference' }
          ]
        })
      } else {
        expect(useAgentComposerStore().draft).toBe(expectedDraft)
        expect(composer.attachments).toEqual([])
        expect(
          screen.queryByRole('button', { name: 'Open reference' })
        ).toBeNull()
        if (nextAction === 'new-chat')
          expect(useAgentConversationStore().entries).toHaveLength(0)
      }
    }
  )

  it('cancels and restores the draft when its target closes during preparation', async () => {
    const origin = makeTab('wf-origin')
    origin.activeState = fromPartial<ComfyWorkflowJSON>({ id: 'origin-draft' })
    const replacement = addTab('workflows/replacement.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'replacement-draft' })
    })
    useAgentWorkflowTabBindingStore().bind('wf-replacement', replacement.path)
    const bodies: Record<string, unknown>[] = []
    let workflowRequests = 0
    let releasePreparation: () => void = () => undefined
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url.includes('/messages') && init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
          return json(202, ack('wf-fresh', 'm-1'))
        }
        if (url.includes('/messages')) return json(200, [])
        if (url.includes('/agent/threads')) return json(200, agentThreadList())
        if (url.includes('/workflows')) {
          workflowRequests++
          if (workflowRequests > 1)
            await new Promise<void>((resolve) => {
              releasePreparation = resolve
            })
          return json(200, {
            data: [],
            pagination: { offset: 0, limit: 100, total: 0, has_more: false }
          })
        }
        return new Response('{}', { status: 200 })
      }
    )

    renderWithSelectedTarget()
    await vi.waitFor(() => expect(workflowRequests).toBe(1))
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('build a graph')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(workflowRequests).toBe(2))
    await workflowStore.closeWorkflow(
      workflowStore.getWorkflowByPath(origin.path)!
    )
    workflowStore.activeWorkflow = replacement
    releasePreparation()

    await vi.waitFor(() =>
      expect(useAgentComposerStore().draft).toBe('build a graph')
    )
    expect(bodies).toHaveLength(0)
    expect(useAgentPanelStore().selectedWorkflow).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('wf-fresh')
    ).toBeUndefined()
    expect(
      useAgentWorkflowTabBindingStore().workflowIdFor(replacement.path)
    ).toBe('wf-replacement')
    expect(
      socketSend.mock.calls.some(([frame]) =>
        String(frame).includes('doc_subscribe')
      )
    ).toBe(false)
  })

  it('sends only the remaining chip after one is dismissed', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42', [
      { id: 'wf-42', name: 'current' }
    ])
    appMock.graph.nodes = [
      { id: 5, title: 'KSampler' },
      { id: 7, title: 'VAEDecode' }
    ]

    renderWithSelectedTarget()
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
    expect(useTelemetry()!.trackAgentMessageSent).toHaveBeenCalledWith({
      attachment_count: 0,
      node_tag_count: 1,
      thread_id: null,
      workflow_id: 'wf-42',
      client_message_id: 'client-message-1',
      input_method: 'typed',
      starter_prompt_id: null,
      starter_prompt_click_id: null
    })
    expect(screen.getByText('VAEDecode #7')).toBeInTheDocument()
    expect(screen.queryByText(/KSampler/)).not.toBeInTheDocument()
  })

  it('removes a reference chip without changing canvas selection', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    state.selectedItems.add(state.nodes[0])
    syncFakeSelection()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    const matches = await screen.findAllByText('KSampler')
    await userEvent.click(matches[matches.length - 1])

    expect(screen.getByText('KSampler')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
    )

    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
    expect(state.deselect).not.toHaveBeenCalled()
    expect(focusNodeInstance).not.toHaveBeenCalled()

    expect([...state.selectedItems]).toEqual([state.nodes[0]])
    expect(canvasStore.selectedItems).toEqual([state.nodes[0]])
  })

  it.for([1, 2])(
    'redraws the canvas after removing an inline node from %i selected nodes',
    async (count) => {
      makeTab()
      mockMessagesEndpoint('wf-42')
      const state = setupOwnedSelectionCanvas()
      const other = new LGraphNode('VAE Decode')
      state.subgraph.add(other)
      vi.spyOn(state.canvas, 'animateToBounds').mockImplementation(() => {})
      renderWithSelectedTarget()
      useAgentPanelStore().isOpen = true
      await enterNodeSelectionMode()
      const selected = [state.subgraphNode, other].slice(0, count)
      state.canvas.selectItems(selected)
      syncFakeSelection()
      await nextTick()
      state.canvas.dirty_canvas = false

      await userEvent.click(
        screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
      )

      expect(
        screen.queryByRole('button', { name: 'Remove KSampler #12 reference' })
      ).toBeNull()
      expect([...state.canvas.selectedItems]).toEqual(selected.slice(1))
      expect(state.subgraphNode.selected).toBe(false)
      expect(state.canvas.dirty_canvas).toBe(true)
    }
  )

  it('does not expose a canvas-focus action on a reference chip', async () => {
    makeTab()
    setupNodeSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    expect(
      screen.queryByRole('button', { name: 'Show KSampler #12 on canvas' })
    ).toBeNull()
    expect(focusNodeInstance).not.toHaveBeenCalled()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('uses graph-scoped identity for removal and picker exclusion', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    const subgraphNode = nestSelectionCanvasInSubgraph(state)
    const referencedNode = state.nodes[1]
    referencedNode.id = toNodeId('shared')
    referencedNode.title = 'Subgraph twin'
    const rootTwin: LGraphNode = createMockLGraphNode({
      isNodeFake: true,
      id: 'shared',
      title: 'Root twin',
      boundingRect: {}
    })
    appMock.graph.nodes = [subgraphNode, rootTwin]

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('Subgraph twin'))

    showRootGraph(state, [rootTwin])
    state.selectedItems.add(rootTwin)
    syncFakeSelection()
    await nextTick()

    await openMentionPicker()
    expect(
      within(screen.getByRole('menu')).getByText('Root twin')
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove Subgraph twin #shared reference'
      })
    )
    expect(state.deselect).not.toHaveBeenCalled()
    expect([...state.selectedItems]).toEqual([rootTwin])
  })

  it('updates the open node picker when the viewed graph changes without editing the prompt', async () => {
    makeTab('wf-42')
    const state = setupOwnedSelectionCanvas()
    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true
    await openMentionPicker()
    expect(screen.getByRole('menuitem', { name: 'KSampler' })).toBeVisible()
    const prompt = useAgentComposerStore().prompt

    viewGraph(state.canvas, state.rootGraph)

    expect(
      await screen.findByRole('menuitem', { name: 'Root node' })
    ).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'KSampler' })).toBeNull()
    expect(useAgentComposerStore().prompt).toEqual(prompt)
    expect(useAgentComposerStore().nodes).toEqual([])
  })

  it('lists target nodes loaded after opening the reference menu', async () => {
    makeTab('wf-42')
    const state = setupNodeSelectionCanvas()
    showRootGraph(state)
    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    const textbox = screen.getByRole('textbox')
    await userEvent.click(textbox)
    await userEvent.paste('Use @')
    showRootGraph(state, state.nodes)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nodes' }))

    expect(screen.getByRole('menuitem', { name: 'VAE Decode' })).toBeVisible()
    await userEvent.click(screen.getByRole('menuitem', { name: 'KSampler' }))
    expect(useAgentComposerStore().nodes).toEqual([
      { id: '12', locatorId: '12', title: 'KSampler' }
    ])
    await userEvent.paste('next')
    expect(useAgentComposerStore().draft).toBe('Use  next')
    expect(screen.getByTestId('node-reference-chip')).toHaveTextContent(
      'KSampler'
    )
  })

  it('excludes referenced nodes from the mention picker', async () => {
    makeTab()
    setupNodeSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await openMentionPicker()

    const menu = screen.getByRole('menu')
    expect(within(menu).queryByText('KSampler')).not.toBeInTheDocument()
    expect(within(menu).getByText('VAE Decode')).toBeInTheDocument()
  })

  it('keeps reference chips unchanged after normal graph selection', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    state.selectedItems.clear()
    state.selectedItems.add(state.nodes[0])
    syncFakeSelection()
    await nextTick()

    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
  })

  it('merges referenced nodes with the existing graph selection when node-selection mode starts', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    state.selectedItems.clear()
    state.selectedItems.add(state.nodes[0])
    syncFakeSelection()
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
    const { canvas, rootGraph, rootNode, subgraphNode } =
      setupOwnedSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    viewGraph(canvas, rootGraph)
    canvas.select(rootNode)
    syncFakeSelection()
    const selectItems = vi.spyOn(canvas, 'selectItems')
    await nextTick()

    await enterNodeSelectionMode()

    expect(selectItems).toHaveBeenCalledWith([rootNode, subgraphNode])
    expect([...canvas.selectedItems]).toEqual([rootNode])
    expect(subgraphNode.selected).toBeFalsy()
    expect(screen.getByText('Root node')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('keeps every staged reference and the incoming graph saved selection when the viewed graph is replaced while picking', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const { canvas, rootGraph, subgraph, rootNode, subgraphNode } =
      setupOwnedSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))

    viewGraph(canvas, rootGraph)
    canvas.select(rootNode)
    syncFakeSelection()
    await nextTick()
    await enterNodeSelectionMode()
    expect(screen.getByText('Root node')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
    saveSelection(subgraph, subgraphNode)

    viewGraph(canvas, subgraph)
    syncFakeSelection()
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(false)
    expect([...canvas.selectedItems]).toEqual([subgraphNode])
    expect(savedSelectionKeys(rootGraph)).toEqual([])
    expect(savedSelectionKeys(subgraph)).toEqual(['node:12'])
    expect(screen.getByText('Root node')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('restores an off-view subgraph context chip without a focus action', async () => {
    makeTab()
    const state = setupNodeSelectionCanvas()
    const subgraphNode = nestSelectionCanvasInSubgraph(state)
    const referencedNode = state.nodes[1]
    referencedNode.id = toNodeId('shared')
    referencedNode.title = 'Subgraph twin'
    const rootTwin: LGraphNode = createMockLGraphNode({
      isNodeFake: true,
      id: 'shared',
      title: 'Root twin',
      boundingRect: {}
    })
    appMock.graph.nodes = [subgraphNode, rootTwin]
    const panelStore = useAgentPanelStore()

    const first = renderWithSelectedTarget()
    panelStore.isOpen = true
    await openMentionPicker()
    await userEvent.click(await screen.findByText('Subgraph twin'))

    showRootGraph(state, [rootTwin])
    panelStore.isOpen = false
    await nextTick()
    first.unmount()

    renderWithSelectedTarget()
    panelStore.isOpen = true
    await nextTick()

    expect(screen.getByText('Subgraph twin')).toBeInTheDocument()
    expect(screen.queryByText('Root twin')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Show Subgraph twin #shared on canvas'
      })
    ).toBeNull()
    expect(focusNodeInstance).not.toHaveBeenCalled()
  })
  it('allows nodes on first entry and keeps their target when viewing another workflow', async () => {
    const target = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    setupNodeSelectionCanvas()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('@')
    const action = screen.getByRole('menuitem', { name: 'Nodes' })
    expect(action).not.toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(action)
    await userEvent.click(await screen.findByText('KSampler'))

    workflowStore.activeWorkflow = addTab('workflows/other.json')
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    expect(
      screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
    ).toBeVisible()
    expect(canvasStore.isPickingNodes).toBe(false)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('@')
    const nodesMenu = screen.getByRole('menuitem', { name: 'Nodes' })
    expect(nodesMenu).toHaveAttribute('aria-disabled', 'true')
    expect(nodesMenu).toHaveAccessibleDescription(
      'Switch to current to add nodes.'
    )
    await userEvent.click(nodesMenu)
    expect(canvasStore.isPickingNodes).toBe(false)
    workflowStore.activeWorkflow = target
    await nextTick()
    expect(screen.getByRole('menuitem', { name: 'Nodes' })).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('resumes following on New Chat after all node references are removed', async () => {
    const {
      target,
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const bodies = mockMessagesEndpoint('wf-42')
    setupNodeSelectionCanvas()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true
    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
    )
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('Keep this draft')
    workflowStore.activeWorkflow = other
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))

    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    ).toHaveTextContent('other')
    expect(screen.getByRole('textbox')).toHaveTextContent('Keep this draft')
    workflowStore.activeWorkflow = target
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await vi.waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({
      content: 'Keep this draft',
      workflow_id: 'wf-42'
    })
    expect(bodies[0]).not.toHaveProperty('selection')
  })

  it.for(['current', 'other'] as const)(
    'preserves carried node references through New Chat while viewing $0',
    async (visibleTab) => {
      const tabs = {
        current: makeTab('wf-42'),
        other: addTab('workflows/other.json')
      }
      const bodies = mockMessagesEndpoint('wf-42')
      setupNodeSelectionCanvas()
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      useAgentPanelStore().isOpen = true
      await openMentionPicker()
      await userEvent.click(await screen.findByText('KSampler'))
      await userEvent.paste('Keep these nodes')
      workflowStore.activeWorkflow = tabs[visibleTab]
      await nextTick()

      await userEvent.click(screen.getByRole('button', { name: 'New chat' }))

      expect(
        screen.getByRole('button', {
          name: i18n.global.t('agent.switchWorkflow')
        })
      ).toHaveTextContent('current')
      expect(screen.getByRole('textbox')).toHaveTextContent('Keep these nodes')
      expect(
        screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
      ).toBeVisible()

      workflowStore.activeWorkflow = addTab('workflows/third.json')
      await nextTick()
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await vi.waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({
        content: '@[Node: KSampler #12] Keep these nodes',
        workflow_id: 'wf-42',
        selection: { node_ids: ['12'], workflow_id: 'wf-42' }
      })
    }
  )

  it('clears old node references when selecting another workflow with the same node id', async () => {
    const {
      references: [other]
    } = setupWorkflowContext({
      targetId: 'wf-42',
      references: [{ path: 'workflows/other.json', workflowId: 'wf-other' }]
    })
    const bodies = mockMessagesEndpoint('wf-other')
    setupNodeSelectionCanvas()
    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true
    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    expect(
      screen.getByRole('button', { name: 'Remove KSampler #12 reference' })
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.switchWorkflow')
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'other' })
    )
    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    )
    expect(
      screen.queryByRole('button', { name: 'Remove KSampler #12 reference' })
    ).toBeNull()
    await sendFromComposer('edit the other workflow')
    expect(bodies[0]).toMatchObject({ workflow_id: 'wf-other' })
    expect(bodies[0]).not.toHaveProperty('selection')
  })

  it('keeps staged target nodes separate from a different viewed workflow restore', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true
    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    workflowStore.activeWorkflow = addTab('workflows/other.json')
    await nextTick()
    state.selectedItems.add(state.nodes[0])
    syncFakeSelection()
    await nextTick()
    expect(
      screen.queryByRole('button', { name: 'Remove VAE Decode #9 reference' })
    ).toBeNull()
    await sendFromComposer('edit the selected workflow')
    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',
      selection: { node_ids: ['12'], workflow_id: 'wf-42' }
    })
  })

  it('does not resend a canvas selection after its chip was consumed', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42', [
      { id: 'wf-42', name: 'current' }
    ])
    const state = setupNodeSelectionCanvas()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    expect(await screen.findByText('KSampler')).toBeInTheDocument()

    await sendFromComposer('first ask')
    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['12'] } })

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })

    expect([...state.selectedItems]).toEqual([])
    await sendFromComposer('second ask')
    expect(bodies[1]).not.toHaveProperty('selection')
  })

  it('keeps normal graph selections out of the composer across a panel remount', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42', [
      { id: 'wf-42', name: 'current' }
    ])
    appMock.graph.nodes = [{ id: 7, title: 'KSampler' }]

    const panelStore = useAgentPanelStore()
    const first = renderWithSelectedTarget()
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

    renderWithSelectedTarget()
    panelStore.isOpen = true
    await nextTick()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
    await sendFromComposer('no nodes please')

    expect(bodies[0]).not.toHaveProperty('selection')

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-1',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })
    setCanvasSelection(
      fromPartial([
        createMockLGraphNode({ isNodeFake: true, id: 7, title: 'KSampler' })
      ])
    )
    await nextTick()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
    await sendFromComposer('still no nodes')
    expect(bodies[1]).not.toHaveProperty('selection')

    dispatchApiEvent('agent_message_done', {
      message_id: 'm-2',
      thread_id: 'th-1'
    })
    await screen.findByRole('button', { name: 'Send' })
    setCanvasSelection(
      fromPartial([
        createMockLGraphNode({ isNodeFake: true, id: 8, title: 'VAEDecode' })
      ])
    )
    await nextTick()
    expect(screen.queryByText('VAEDecode')).not.toBeInTheDocument()
    await sendFromComposer('use the new selection')
    expect(bodies[2]).not.toHaveProperty('selection')
  })

  it('stages the same node id in another unsaved workflow after a panel remount', async () => {
    workflowStore.activeWorkflow = addTab('workflows/Unsaved Workflow.json', {
      isTemporary: true
    })
    const bodies = mockMessagesEndpoint('wf-42')
    const panelStore = useAgentPanelStore()
    appMock.graph.nodes = [{ id: 7, title: 'First KSampler' }]
    const first = renderWithSelectedTarget()
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

    workflowStore.activeWorkflow = addTab(
      'workflows/Unsaved Workflow (2).json',
      { isTemporary: true }
    )
    appMock.graph.nodes = [{ id: 7, title: 'Second KSampler' }]
    renderWithSelectedTarget()
    panelStore.isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('Second KSampler'))
    await sendFromComposer('use this workflow')
    expect(bodies[0]).toMatchObject({ selection: { node_ids: ['7'] } })
  })

  it('keeps following when node selection opens without adding any nodes', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    setupNodeSelectionCanvas()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true
    await enterNodeSelectionMode()
    expect(canvasStore.isPickingNodes).toBe(true)
    const other = addTab('workflows/other.json')
    workflowStore.activeWorkflow = other
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(other.path)
    expect(useAgentPanelStore().followsVisibleWorkflow).toBe(true)
  })

  it('retains the target when a canvas node is actually added before Send', async () => {
    const target = makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    useAgentPanelStore().isOpen = true
    await enterNodeSelectionMode()
    state.selectedItems.add(state.nodes[0])
    syncFakeSelection()
    await nextTick()
    expect(
      screen.getByRole('button', { name: 'Remove VAE Decode #9 reference' })
    ).toBeVisible()
    workflowStore.activeWorkflow = addTab('workflows/other.json')
    await nextTick()
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(target.path)
    await sendFromComposer('edit this node')
    expect(bodies[0]).toMatchObject({
      workflow_id: 'wf-42',
      selection: { node_ids: ['9'], workflow_id: 'wf-42' }
    })
  })

  it('keeps modifier-free legacy LiteGraph clicks selected', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const state = setupNodeSelectionCanvas()
    const selectLegacyNode = (node: LGraphNode) => {
      if (!canvasStore.isPickingNodes) state.selectedItems.clear()
      state.selectedItems.add(node)
      syncFakeSelection()
    }
    renderWithSelectedTarget()
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
    const thirdNode: LGraphNode = createMockLGraphNode({
      isNodeFake: true,
      id: 15,
      title: 'Save Image',
      boundingRect: {}
    })
    state.nodes.push(thirdNode)
    const toggleNode = (node: LGraphNode) => {
      if (state.selectedItems.has(node)) state.selectedItems.delete(node)
      else state.selectedItems.add(node)
      syncFakeSelection()
    }
    renderWithSelectedTarget()
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
    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await enterNodeSelectionMode()
    state.selectedItems.add(state.nodes[0])
    syncFakeSelection()
    state.selectItems.mockClear()

    state.selectedItems.clear()
    state.selectedItems.add(state.nodes[1])
    syncFakeSelection()
    await nextTick()

    expect([...state.selectedItems]).toEqual([state.nodes[1]])
    expect(screen.queryByText('VAE Decode')).not.toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(state.selectItems).not.toHaveBeenCalled()
  })

  it('X-03 / PM-680 / FE-1311 keeps displayed node chips identical to every sent node id', async () => {
    makeTab()
    const bodies = mockMessagesEndpoint('wf-42', [
      { id: 'wf-42', name: 'current' }
    ])
    const selection = await startVueNodeSelection()

    expect(canvasStore.isPickingNodes).toBe(true)
    expect(selection.focus).toHaveBeenCalledOnce()
    expect(selection.selectClickedNode).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()

    await sendFromComposer('explain this')

    expect(canvasStore.isPickingNodes).toBe(false)
    expect(bodies[0]).toMatchObject({
      selection: { node_ids: ['9', '12'] }
    })
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('exits selection mode on Escape and keeps the selected-node chips', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()
    render(NodeSelectionModeBanner, { global: { plugins: [i18n] } })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(false)
    expect(canvasStore.selectedItems).toEqual([])
    expect([...selection.selectedItems]).toEqual([])
    expect(screen.getByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('ends node selection when the viewed graph changes', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()
    const nextGraph = {
      nodes: [] as LGraphNode[],
      getNodeById: () => null
    }

    selection.canvas.graph = nextGraph
    canvasStore.currentGraph = fromPartial(nextGraph)
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('ends node selection when the active workflow changes during a graph load', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()
    workflowStore.activeWorkflow = addTab('workflows/other.json')
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('keeps node selection active when the active workflow is renamed', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    await startVueNodeSelection()

    const active = workflowStore.activeWorkflow
    if (!active) throw new Error('expected an active workflow')
    active.path = 'workflows/renamed.json'
    active.filename = 'renamed'
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(true)
  })

  it('ends node selection when the target workflow changes', async () => {
    makeTab()
    mockMessagesEndpoint('wf-42')
    const selection = await startVueNodeSelection()

    useAgentPanelStore().setWorkflowTarget(
      fromPartial<ComfyWorkflow>(addTab('workflows/other.json'))
    )
    await nextTick()

    expect(canvasStore.isPickingNodes).toBe(false)
    await expectLaterClickCannotRestoreAccumulatedNodes(selection)
  })

  it('preserves node references after a workflow rename and panel remount', async () => {
    makeTab()
    const selection = await startVueNodeSelection()
    const active = workflowStore.activeWorkflow
    assert.exists(active)
    active.path = 'workflows/renamed.json'
    active.filename = 'renamed'
    await nextTick()
    selection.unmount()

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true
    await nextTick()

    expect(screen.getByText('VAE Decode')).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('resolves picker nodes from the viewed subgraph, not the root graph', async () => {
    makeTab('wf-42')
    const bodies = mockMessagesEndpoint('wf-42')
    appMock.canvas = {
      graph: {
        nodes: [{ id: 12, title: 'KSampler' }],
        getNodeById: () => null
      },
      selectedItems: new Set<LGraphNode>(),
      selectItems: vi.fn(),
      deselect: vi.fn(),
      canvas: document.createElement('canvas')
    }

    renderWithSelectedTarget()
    useAgentPanelStore().isOpen = true

    await openMentionPicker()
    await userEvent.click(await screen.findByText('KSampler'))
    await sendFromComposer('explain this')

    expect(bodies[0]).toMatchObject({
      selection: { node_ids: ['12'], workflow_id: 'wf-42' }
    })
  })

  it('never subscribes to the retired draft_patch frame', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('help me')

    dispatchApiEvent('draft_patch', {
      workflow_id: 'wf-42',
      base_version: 0,
      version: 1,
      content: { version: 0.4, nodes: [] }
    })
    await nextTick()
    await nextTick()
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('wires getGraph() to the live root graph, following a graph swap', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    await renderAndSend('hello')

    appMock.isGraphReady = true
    Object.assign(appMock.rootGraph, { id: 'graph-a' })
    expect(docOpMinterDeps.current?.getGraph()?.id).toBe('graph-a')

    // A workflow switch rebuilds the canvas against a new root graph without
    // touching agentPanelStore.enabled or isBoundWorkflowActive, so the
    // minter's own doc-bound predicate (covered directly against the real
    // `attachDocOpMinter` in `docOpMinter.test.ts`) has to read this live
    // graph at mint time to follow the swap.
    Object.assign(appMock.rootGraph, { id: 'graph-b' })

    expect(docOpMinterDeps.current?.getGraph()?.id).toBe('graph-b')
  })

  it('wires getGraph() to null before the graph is ready', async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')
    await renderAndSend('hello')

    Object.assign(appMock.rootGraph, { id: 'graph-a' })
    appMock.isGraphReady = false

    expect(docOpMinterDeps.current?.getGraph()).toBeNull()
  })

  it("reports the bound workflow's own stored root graph id once bound", async () => {
    makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    await vi.waitFor(() =>
      expect(docOpMinterDeps.current?.boundRootGraphId()).toBe(
        toRootGraphId('wf-42')
      )
    )
  })

  it('leaves the bound root graph id null while no workflow is bound and active', () => {
    renderWithSelectedTarget()

    expect(docOpMinterDeps.current?.boundRootGraphId()).toBeNull()
  })

  it("reports the newly bound workflow's root graph id after an active-tab switch, even though the previously bound workflow stayed correct while its tab was inactive", async () => {
    makeTab('wf-a')
    const tabB = addTab('workflows/b.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id: 'wf-b' })
    })
    useAgentWorkflowTabBindingStore().bind('wf-b', tabB.path)
    mockMessagesEndpoint('wf-a')

    await renderAndSend('start on A')

    await vi.waitFor(() =>
      expect(docOpMinterDeps.current?.boundRootGraphId()).toBe(
        toRootGraphId('wf-a')
      )
    )

    // A stays bound but leaves the screen; a write-once latch would also
    // still report wf-a here, so this alone would not catch a regression.
    workflowStore.activeWorkflow = addTab('workflows/elsewhere.json')
    await nextTick()
    expect(docOpMinterDeps.current?.boundRootGraphId()).toBe(
      toRootGraphId('wf-a')
    )

    // The agent moves the session onto B's own tab.
    dispatchApiEvent('agent_active_tab', {
      workflow_id: 'wf-b',
      thread_id: 'th-1'
    })

    await vi.waitFor(() =>
      expect(workflowStore.activeWorkflow?.path).toBe(tabB.path)
    )
    expect(docOpMinterDeps.current?.boundRootGraphId()).toBe(
      toRootGraphId('wf-b')
    )
  })

  it("reflects the bound workflow's own root graph id rotating without a rebind (regression)", async () => {
    const tab = makeTab('wf-42')
    mockMessagesEndpoint('wf-42')

    await renderAndSend('add an upscaler')

    await vi.waitFor(() =>
      expect(docOpMinterDeps.current?.boundRootGraphId()).toBe(
        toRootGraphId('wf-42')
      )
    )

    // The same bound workflow's own graph id rotates in place (LGraph.clear
    // mints a fresh uuid) without boundWorkflowId itself ever changing.
    tab.activeState = fromPartial<ComfyWorkflowJSON>({ id: 'wf-42-rotated' })

    expect(docOpMinterDeps.current?.boundRootGraphId()).toBe(
      toRootGraphId('wf-42-rotated')
    )
  })
})

describe('AgentPanelRoot sign-in and saved workflows', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
  })

  it('asks a signed-out user to sign in instead of sending, keeping the draft', async () => {
    useAuthStore().currentUser = null
    vi.mocked(useAuthStore().getUserAuthHeader).mockResolvedValue(null)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValue(false)
    const tab = addTab('workflows/current.json', { isTemporary: true })
    workflowStore.activeWorkflow = tab
    const bodies = mockMessagesEndpoint('wf-minted')
    renderWithSelectedTarget()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('build here')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await vi.waitFor(() =>
      expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() =>
      expect(useAgentComposerStore().draft).toBe('build here')
    )
    expect(bodies).toHaveLength(0)
  })

  it('sends a saved file under the id the workflow index gives it', async () => {
    const activeState = fromPartial<ComfyWorkflowJSON>({
      nodes: [{ id: 1, type: 'LoadImage' }],
      links: []
    })
    const tab = addTab('workflows/Portrait.json', {
      isTemporary: false,
      activeState
    })
    workflowStore.activeWorkflow = tab
    const bodies = mockMessagesEndpoint('wf-portrait', [
      { id: 'wf-portrait', name: 'Portrait' }
    ])
    renderWithSelectedTarget()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('build here')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await vi.waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({
      content: 'build here',
      workflow_id: 'wf-portrait',
      draft: { content: activeState }
    })
    expect(useWorkflowService().saveWorkflowAs).not.toHaveBeenCalled()
  })
})

interface AgentAccount {
  firebase: string | null
  apiKeyUser: string | null
}

const zSentFrame = z.object({
  type: z.string(),
  data: z.object({ workflow_id: z.string().optional() }).optional()
})

function signInAs({ firebase, apiKeyUser }: AgentAccount): void {
  useAuthStore().currentUser =
    firebase === null ? null : fromPartial<User>({ uid: firebase })
  useApiKeyAuthStore().currentUser =
    apiKeyUser === null ? null : { id: apiKeyUser }
}

describe('AgentPanelRoot agent socket', () => {
  it.for([
    {
      change: 'a Firebase account switch',
      before: { firebase: 'account-a', apiKeyUser: null },
      after: { firebase: 'account-b', apiKeyUser: null }
    },
    {
      change: 'a Firebase sign-out',
      before: { firebase: 'account-a', apiKeyUser: null },
      after: { firebase: null, apiKeyUser: null }
    },
    {
      change: "an API key replaced by another account's",
      before: { firebase: null, apiKeyUser: 'key-user-a' },
      after: { firebase: null, apiKeyUser: 'key-user-b' }
    },
    {
      change: 'an API key cleared',
      before: { firebase: null, apiKeyUser: 'key-user-a' },
      after: { firebase: null, apiKeyUser: null }
    }
  ])(
    'reconnects the socket and looks the identity up again on $change',
    async ({ before, after }) => {
      const reset = vi.fn()
      vi.mocked(resolveAgentIdentity).mockReturnValue({
        state: ref<AgentIdentityState>({
          status: 'resolved',
          userId: 'account-a'
        }),
        reset,
        stop: () => {}
      })
      signInAs(before)
      render(AgentPanelRoot, { global: { plugins: [i18n] } })
      agentSocket.reconnect.mockClear()

      signInAs(after)
      await nextTick()

      expect(agentSocket.reconnect).toHaveBeenCalledOnce()
      expect(reset).toHaveBeenCalledOnce()
    }
  )

  it('opens the events socket under the api base path', async () => {
    vi.mocked(api.apiURL).mockImplementation((route) => `/comfy/api${route}`)
    render(AgentPanelRoot, { global: { plugins: [i18n] } })

    expect(createAgentEventSource).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/comfy/api/agent/events' })
    )
  })
})

describe('AgentPanelRoot agent socket identity', () => {
  beforeEach(() => {
    vi.mocked(resolveAgentIdentity).mockReset()
    vi.mocked(reportError).mockImplementation(() => {})
  })

  afterEach(() => {
    Object.assign(appMock, { isGraphReady: undefined })
  })

  function bindActiveTab(id: string): LoadedComfyWorkflow {
    const tab = addTab('workflows/current.json', {
      activeState: fromPartial<ComfyWorkflowJSON>({ id })
    })
    workflowStore.activeWorkflow = tab
    useAgentWorkflowTabBindingStore().bind(id, tab.path)
    return tab
  }

  function identityResponse(): Response {
    return json(200, { workspace_id: 'ws-local', user_id: 'local-user' })
  }

  function subscribeAttempts(): string[] {
    return agentSocket.send.mock.calls
      .map(([frame]) => zSentFrame.parse(JSON.parse(frame)))
      .filter((frame) => frame.type === 'doc_subscribe')
      .map((frame) => frame.data?.workflow_id ?? '')
  }

  it('retries a failed identity lookup and activates the follower once it resolves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const identity = vi
      .fn<() => Response>()
      .mockImplementationOnce(() => {
        throw new Error('identity route down')
      })
      .mockImplementation(identityResponse)
    mockMessagesEndpoint('wf-42')
    respondToFetch(/\/agent\/identity$/, async () => identity())
    bindActiveTab('wf-42')
    useAgentPanelStore().enabled = true

    await renderAndSend('first message')
    await vi.advanceTimersByTimeAsync(0)

    expect(identity).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_resolving_agent_identity'
      })
    )
    expect(subscribeAttempts()).toEqual([])

    await vi.advanceTimersByTimeAsync(1_000)

    expect(identity).toHaveBeenCalledTimes(2)
    expect(subscribeAttempts()).toEqual(['wf-42'])
  })

  it.for([
    { reason: 'the backend rejects the credential', status: 401 },
    { reason: 'the backend has no identity route', status: 404 }
  ])(
    'looks the identity up once and seeds the draft when $reason',
    async ({ status }) => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const identity = vi.fn(async () => json(status, { error: 'refused' }))
      const bodies = mockMessagesEndpoint('wf-42')
      respondToFetch(/\/agent\/identity$/, identity)
      bindActiveTab('wf-42')
      useAgentPanelStore().enabled = true

      await renderAndSend('first message')
      await vi.advanceTimersByTimeAsync(60_000)
      ws.emit('agent_message_done', { message_id: 'm-1', thread_id: 'th-1' })
      await screen.findByRole('button', { name: 'Send' })
      await sendFromComposer('second message')

      expect(identity).toHaveBeenCalledOnce()
      expect(bodies[1]).toMatchObject({
        workflow_id: 'wf-42',
        draft: { content: expect.anything() }
      })
    }
  )

  it.for([
    {
      minter: 'canvas edit',
      isDocBound: () => docOpMinterDeps.current?.isDocBound()
    },
    {
      minter: 'restored node',
      isDocBound: () =>
        vi.mocked(attachRestoreOpMinter).mock.lastCall?.[0].isDocBound()
    }
  ])(
    'does not mint a $minter until the identity resolves and the subscribe has gone out',
    async ({ isDocBound }) => {
      let resolveIdentity!: (response: Response) => void
      mockMessagesEndpoint('wf-42')
      respondToFetch(
        /\/agent\/identity$/,
        () =>
          new Promise<Response>((resolve) => {
            resolveIdentity = resolve
          })
      )
      agentSocket.send.mockReturnValue(false)
      bindActiveTab('wf-42')
      useAgentPanelStore().enabled = true

      await renderAndSend('first message')
      expect(isDocBound()).toBe(false)

      resolveIdentity(identityResponse())
      await vi.waitFor(() => expect(subscribeAttempts()).toEqual(['wf-42']))
      expect(isDocBound()).toBe(false)

      agentSocket.send.mockReturnValue(true)
      agentSocket.open()

      await vi.waitFor(() => expect(isDocBound()).toBe(true))
    }
  )
})

function dispatchApiEvent(type: string, detail: unknown): void {
  ws.emit(type, detail)
}
