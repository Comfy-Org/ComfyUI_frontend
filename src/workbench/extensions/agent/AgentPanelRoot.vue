<script setup lang="ts">
import './agentPanel.css'

import { useClipboard } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  provide,
  readonly,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { createGraphMutations } from '@/core/graph/graphMutations'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useAppMode } from '@/composables/useAppMode'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { fetchDroppedAsset, getDroppedAsset } from '@/utils/eventUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { AGENT_ATTACH_ACCEPT, isAgentAttachable } from './utils/attachableFiles'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
// The composition root injects the renderer-owned layout port; follower core
// stays independent of renderer and LiteGraph runtime values.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'

import AgentPanel from './components/agent/AgentPanel.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import {
  MAX_ATTACHMENT_BYTES,
  useAttachment
} from './composables/agent/useAttachment'
import type { ActiveTab } from './types/activeTab'
import type { SelectedNode } from './composables/agent/useCanvasSelection'
import {
  selectedNodeKey,
  useCanvasSelection
} from './composables/agent/useCanvasSelection'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import type {
  AgentActiveTabData,
  AgentThreadSummary
} from './schemas/agentApiSchema'
import type { ChatSession } from './stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from './stores/agent/agentConversationStore'
import type { WorkflowTurnContext } from './composables/agent/useAgentSession'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'
import { createAgentRestClient } from './services/agent/agentRestClient'
import type {
  DraftSnapshot,
  OpenTabsSnapshot
} from './services/agent/agentRestClient'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import {
  isCrdtDebugEnabled,
  resolveDebugPanelEnabled
} from './crdt/crdtDebugGate'
import { attachMintPortWiring } from './crdt/mintPortWiring'
import { useAgentCrdtFollower } from './crdt/useAgentCrdtFollower'

const CrdtDevPanel = defineAsyncComponent(
  () => import('./crdt/CrdtDevPanel.vue')
)

const { t } = useI18n()
const toast = useToastStore()
const sidebarTabStore = useSidebarTabStore()
const { isBuilderMode } = useAppMode()

const { resolvedUserInfo, userDisplayName } = useCurrentUser()
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

const rest = createAgentRestClient()

const events = createAgentEventSource(api)

const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const bindingStore = useAgentWorkflowTabBindingStore()
const agentPanelStore = useAgentPanelStore()
const { dismissedSelectionSignature, enabled: agentEnabled } =
  storeToRefs(agentPanelStore)
const agentNodeSelectionStore = useAgentNodeSelectionStore()
const tabActivity = useWorkflowTabActivityStore()
const CREATING_TAB_MIN_DURATION_MS = 500

const canvasStore = useCanvasStore()
const graphMutationsByWorkflow = new Map<
  string,
  ReturnType<typeof createGraphMutations>
>()
const graphMutations = (workflowId: string) => {
  const existing = graphMutationsByWorkflow.get(workflowId)
  if (existing) return existing
  const mutations = createGraphMutations({
    getScope() {
      const rootGraphId = boundTabFor(workflowId)?.activeState?.id
      return rootGraphId
        ? {
            rootGraphId: toRootGraphId(rootGraphId),
            owningGraphId: toOwningGraphId(rootGraphId)
          }
        : null
    },
    layout: {
      createNode(scope, nodeId, layout, context) {
        const { position, size } = layout
        layoutStore.applyOperation({
          type: 'createNode',
          graphId: scope.rootGraphId,
          ownerGraphId: scope.owningGraphId,
          nodeId,
          layout: {
            id: nodeId,
            position,
            size,
            bounds: { x: position.x, y: position.y, ...size },
            zIndex: layoutStore.allocateZIndex(),
            visible: true
          },
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp: Date.now()
        })
      },
      deleteNodes(scope, nodeIds, context) {
        const timestamp = Date.now()
        layoutStore.applyOperations(
          nodeIds.map((nodeId) => ({
            type: 'deleteNode',
            graphId: scope.rootGraphId,
            ownerGraphId: scope.owningGraphId,
            nodeId,
            source: LayoutSource.AgentRemote,
            actor: context.actor,
            opId: context.opId,
            timestamp
          }))
        )
      }
    }
  })
  graphMutationsByWorkflow.set(workflowId, mutations)
  return mutations
}
const { focusNodeInstance } = useFocusNode()

function toSelectedNode(node: LGraphNode): SelectedNode {
  return {
    id: String(node.id),
    locatorId: workflowStore.nodeToNodeLocatorId(node),
    title: node.title || node.type
  }
}

const selectedNodes = computed<SelectedNode[]>(() =>
  canvasStore.selectedItems.filter(isLGraphNode).map(toSelectedNode)
)
const {
  staged: selectionTags,
  consume: consumeSelection,
  remove: removeSelectionTag,
  add: addSelectionTag,
  replace: replaceSelectionTags
} = useCanvasSelection({
  selection: selectedNodes,
  enabled: agentEnabled,
  isLive: () => agentPanelStore.isOpen,
  isTracking: () => agentNodeSelectionStore.isActive,
  isPaused: () => agentNodeSelectionStore.isLoadingWorkflow,
  scope: () => workflowStore.activeWorkflow?.path ?? null,
  dismissedSignature: dismissedSelectionSignature
})

function viewedGraphNodes() {
  return app.canvas?.graph?.nodes ?? app.graph?.nodes ?? []
}

function mentionableNodes(): SelectedNode[] {
  return viewedGraphNodes().map(toSelectedNode)
}

watch(
  selectionTags,
  (tags) => {
    if (!agentPanelStore.isOpen || agentNodeSelectionStore.isLoadingWorkflow)
      return
    agentNodeSelectionStore.saveNodeIds(
      workflowStore.activeWorkflow?.path,
      tags.map(selectedNodeKey)
    )
  },
  { deep: true }
)

watch(
  () => agentPanelStore.isOpen,
  (open) => {
    if (!open) return
    const locatorIds = new Set(
      agentNodeSelectionStore.nodeIds(workflowStore.activeWorkflow?.path)
    )
    replaceSelectionTags(
      [...locatorIds]
        .map((locatorId) => getNodeByLocatorId(app.rootGraph, locatorId))
        .filter((node): node is LGraphNode => node !== null)
        .map(toSelectedNode)
    )
  },
  { immediate: true }
)

function mentionableAssets() {
  return assetService.getInputAssetsIncludingPublic()
}

let cloudIdsByName = new Map<string, string>()

async function refreshCloudWorkflowIds(): Promise<void> {
  try {
    const workflows = await rest.listCloudWorkflows()
    const nameCounts = new Map<string, number>()
    for (const { name } of workflows) {
      if (name !== undefined)
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
    }
    cloudIdsByName = new Map(
      workflows.flatMap(({ id, name }) =>
        name !== undefined && nameCounts.get(name) === 1
          ? [[name, id] as const]
          : []
      )
    )
  } catch (error) {
    reportError(error, {
      errorType: 'agent_cloud_workflow_ids_refresh_failed'
    })
  }
}

function openSavedTabsNamed(filename: string): ComfyWorkflow[] {
  return workflowStore.openWorkflows.filter(
    (tab) => !tab.isTemporary && tab.filename === filename
  )
}

function cloudIdFor(tab: ComfyWorkflow): string | undefined {
  const saved =
    !tab.isTemporary && openSavedTabsNamed(tab.filename).length === 1
      ? cloudIdsByName.get(tab.filename)
      : undefined
  return saved ?? bindingStore.workflowIdFor(tab.path)
}

const workflowDetached = ref(false)

function activeWorkflowTurnContext(): WorkflowTurnContext | undefined {
  if (workflowDetached.value) return undefined
  const active = workflowStore.activeWorkflow
  if (!active) return undefined
  const bound = cloudIdFor(active)
  return bound === undefined ? undefined : { id: bound, tabPath: active.path }
}

function activeWorkflowDraft(): DraftSnapshot | undefined {
  if (workflowDetached.value) return undefined
  const active = workflowStore.activeWorkflow
  if (!active) return undefined
  active.changeTracker?.captureCanvasState()
  const content = active.activeState
  if (!content) return undefined
  return { content }
}

const activeTab = computed<ActiveTab | null>(() => {
  const active = workflowStore.activeWorkflow
  return active
    ? {
        path: active.path,
        name: active.filename,
        isPersisted: active.isPersisted,
        modified: active.isModified
      }
    : null
})

const workflowTabs = computed<ActiveTab[]>(() =>
  workflowStore.openWorkflows.map((tab) => ({
    path: tab.path,
    name: tab.filename,
    isPersisted: tab.isPersisted,
    modified: tab.isModified
  }))
)

async function onSelectTab(path: string): Promise<void> {
  workflowDetached.value = false
  const tab = workflowStore.getWorkflowByPath(path)
  if (tab) await workflowService.openWorkflow(tab)
}

function onClearWorkflow(): void {
  workflowDetached.value = true
}

function openTabsSnapshot(): OpenTabsSnapshot | undefined {
  const openTabs = workflowStore.openWorkflows.flatMap((tab) => {
    const workflowId = cloudIdFor(tab)
    return workflowId === undefined
      ? []
      : [{ workflow_id: workflowId, name: tab.filename }]
  })
  if (openTabs.length === 0) return undefined
  const active = workflowStore.activeWorkflow
  return {
    open_tabs: openTabs,
    current_tab:
      active && !workflowDetached.value ? cloudIdFor(active) : undefined
  }
}

function onWorkflowAdopted(
  workflowId: string,
  sent: WorkflowTurnContext | undefined
): void {
  if (sent !== undefined && sent.id === workflowId) {
    bindingStore.bind(workflowId, sent.tabPath)
    tabActivity.setEditing(sent.tabPath)
  }
}

const {
  sendMessage,
  stopTurn,
  isSending,
  newChat,
  start,
  stop,
  entries,
  editableTurnId,
  isStreaming,
  status,
  notices,
  threadId,
  listThreads,
  loadThread,
  boundWorkflowId,
  bindWorkflow,
  answerAsk,
  answeringAskIds
} = useAgentSession({
  rest,
  events,
  workflow: {
    current: activeWorkflowTurnContext,
    adopted: onWorkflowAdopted,
    prepare: refreshCloudWorkflowIds,
    tabs: openTabsSnapshot,
    activeTab: enqueueActiveTab,
    draft: activeWorkflowDraft
  }
})

const isBoundWorkflowActive = computed(() => {
  const bound = boundWorkflowId.value
  const active = workflowStore.activeWorkflow
  return (
    bound !== null &&
    active !== null &&
    boundTabFor(bound)?.path === active.path
  )
})

// The CRDT follower is the inbound content channel: subscribes to the
// session's bound workflow while its tab is active. Suspending the background
// subscription makes reopening pull state-vector catch-up only after the
// workflow's serialized activeState has hydrated the transient stores.
const {
  status: crdtStatus,
  debugSnapshot: crdtDebugSnapshot,
  enqueueHumanOperations
} = useAgentCrdtFollower(
  boundWorkflowId,
  graphMutations,
  () => resolvedUserInfo.value?.id ?? null,
  isBoundWorkflowActive,
  // `app.isGraphReady` is a plain getter; reading `canvasStore.canvas` (set
  // right after `app.setup()`) makes the follower's graph watch fire once the
  // root graph exists.
  () => (canvasStore.canvas && app.isGraphReady ? app.rootGraph : null)
)
const mintPortWiring = attachMintPortWiring({
  isEnabled: () => agentPanelStore.enabled,
  isDocBound: () => isBoundWorkflowActive.value,
  enqueue: enqueueHumanOperations,
  layoutChanges: (listener) => layoutStore.onChange(listener),
  localActorPrefix: ACTOR_CONFIG.USER_PREFIX,
  getGraph: () => (app.isGraphReady ? app.rootGraph : null)
})
const isCrdtDevPanelEnabled = resolveDebugPanelEnabled(
  agentPanelStore.enabled,
  isCrdtDebugEnabled()
)

// The resumed turn's own workflow outlives a panel remount (the session
// binds it at ack; only newChat/loadThread reset it), while the active tab
// may have changed since - prefer the bound tab over active-tab derivation.
function resumedTurnTabPath(): string | null {
  if (workflowDetached.value) return null
  const bound = boundWorkflowId.value
  if (bound === null) return activeWorkflowTurnContext()?.tabPath ?? null
  const boundPath = bindingStore.tabPathFor(bound)
  if (boundPath !== undefined) return boundPath
  const context = activeWorkflowTurnContext()
  return context?.id === bound ? context.tabPath : null
}

// Adoption (onWorkflowAdopted) and tab activation (onAgentActiveTab) are the
// primary spinner setters; the non-idle branch only re-arms it after the
// stash/resume flip of a panel remount, where those setters never run.
watch(status, (value) => {
  if (value === 'idle') {
    const completedPath = tabActivity.editingTabPath
    tabActivity.setEditing(null)
    if (completedPath !== null) tabActivity.markModified(completedPath)
  } else if (tabActivity.editingTabPath === null)
    tabActivity.setEditing(resumedTurnTabPath())
})

const executionErrorStore = useExecutionErrorStore()

function surfaceAgentError(type: 'agent_api_failed', details: string): void {
  executionErrorStore.recordPromptError({
    type,
    message: t(`errorCatalog.promptErrors.${type}.desc`),
    details
  })
  executionErrorStore.showErrorOverlay()
}

let noticesSeen = 0
watch(
  () => notices.value.length,
  (length) => {
    for (const notice of notices.value.slice(noticesSeen))
      surfaceAgentError('agent_api_failed', notice.text)
    noticesSeen = length
  }
)

function boundTabFor(workflowId: string): ComfyWorkflow | null {
  const path = bindingStore.tabPathFor(workflowId)
  const bound =
    path === undefined ? null : workflowStore.getWorkflowByPath(path)
  if (bound) return bound
  for (const [name, id] of cloudIdsByName) {
    if (id !== workflowId) continue
    const matches = openSavedTabsNamed(name)
    return matches.length === 1 ? matches[0] : null
  }
  return null
}

let activeTabGeneration = 0
let activeTabChain: Promise<void> = Promise.resolve()

function enqueueActiveTab(data: AgentActiveTabData): void {
  const generation = ++activeTabGeneration
  activeTabChain = activeTabChain.then(() => onAgentActiveTab(data, generation))
}

function onOpenApprovalWorkflow(
  workflowId: string,
  workflowName?: string
): void {
  enqueueActiveTab({ workflow_id: workflowId, name: workflowName })
}

function agentTabFilename(name: string | undefined): string | undefined {
  const cleaned = [
    ...(name ?? '')
      .replace(/[/\\\p{Cc}]/gu, '-')
      .replace(/\.json$/i, '')
      .trim()
      .replace(/^\.+/, '')
  ]
    .slice(0, 80)
    .join('')
    .replace(/^[\s.]+/u, '')
    .trim()
  return cleaned.length === 0 ? undefined : `${cleaned}.json`
}

async function onAgentActiveTab(
  data: AgentActiveTabData,
  generation: number
): Promise<void> {
  const stale = () => generation !== activeTabGeneration
  if (stale()) return
  try {
    const bound = boundTabFor(data.workflow_id)
    if (bound) {
      await workflowService.openWorkflow(bound)
      if (stale()) return
      // boundTabFor can resolve by cloud name, which leaves no binding behind
      // for everything downstream that only reads tabPathFor.
      bindingStore.bind(data.workflow_id, bound.path)
      if (status.value !== 'idle') tabActivity.setEditing(bound.path)
      bindWorkflow(data.workflow_id)
      useTelemetry()?.trackAgentWorkflowApplied({
        workflow_id: data.workflow_id,
        target: 'active_tab_switch'
      })
      return
    }
    // A new agent workflow opens as an EMPTY tab: the host minted its doc
    // server-side (seed-at-bind), and the follower fills the canvas through
    // the ordinary subscribe catch-up - no snapshot fetch, no draft apply.
    const creatingStartedAt = Date.now()
    tabActivity.setCreating(true)
    const remainingCreatingTime =
      CREATING_TAB_MIN_DURATION_MS - (Date.now() - creatingStartedAt)
    if (remainingCreatingTime > 0)
      await new Promise((resolve) => setTimeout(resolve, remainingCreatingTime))
    if (stale()) return
    const tab = workflowStore.createTemporary(agentTabFilename(data.name))
    tabActivity.setCreating(false)
    await workflowService.openWorkflow(tab)
    if (stale()) {
      // A newer activation superseded this one mid-open: close the minted
      // tab rather than stranding a ghost the user never asked for.
      await workflowStore.closeWorkflow(tab)
      return
    }
    if (status.value !== 'idle') tabActivity.setEditing(tab.path)
    bindingStore.bind(data.workflow_id, tab.path)
    bindWorkflow(data.workflow_id)
    useTelemetry()?.trackAgentWorkflowApplied({
      workflow_id: data.workflow_id,
      target: 'active_tab_open'
    })
  } catch (error) {
    if (stale()) return
    bindWorkflow(data.workflow_id)
    surfaceAgentError(
      'agent_api_failed',
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    tabActivity.setCreating(false)
  }
}

start()
void refreshCloudWorkflowIds()
onBeforeUnmount(() => {
  mintPortWiring.detach()
  exitNodeSelectionMode()
  stop()
  tabActivity.setEditing(null)
  tabActivity.setCreating(false)
})

const history = useAgentChatHistoryStore()

const { copy } = useClipboard({ legacy: true })

function onFeedback(turnId: string, vote: 'up' | 'down' | null): void {
  useTelemetry()?.trackAgentMessageFeedback({
    message_id: turnId,
    vote,
    workflow_id: boundWorkflowId.value
  })
}

function toChatSession(thread: AgentThreadSummary): ChatSession {
  const stamp = thread.last_message_at ?? thread.updated_at ?? thread.created_at
  const updatedAt = stamp ? Date.parse(stamp) : Date.now()
  return {
    id: thread.id,
    title: thread.title || thread.preview || t('agent.untitledChat'),
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt
  }
}

async function refreshHistory(): Promise<void> {
  try {
    history.replaceAll((await listThreads()).map(toChatSession))
  } catch (error) {
    surfaceAgentError(
      'agent_api_failed',
      error instanceof Error ? error.message : String(error)
    )
  }
}

watch(threadId, (id) => history.setActive(id), { immediate: true })

void refreshHistory()

async function onSelectHistory(id: string): Promise<void> {
  exitNodeSelectionMode()
  workflowDetached.value = false
  await loadThread(id)
  void refreshHistory()
}

function buildTranscriptMarkdown(entries: ConversationEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.role === 'user') return `**You:** ${entry.text}`
      const text = entry.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
      return `**Agent:** ${text}`
    })
    .join('\n\n')
}

function onCopyMarkdown(id: string): void {
  if (id === history.activeId) void copy(buildTranscriptMarkdown(entries.value))
  else toast.add({ severity: 'info', summary: t('agent.copyUnavailable') })
}

const coachStep: CoachStep = {
  target: '#agent-panel-root',
  title: t('agent.coachTitle'),
  body: t('agent.coachBody')
}

function onSend(text: string, attachments: ComposerAttachment[]): void {
  exitNodeSelectionMode()
  const nodeTags = consumeSelection()
  useTelemetry()?.trackAgentMessageSent({
    attachment_count: attachments.length,
    node_tag_count: nodeTags.length
  })
  void sendMessage(text, attachments, nodeTags)
}

function onStop(): void {
  void stopTurn()
}

function onRenameChat(title: string): void {
  if (threadId.value !== null) history.rename(threadId.value, title)
}

function onRenameHistory(id: string, title: string): void {
  history.rename(id, title)
}

function onDeleteHistory(id: string): void {
  history.remove(id)
  // Deleting the open chat also ends it; a dead thread must not stay editable.
  if (id === threadId.value) onNewChat()
}

function onNewChat(): void {
  exitNodeSelectionMode()
  workflowDetached.value = true
  newChat()
}

const panelRef = ref<InstanceType<typeof AgentPanel>>()
const fileInput = ref<HTMLInputElement>()
const assetDragActive = ref(false)
let assetDragDepth = 0
provide('agentAssetDragActive', readonly(assetDragActive))
let selectingNodes = false
let nodeSelectionCanvas: LGraphCanvas | undefined
let selectedGraphNodes = new Map<string, LGraphNode>()
let restoreAllowDragNodes: boolean | undefined
let restoreSelectOnly: boolean | undefined

watch(
  () => canvasStore.selectedItems,
  (items) => {
    const nodes = items.filter(isLGraphNode)
    if (agentNodeSelectionStore.restoredNodeIds !== null) {
      selectedGraphNodes = new Map(
        nodes.map(
          (node) => [workflowStore.nodeToNodeLocatorId(node), node] as const
        )
      )
      replaceSelectionTags(nodes.map(toSelectedNode))
      agentNodeSelectionStore.finishWorkflowLoad()
      return
    }
    if (!selectingNodes || agentNodeSelectionStore.isLoadingWorkflow) return
    const currentNodes = new Map<string, LGraphNode>(
      nodes.map(
        (node) => [workflowStore.nodeToNodeLocatorId(node), node] as const
      )
    )
    selectedGraphNodes = currentNodes
  },
  { immediate: true }
)

function exitNodeSelectionMode(): void {
  const canvas = nodeSelectionCanvas
  if (canvas) {
    canvas.multi_select = false
    canvas.allow_dragnodes = restoreAllowDragNodes ?? true
    canvas.selectOnly = restoreSelectOnly ?? false
  }
  nodeSelectionCanvas = undefined
  restoreAllowDragNodes = undefined
  restoreSelectOnly = undefined
  selectedGraphNodes.clear()
  selectingNodes = false
  if (agentNodeSelectionStore.isActive) agentNodeSelectionStore.exit()
  if (canvas) {
    canvas.deselectAll()
    canvasStore.updateSelectedItems()
  }
}

watch(
  () => agentNodeSelectionStore.isActive,
  (active) => {
    if (!active) exitNodeSelectionMode()
  }
)

watch(
  () => agentNodeSelectionStore.restoredNodeIds,
  (nodeIds) => {
    if (nodeIds === null) return
    selectedGraphNodes = new Map(
      [...(app.canvas?.selectedItems ?? [])]
        .filter(isLGraphNode)
        .map((node) => [workflowStore.nodeToNodeLocatorId(node), node] as const)
    )
  }
)

watch(() => workflowStore.activeWorkflow, exitNodeSelectionMode)

watch(
  () => canvasStore.currentGraph,
  () => {
    if (!agentNodeSelectionStore.isLoadingWorkflow) exitNodeSelectionMode()
  }
)

function onSelectNodes(): void {
  if (selectingNodes) return
  const canvas = app.canvas
  if (!canvas) return

  const merged = new Map<string, LGraphNode>(
    [...canvas.selectedItems]
      .filter(isLGraphNode)
      .map((node) => [workflowStore.nodeToNodeLocatorId(node), node] as const)
  )
  for (const tag of selectionTags.value) {
    const key = selectedNodeKey(tag)
    const node = getNodeByLocatorId(app.rootGraph, key)
    if (node) merged.set(key, node)
  }
  selectedGraphNodes = merged
  if (merged.size) {
    canvas.selectItems([...merged.values()])
    canvasStore.updateSelectedItems()
  }
  restoreAllowDragNodes = canvas.allow_dragnodes
  restoreSelectOnly = canvas.selectOnly
  canvas.allow_dragnodes = false
  canvas.selectOnly = true
  canvas.multi_select = true
  nodeSelectionCanvas = canvas
  selectingNodes = true
  agentNodeSelectionStore.enter()
  void nextTick(() => {
    if (selectingNodes) canvas.canvas.focus()
  })
}

const assetsStore = useAssetsStore()

const attachment = useAttachment({
  upload: async (file, signal) => {
    const uploaded = await rest.uploadImage(file, file.name, signal)
    // The library caches input assets; without this refresh a just-uploaded
    // file is neither listed in the Assets tab nor mentionable this session.
    void assetsStore.inputAssets.loadNew()
    return { ref: uploaded.name }
  },
  maxBytes: () => api.getServerFeature('max_upload_size', MAX_ATTACHMENT_BYTES),
  // A rejected file is the user's problem to fix, not an agent failure, so it
  // must not raise the server-error overlay.
  onError: (message) =>
    toast.add({ severity: 'warn', detail: message, life: 5000 }),
  stage: (staged) => panelRef.value?.addAttachment(staged),
  update: (id, patch) => panelRef.value?.updateAttachment(id, patch),
  remove: (id) => panelRef.value?.removeAttachment(id)
})

function onAttach(): void {
  exitNodeSelectionMode()
  useTelemetry()?.trackAgentAttachButtonClicked()
  fileInput.value?.click()
}

function onOpenAssets(): void {
  exitNodeSelectionMode()
  sidebarTabStore.activeSidebarTabId = 'assets'
}

function onMentionPick(node: SelectedNode): void {
  const stagedBefore = selectionTags.value.length
  addSelectionTag(node)
  const canvas = app.canvas
  const graphNode = viewedGraphNodes().find(
    (candidate) =>
      workflowStore.nodeToNodeLocatorId(candidate) === selectedNodeKey(node)
  )
  if (canvas && graphNode) {
    canvas.selectItems([graphNode], true)
    canvasStore.updateSelectedItems()
  }
  if (selectionTags.value.length > stagedBefore)
    useTelemetry()?.trackAgentNodeTagged({ source: 'mention_picker' })
}

function onRemoveSelectionTag(id: string): void {
  const canvas = app.canvas
  const node = getNodeByLocatorId(app.rootGraph, id)
  if (canvas && node && canvas.selectedItems.has(node)) {
    canvas.deselect(node)
    canvasStore.updateSelectedItems()
  }
  removeSelectionTag(id)
}

function onFocusSelectionTag(id: string): void {
  const node = getNodeByLocatorId(app.rootGraph, id)
  if (node) void focusNodeInstance(node)
}

function onClosePanel(): void {
  exitNodeSelectionMode()
  useTelemetry()?.trackAgentCloseButtonClicked()
  agentPanelStore.close('close_button')
}

async function onFilesPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) await attachment.addFiles(Array.from(files))
  input.value = ''
}

function isAssetDrag(event: DragEvent): boolean {
  // Bare text/uri-list matches any dragged hyperlink; only claim real asset
  // cards, which always carry the asset-info payload.
  return (event.dataTransfer?.types ?? []).includes(MIME_ASSET_INFO)
}

function isAttachableDrag(event: DragEvent): boolean {
  return (
    (event.dataTransfer?.types ?? []).includes('Files') || isAssetDrag(event)
  )
}

function clearAssetDrag(): void {
  assetDragDepth = 0
  assetDragActive.value = false
}

function onPanelDragEnter(event: DragEvent): void {
  if (!isAttachableDrag(event)) return
  assetDragDepth += 1
  assetDragActive.value = true
}

function onPanelDragLeave(): void {
  if (assetDragDepth === 0) return
  assetDragDepth -= 1
  if (assetDragDepth === 0) assetDragActive.value = false
}

async function attachDroppedAsset(event: DragEvent): Promise<void> {
  const asset = event.dataTransfer && getDroppedAsset(event.dataTransfer)
  if (!asset) {
    toast.add({
      severity: 'warn',
      detail: t('agent.assetNotAttachable'),
      life: 5000
    })
    return
  }

  if (asset.ref && asset.kind !== 'other') {
    panelRef.value?.addAttachment({
      id: `asset:${asset.ref}`,
      name: asset.name,
      ref: asset.ref,
      previewUrl: asset.previewUrl
    })
    return
  }

  const file = await attachment.addDeferredFile(asset.name, async () => {
    const file = await fetchDroppedAsset(asset)
    return file && isAgentAttachable(file) ? file : undefined
  })
  if (!file)
    toast.add({
      severity: 'warn',
      detail: t('agent.assetNotAttachable'),
      life: 5000
    })
}

function onPanelDragOver(event: DragEvent): void {
  if (isAttachableDrag(event)) event.preventDefault()
}

function onPanelDrop(event: DragEvent): void {
  clearAssetDrag()
  // A dropped asset card carries a URI, not a File, so the claim must happen
  // before the async fetch resolves it into one.
  if ((event.dataTransfer?.files.length ?? 0) === 0 && isAssetDrag(event)) {
    event.preventDefault()
    void attachDroppedAsset(event)
    return
  }
  // Anything the composer cannot attach still belongs to the graph loader, which
  // only runs while the drop is unclaimed, so claim the attachable files alone.
  const files = Array.from(event.dataTransfer?.files ?? []).filter(
    isAgentAttachable
  )
  if (files.length === 0) return
  event.preventDefault()
  void attachment.addFiles(files)
}
</script>

<template>
  <div
    id="agent-panel-root"
    class="size-full"
    @dragenter="onPanelDragEnter"
    @dragleave="onPanelDragLeave"
    @dragover="onPanelDragOver"
    @drop="onPanelDrop"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="AGENT_ATTACH_ACCEPT"
      multiple
      class="hidden"
      data-testid="agent-file-input"
      @change="onFilesPicked"
    />
    <AgentPanel
      ref="panelRef"
      :entries
      :editable-turn-id="editableTurnId"
      :answering-ask-ids="answeringAskIds"
      :user-name="userName"
      :streaming="isStreaming"
      :submitting="isSending || status === 'thinking'"
      :can-attach="true"
      :can-open-assets="!isBuilderMode"
      :is-maximized="agentPanelStore.isMaximized"
      :history-groups="history.grouped"
      :session-id="threadId"
      :custom-title="history.titleFor(threadId)"
      :selection-tags="selectionTags"
      :active-tab="activeTab"
      :workflow-tabs="workflowTabs"
      :workflow-detached="workflowDetached"
      :get-mention-nodes="mentionableNodes"
      :get-mention-assets="mentionableAssets"
      @select-tab="onSelectTab"
      @clear-workflow="onClearWorkflow"
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
      @open-assets="onOpenAssets"
      @select-nodes="onSelectNodes"
      @remove-tag="onRemoveSelectionTag"
      @focus-tag="onFocusSelectionTag"
      @mention-pick="onMentionPick"
      @feedback="onFeedback"
      @answer-ask="answerAsk"
      @open-workflow="onOpenApprovalWorkflow"
      @new-chat="onNewChat"
      @toggle-size="agentPanelStore.toggleMaximize()"
      @close="onClosePanel"
      @open-history="refreshHistory()"
      @select-history="onSelectHistory"
      @delete-history="onDeleteHistory"
      @rename-history="onRenameHistory"
      @rename-chat="onRenameChat"
      @copy-history="onCopyMarkdown"
    >
      <template v-if="isCrdtDevPanelEnabled" #instrument>
        <CrdtDevPanel :status="crdtStatus" :snapshot="crdtDebugSnapshot" />
      </template>
    </AgentPanel>
    <OnboardingCoach
      :step="coachStep"
      storage-key="Comfy.AgentPanel.onboarded"
    />
  </div>
</template>
