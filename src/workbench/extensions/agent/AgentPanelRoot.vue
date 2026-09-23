<script setup lang="ts">
import './agentPanel.css'

import type { GetFeaturesResponse } from '@comfyorg/ingest-types'
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
import { useTelemetry } from '@/platform/telemetry'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LiveAutogrowGroupAnswer } from '@/workbench/extensions/agent/crdt/graphMutations'
import { createGraphMutations } from '@/workbench/extensions/agent/crdt/graphMutations'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useAppMode } from '@/composables/useAppMode'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { fetchDroppedAsset, getDroppedAsset } from '@/utils/eventUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { AGENT_ATTACH_ACCEPT, isAgentAttachable } from './utils/attachableFiles'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { registerMinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
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
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { blankGraph } from '@/scripts/defaultGraph'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import { isCloud } from '@/platform/distribution/types'
import { parseNodeId } from '@/types/nodeId'
import { parseNodeLocatorId } from '@/types/nodeIdentification'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAccountPreconditionDialog } from '@/platform/cloud/subscription/composables/useAccountPreconditionDialog'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  adoptSharedOnboardingFlag,
  hasSeenCoach,
  scopedOnboardingKey,
  trackCoachDeferral
} from './composables/agent/useOnboarding'

import AgentPanel from './components/agent/AgentPanel.vue'
import AgentGraphActivityBar from './components/AgentGraphActivityBar.vue'
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
import type {
  AgentActiveTabData,
  AgentThreadSummary
} from './schemas/agentApiSchema'
import type { ChatSession } from './stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from './stores/agent/agentConversationStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import type {
  TurnOrigin,
  WorkflowTurnContext
} from './composables/agent/useAgentSession'
import type { CoachStep } from './composables/agent/useOnboarding'
import { useAgentWorkflowResolver } from './composables/agent/useAgentWorkflowResolver'
import { useAgentWorkflowSelection } from './composables/agent/useAgentWorkflowSelection'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useAgentDraftSubmission } from './composables/agent/useAgentDraftSubmission'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'
import { createAgentRestClient } from './services/agent/agentRestClient'
import type { DraftSnapshot } from './services/agent/agentRestClient'
import type { AgentPaywallAction } from './services/agent/agentPaywallPresentation'
import {
  DEFAULT_AGENT_PAYWALL_PRESENTATION,
  resolveAgentPaywallPresentation
} from './services/agent/agentPaywallPresentation'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { createStandaloneAgentEventSource } from './services/agent/standaloneAgentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { agentMessageText } from './utils/agentMessageText'
import { useAgentComposerStore } from './stores/agent/agentComposerStore'
import { useAgentConsentStore } from './stores/agent/agentConsentStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentGraphActivityStore } from './stores/agent/agentGraphActivityStore'
import {
  isCrdtDebugEnabled,
  resolveDebugPanelEnabled
} from './crdt/crdtDebugGate'
import { attachMintPortWiring } from './crdt/mintPortWiring'
import {
  createLiveWidgetProjection,
  owningGraph
} from './crdt/liveWidgetProjection'
import { liveAutogrowGroupOf } from '@/core/graph/widgets/dynamicWidgets'
import { useAgentCrdtFollower } from './crdt/useAgentCrdtFollower'

const CrdtDevPanel = defineAsyncComponent(
  () => import('./crdt/CrdtDevPanel.vue')
)

const { t } = useI18n()
const toast = useToastStore()
const { open: openAccountPrecondition } = useAccountPreconditionDialog()
const { workspaceRole } = useWorkspaceUI()
const { subscription, tier: subscriptionTier } = useBillingContext()
const conversationStore = useAgentConversationStore()
watch(
  () => subscription.value?.hasFunds,
  (hasFunds) => conversationStore.setPaywallsResolved(hasFunds === true),
  { immediate: true }
)
const { canTopUp, canSubscribeSelfServe, hasResolvedCapabilities } =
  useBillingCapabilities()
const paywallPresentation = computed(() => {
  if (isCloud && !hasResolvedCapabilities.value && !canTopUp.value) {
    return DEFAULT_AGENT_PAYWALL_PRESENTATION
  }
  return resolveAgentPaywallPresentation({
    distribution: isCloud ? 'cloud' : 'local',
    role: workspaceRole.value,
    tier: subscriptionTier.value,
    canTopUp: canTopUp.value,
    canSubscribeSelfServe: canSubscribeSelfServe.value
  })
})
const sidebarTabStore = useSidebarTabStore()
const { isBuilderMode } = useAppMode()

const { resolvedUserInfo, userDisplayName } = useCurrentUser()
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

const rest = createAgentRestClient()

const events =
  import.meta.env.VITE_AGENT_STANDALONE === 'true'
    ? createStandaloneAgentEventSource()
    : createAgentEventSource(api)

function onPaywallAction(action: AgentPaywallAction): void {
  openAccountPrecondition(action === 'addCredits' ? 'credits' : 'subscription')
}

const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const bindingStore = useAgentWorkflowTabBindingStore()
const agentPanelStore = useAgentPanelStore()
const composerStore = useAgentComposerStore()
const { selectedWorkflow: selectedTarget } = storeToRefs(agentPanelStore)
const { dismissedSelectionSignature, enabled: agentEnabled } =
  storeToRefs(agentPanelStore)
const agentNodeSelectionStore = useAgentNodeSelectionStore()
const workflowResolver = useAgentWorkflowResolver({
  workflows: workflowStore,
  bindings: bindingStore,
  listCloudWorkflows: () => rest.listCloudWorkflows()
})
const {
  refreshCloudWorkflowIds,
  forgetCloudWorkflowId,
  cloudIdFor,
  boundOrOpenWorkflowFor,
  storedWorkflowFor,
  openWorkflowFor,
  availableWorkflowReferences,
  openTabsSnapshot
} = workflowResolver
const {
  isSelecting: workflowSelecting,
  selectingTarget,
  savingReference,
  selectTarget: onSelectWorkflowTarget,
  selectReference: onSelectWorkflowReference,
  restoreTarget: onWorkflowRestored,
  requestReferences: onRequestWorkflowReferences,
  cancelSelection: cancelWorkflowSelection
} = useAgentWorkflowSelection({
  resolver: workflowResolver,
  canSelectTarget: () => !isSending.value && status.value === 'idle',
  warnWorkflowUnavailable
})
const tabActivity = useWorkflowTabActivityStore()
const CREATING_TAB_MIN_DURATION_MS = 500
// Opens at the template's view so the follower's first nodes land on screen.
const agentTabGraph: ComfyWorkflowJSON = {
  ...blankGraph,
  extra: { ds: { offset: [0, 0], scale: 1 } }
}

const canvasStore = useCanvasStore()
const graphActivity = useAgentGraphActivityStore()
const settingStore = useSettingStore()
watch(
  () => canvasStore.canvas?.graph,
  (graph, _previous, onCleanup) => {
    if (!graph?.events) return
    const events = graph.events as EventTarget
    const onNodeRemoved: EventListener = (event) => {
      if (!(event instanceof CustomEvent)) return
      const nodeId = parseNodeId(String(event.detail.node?.id))
      if (nodeId) graphActivity.removeNodes([nodeId])
    }
    events.addEventListener('node:removed', onNodeRemoved)
    onCleanup(() => events.removeEventListener('node:removed', onNodeRemoved))
  },
  { immediate: true }
)
const agentMinimapLayer = registerMinimapDecorationLayer('agent.graph-activity')
watch(
  () => graphActivity.state,
  (activity) => {
    if (activity.phase === 'idle') {
      agentMinimapLayer.replace([])
      return
    }
    const rootGraphId = toRootGraphId(activity.rootGraphId)
    agentMinimapLayer.replace(
      activity.nodeIds.map((nodeId) => ({
        target: {
          rootGraphId,
          owningGraphId: toOwningGraphId(activity.rootGraphId),
          nodeId
        },
        enter: 'pop'
      }))
    )
    if (
      activity.phase === 'running' &&
      !settingStore.get('Comfy.Minimap.Visible')
    )
      void settingStore.set('Comfy.Minimap.Visible', true)
  },
  { immediate: true }
)
const { accepted: consentAccepted } = storeToRefs(useAgentConsentStore())
const workspaceStore = useTeamWorkspaceStore()
const onboardingKey = computed(() =>
  scopedOnboardingKey(
    resolvedUserInfo.value?.id,
    workspaceStore.activeWorkspaceId
  )
)
watch(
  onboardingKey,
  (key) => {
    if (key) adoptSharedOnboardingFlag(key)
  },
  { immediate: true }
)
const { activeTour } = storeToRefs(useOnboardingTourStore())
const coachDeferredBy = computed(() =>
  canvasStore.linearMode
    ? 'app_mode'
    : activeTour.value !== null
      ? 'tour_active'
      : null
)
watch(
  [consentAccepted, onboardingKey, coachDeferredBy],
  ([accepted, key, reason]) => {
    if (accepted && key && !hasSeenCoach(key)) trackCoachDeferral(key, reason)
  },
  { immediate: true }
)
const graphMutationsByWorkflow = new Map<
  string,
  ReturnType<typeof createGraphMutations>
>()
const liveWidgets = createLiveWidgetProjection({
  getRootGraph: () => app.rootGraphOrUndefined,
  getCanvas: () => app.canvas,
  markDirty: () => app.canvas?.setDirty(true)
})
const graphMutations = (workflowId: string) => {
  const existing = graphMutationsByWorkflow.get(workflowId)
  if (existing) return existing
  const mutations = createGraphMutations({
    getScope() {
      const rootGraphId = boundOrOpenWorkflowFor(workflowId)?.activeState?.id
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
    },
    placement: {
      nodeBounds(scope, nodeId) {
        const layout = layoutStore.getNodeLayout(scope.rootGraphId, nodeId)
        return layout
          ? {
              x: layout.position.x,
              y: layout.position.y,
              width: layout.size.width,
              height: layout.size.height
            }
          : null
      },
      viewportBounds(scope) {
        const canvas = canvasStore.canvas
        if (
          !canvas ||
          String(canvas.graph?.id) !== String(scope.owningGraphId)
        ) {
          return null
        }
        const [x, y, width, height] = canvas.ds.visible_area
        return { x, y, width, height }
      }
    },
    liveWidgets,
    liveNodes: {
      autogrowGroupOf(scope, nodeId, name): LiveAutogrowGroupAnswer {
        const rootGraph = app.rootGraphOrUndefined
        const node = rootGraph
          ? owningGraph(rootGraph, scope)?.getNodeById(nodeId)
          : undefined
        // Unmounted / background workflow: the node itself can't be asked,
        // so this carries no opinion -- `resolveAutogrowGroup` falls back to
        // remembered provenance, then the node type's own static definition,
        // and only then the name-shape heuristic, instead of treating this
        // as "not a member".
        if (!node) return { kind: 'unavailable' }
        const group = liveAutogrowGroupOf(node, name)
        return group === undefined
          ? { kind: 'notMember' }
          : { kind: 'member', group }
      }
    }
  })
  graphMutationsByWorkflow.set(workflowId, mutations)
  return mutations
}

function toSelectedNode(node: LGraphNode): SelectedNode {
  return {
    id: String(node.id),
    locatorId: workflowStore.nodeToNodeLocatorId(node),
    title: node.title || node.type
  }
}

const canReferenceNodes = computed(
  () =>
    selectedTarget.value !== null &&
    workflowStore.activeWorkflow?.path === selectedTarget.value.path
)
const nodeReferenceDisabledReason = computed(() => {
  if (selectedTarget.value === null) return t('agent.selectWorkflowForNodes')
  if (!canReferenceNodes.value)
    return t('agent.switchWorkflowForNodes', {
      workflowName: selectedTarget.value.filename
    })
  return undefined
})

const selectedNodes = computed<SelectedNode[]>(() =>
  canvasStore.selectedItems.filter(isLGraphNode).map(toSelectedNode)
)
composerStore.setNodeScope(selectedTarget.value?.path ?? null)
const {
  staged: selectionTags,
  consume: consumeSelection,
  remove: removeSelectionTag,
  add: addSelectionTag,
  replace: replaceSelectionTags
} = useCanvasSelection({
  staged: computed({
    get: () => composerStore.nodes,
    set: composerStore.setNodes
  }),
  retainWhenNotLive: true,
  selection: selectedNodes,
  enabled: () => agentEnabled.value && selectedTarget.value !== null,
  isLive: () => agentPanelStore.isOpen,
  isTracking: () => canReferenceNodes.value && agentNodeSelectionStore.isActive,
  isPaused: () => agentNodeSelectionStore.isLoadingWorkflow,
  scope: () => selectedTarget.value?.path ?? null,
  dismissedSignature: dismissedSelectionSignature,
  retainStagedNode: (node) => {
    const locator = parseNodeLocatorId(selectedNodeKey(node))
    if (!locator) return false
    const viewedSubgraphUuid =
      canvasStore.currentGraph?.isRootGraph === false
        ? canvasStore.currentGraph.id
        : null
    return locator.subgraphUuid !== viewedSubgraphUuid
  }
})

let nodeReferenceWorkflow = selectionTags.value.length
  ? selectedTarget.value
  : null

function viewedGraphNodes() {
  return app.canvas?.graph?.nodes ?? app.graph?.nodes ?? []
}

function mentionableNodes(): SelectedNode[] {
  return canReferenceNodes.value ? viewedGraphNodes().map(toSelectedNode) : []
}

watch(
  selectionTags,
  (tags) => {
    nodeReferenceWorkflow = tags.length ? selectedTarget.value : null
    if (!agentPanelStore.isOpen || agentNodeSelectionStore.isLoadingWorkflow)
      return
    agentNodeSelectionStore.saveNodeIds(
      selectedTarget.value?.path,
      tags.map(selectedNodeKey)
    )
  },
  { deep: true, flush: 'sync' }
)

watch(
  [() => agentPanelStore.isOpen, canReferenceNodes],
  ([open, canReference]) => {
    if (!open || !canReference || selectionTags.value.length > 0) return
    const locatorIds = new Set(
      agentNodeSelectionStore.nodeIds(selectedTarget.value?.path)
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

const workflowDetached = computed(() => selectedTarget.value === null)

// Resolves the tab a turn is attributed to. `null` (the send had no origin
// tab) resolves to nothing rather than falling back to the selected target, so
// re-attaching during prepare() cannot pull a later tab into this turn.
function originWorkflow(origin?: TurnOrigin): ComfyWorkflow | undefined {
  if (origin === null) return undefined
  return (
    (origin === undefined
      ? selectedTarget.value
      : workflowStore.openWorkflows.find(
          (workflow) => workflow.path === origin.tabPath
        )) ?? undefined
  )
}

function targetWorkflowTurnContext(
  origin?: TurnOrigin
): WorkflowTurnContext | undefined {
  if (workflowDetached.value) return undefined
  const target = originWorkflow(origin)
  if (!target) return undefined
  const id = cloudIdFor(target)
  if (id === undefined && !target.isTemporary && origin !== undefined)
    return undefined
  return id === undefined
    ? { tabPath: target.path }
    : { id, tabPath: target.path }
}

function targetWorkflowDraft(origin?: TurnOrigin): DraftSnapshot | undefined {
  if (workflowDetached.value) return undefined
  const target = originWorkflow(origin)
  if (!target) return undefined
  if (target.path === workflowStore.activeWorkflow?.path)
    target.changeTracker?.prepareForSave()
  const content = target.activeState
  if (!content) return undefined
  return { content }
}

const selectedTargetTab = computed<ActiveTab | null>(() => {
  const target = selectedTarget.value
  return target
    ? {
        path: target.path,
        name: target.filename,
        isPersisted: target.isPersisted,
        modified: target.isModified
      }
    : null
})

const editableWorkflowId = computed(() => {
  const target = selectedTarget.value
  return target ? cloudIdFor(target) : undefined
})

const workflowTabs = computed<ActiveTab[]>(() =>
  workflowStore.openWorkflows.map((tab) => ({
    path: tab.path,
    name: tab.filename,
    isPersisted: tab.isPersisted,
    modified: tab.isModified
  }))
)

function onWorkflowAdopted(
  workflowId: string,
  sent: WorkflowTurnContext | undefined
): void {
  if (sent === undefined) return
  // An unbound tab adopts a workflow only when it was minted for this turn:
  // an id that already resolves to an open tab belongs to that tab.
  const adoptable =
    sent.id === undefined
      ? bindingStore.tabPathFor(workflowId) === undefined &&
        storedWorkflowFor(workflowId) === null
      : sent.id === workflowId
  if (adoptable) {
    bindingStore.bind(workflowId, sent.tabPath)
    tabActivity.setEditing(sent.tabPath)
  }
}

function warnWorkflowUnavailable(): void {
  toast.add({
    severity: 'warn',
    detail: t('agent.targetNavigationUnavailable'),
    life: 5000
  })
}

const {
  sendMessage,
  stopTurn,
  isSending: sessionIsSending,
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
    current: targetWorkflowTurnContext,
    adopted: onWorkflowAdopted,
    restored: onWorkflowRestored,
    prepare: async () => {
      await refreshCloudWorkflowIds()
    },
    disowned: forgetCloudWorkflowId,
    tabs: openTabsSnapshot,
    activeTab: enqueueActiveTab,
    draft: targetWorkflowDraft
  }
})

const isSending = computed(
  () => sessionIsSending.value || composerStore.submission?.phase === 'pending'
)

const isBoundWorkflowActive = computed(() => {
  const bound = boundWorkflowId.value
  const active = workflowStore.activeWorkflow
  return (
    bound !== null &&
    active !== null &&
    boundOrOpenWorkflowFor(bound)?.path === active.path
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
  () => (canvasStore.canvas && app.isGraphReady ? app.rootGraph : null),
  {
    onMaterialized({ workflowId, nodeIds }) {
      if (app.isGraphReady) {
        graphActivity.recordMaterialized(
          { workflowId, rootGraphId: toRootGraphId(app.rootGraph.id) },
          nodeIds
        )
        if (status.value === 'idle') graphActivity.finishTurn()
      }
    },
    onReset: graphActivity.resetWorkflow
  }
)
// The bound document's serialized root graph id, independent of what is
// currently on the canvas: `beforeLoadNewGraph` persists the outgoing
// workflow's `activeState` before the shared renderer graph is rewritten, so
// this stays the bound workflow's own root id through a tab switch instead of
// tracking whichever graph the switch is loading.
function boundRootGraphId(): RootGraphId | null {
  const bound = boundWorkflowId.value
  if (bound === null) return null
  const id = boundOrOpenWorkflowFor(bound)?.activeState?.id
  return id === undefined ? null : toRootGraphId(id)
}
const mintPortWiring = attachMintPortWiring({
  isEnabled: () => agentPanelStore.enabled,
  isDocBound: () => isBoundWorkflowActive.value,
  enqueue: enqueueHumanOperations,
  layoutChanges: (listener) => layoutStore.onChange(listener),
  localActorPrefix: ACTOR_CONFIG.USER_PREFIX,
  getGraph: () => (app.isGraphReady ? app.rootGraph : null),
  boundRootGraphId
})
const isCrdtDevPanelEnabled = resolveDebugPanelEnabled(
  agentPanelStore.enabled,
  isCrdtDebugEnabled()
)
const { activeTurnId: conversationTurnId } = storeToRefs(conversationStore)

// PM-1575: a chat tool-call's own `status` says nothing about whether its
// effect has actually reached the canvas -- the CRDT doc_update travels a
// separate, unrelated listener (see agentEventTransport.ts's file header).
// Gate the transport's tool-call "done" affordance on canvas catch-up only
// while the CRDT follower is actually active, and re-check any parts it held
// back every time the bound workflow applies a fresh update.
//
// `agentPanelStore.enabled` alone is NOT that signal: it is the product
// feature flag ("is the agent panel available at all"), which is on in any
// environment or test that exercises the panel, whether or not a CRDT doc
// subscription for the bound workflow actually exists yet. Gating on it
// alone deferred every mutating tool call (add_node, set_widget, ...) to
// 'streaming' even when no doc_subscribed frame had ever been received --
// e.g. in agentPanel.spec.ts and every other spec that drives chat events
// without also standing up a doc host -- so nothing was ever going to call
// notifyCanvasCaughtUp() to rescue it, and the row (and the composing
// "Working..." status derived from every part being settled) stayed stuck
// until the 30s STALE_AFTER_MS fallback. `crdtStatus.value.connected` is the
// actual "the follower is subscribed and could receive a doc_update" signal
// (flipped true only by a real `doc_subscribed { ok: true }` frame); a
// disabled panel never starts the follower, so this implies `enabled` too.
// Read `outcomes.appliedLive`, never `outcomes.applied`: `applied` also
// counts a subscribe's own one-time catch-up frame, which lands whenever the
// follower (re)subscribes to the bound workflow and has nothing to do with
// any tool call in flight. Gating on raw `applied` made the FIRST
// canvas-mutating tool call after any (re)subscribe -- effectively every
// tool call, since a `running` frame is never sent in practice, see
// agentEventTransport.ts's file header -- read that unrelated catch-up as
// its own matching update and settle to 'done' immediately, defeating the
// wait this gate exists for.
conversationStore.setCanvasSyncGate(
  () => crdtStatus.value.connected,
  () => crdtStatus.value.outcomes.appliedLive
)
watch(
  () => crdtStatus.value.outcomes.appliedLive,
  (applied, previouslyApplied) => {
    // `useAgentCrdtFollower`'s status falls back to a disabled status with
    // `applied: 0` when the follower is torn down, and a restarted follower
    // counts from 0 again -- so toggling the panel mid-turn can drive this
    // DOWN, not just up. A decrease is not a catch-up: nothing was applied,
    // so it must not release parts that are still genuinely waiting.
    if (applied > previouslyApplied) conversationStore.notifyCanvasCaughtUp()
  }
)

// The resumed turn's own workflow outlives a panel remount (the session
// binds it at ack; only newChat/loadThread reset it), while the active tab
// may have changed since - prefer the bound tab over active-tab derivation.
function resumedTurnTabPath(): string | null {
  if (workflowDetached.value) return null
  const bound = boundWorkflowId.value
  if (bound === null) {
    // An id-less context means the turn has no workflow at all: attributing
    // it to whatever tab happens to be active lights the editing spinner on
    // that tab and markModifieds it on completion. Only a context carrying a
    // real workflow id may be attributed.
    const context = targetWorkflowTurnContext()
    return context?.id !== undefined ? context.tabPath : null
  }
  const boundPath = bindingStore.tabPathFor(bound)
  if (boundPath !== undefined) return boundPath
  const context = targetWorkflowTurnContext()
  return context?.id === bound ? context.tabPath : null
}

// Adoption (onWorkflowAdopted) and tab activation (onAgentActiveTab) are the
// primary spinner setters; the non-idle branch only re-arms it after the
// stash/resume flip of a panel remount, where those setters never run.
let observedActivityStatus = false
watch(
  [status, conversationTurnId],
  ([value, turnId]) => {
    if (value === 'idle') {
      // The immediate idle value on remount is a hydration snapshot, not a
      // completed turn. A real idle transition is observed after this pass.
      if (observedActivityStatus) graphActivity.finishTurn()
    } else graphActivity.startTurn(turnId)
    observedActivityStatus = true
    if (value === 'idle') {
      const completedPath = tabActivity.editingTabPath
      tabActivity.setEditing(null)
      if (completedPath !== null) tabActivity.markModified(completedPath)
    } else if (tabActivity.editingTabPath === null)
      tabActivity.setEditing(resumedTurnTabPath())
  },
  { immediate: true, flush: 'sync' }
)

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

async function onNavigateToReferenceWorkflow(
  workflowId: string
): Promise<void> {
  try {
    let target = openWorkflowFor(workflowId)
    if (target === null) {
      await Promise.all([
        refreshCloudWorkflowIds(),
        workflowStore.syncWorkflows()
      ])
      target = storedWorkflowFor(workflowId)
    }
    if (target === null || !(await workflowService.openWorkflow(target))) {
      warnWorkflowUnavailable()
      return
    }
    bindingStore.bind(workflowId, target.path)
  } catch {
    warnWorkflowUnavailable()
  }
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
    const bound = boundOrOpenWorkflowFor(data.workflow_id)
    if (bound) {
      const opened = await workflowService.openWorkflow(bound)
      if (stale()) return
      if (!opened) {
        warnWorkflowUnavailable()
        return
      }
      // boundOrOpenWorkflowFor can resolve by cloud name, which leaves no binding behind
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
    const creatingStartedAt = Date.now()
    tabActivity.setCreating(true)
    const remainingCreatingTime =
      CREATING_TAB_MIN_DURATION_MS - (Date.now() - creatingStartedAt)
    if (remainingCreatingTime > 0)
      await new Promise((resolve) => setTimeout(resolve, remainingCreatingTime))
    if (stale()) return
    const tab = workflowStore.createNewTemporary(
      agentTabFilename(data.name),
      agentTabGraph
    )
    tabActivity.setCreating(false)
    let opened: boolean
    try {
      opened = await workflowService.openWorkflow(tab)
    } catch (error) {
      await workflowService.closeWorkflow(tab, { warnIfUnsaved: false })
      throw error
    }
    if (stale() || !opened) {
      await workflowService.closeWorkflow(tab, { warnIfUnsaved: false })
      if (!stale()) warnWorkflowUnavailable()
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
  ++activeTabGeneration
  mintPortWiring.detach()
  exitNodeSelectionMode()
  stop()
  tabActivity.setEditing(null)
  tabActivity.setCreating(false)
  agentMinimapLayer.dispose()
  // PM-1575: the store singleton outlives this component. Without resetting
  // the gate here, a remount's own setCanvasSyncGate() call is the only
  // thing standing between the old (now torn-down) follower's gate and a
  // turn resumed in the meantime reading it -- reset to the always-safe
  // default instead of leaving whatever this instance last set.
  conversationStore.setCanvasSyncGate(
    () => false,
    () => 0
  )
})

const history = useAgentChatHistoryStore()

const { copy } = useClipboard({ legacy: true })

function onFeedback(turnId: string, vote: 'up' | 'down' | null): void {
  const message = entries.value.find(
    (entry) => entry.role === 'assistant' && entry.id === turnId
  )
  const workflowId =
    message?.role === 'assistant'
      ? (message.parts
          .flatMap((part) => (part.type === 'tabLink' ? [part.workflowId] : []))
          .at(-1) ?? null)
      : null

  useTelemetry()?.trackAgentMessageFeedback({
    message_id: turnId,
    vote,
    workflow_id: workflowId
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
  composerStore.invalidateSubmission()
  cancelWorkflowSelection()
  agentPanelStore.resetWorkflowTarget()
  exitNodeSelectionMode()
  await loadThread(id)
  void refreshHistory()
}

function buildTranscriptMarkdown(entries: ConversationEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.role === 'user') return `**You:** ${agentMessageText(entry)}`
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

const coachSteps = computed<CoachStep[]>(() => [
  {
    target: '#agent-panel-root',
    placement: 'left-center',
    title: t('agent.coachTitle'),
    body: t('agent.coachBody')
  },
  {
    target: '#agent-composer',
    placement: 'left-end',
    title: t('agent.coachWorkflowTitle'),
    body: t('agent.coachWorkflowBody')
  },
  {
    target: '.graph-canvas-panel',
    placement: 'graph-bottom',
    toolbarTarget: '.graph-canvas-panel [role="toolbar"]',
    title: t('agent.coachGraphTitle'),
    body: t('agent.coachGraphBody')
  },
  {
    target: '#agent-chat-history',
    placement: 'left-start',
    title: t('agent.coachHistoryTitle'),
    body: t('agent.coachHistoryBody')
  }
])

const { submit: onSend } = useAgentDraftSubmission({
  canSubmit: () => !workflowSelecting.value && !isSending.value,
  target: () => selectedTarget.value,
  editableWorkflowId: () => editableWorkflowId.value,
  selection: {
    staged: selectionTags,
    workflow: () => nodeReferenceWorkflow,
    consume: consumeSelection,
    replace: replaceSelectionTags,
    exit: exitNodeSelectionMode
  },
  send: (text, attachments, nodes, references) => {
    useTelemetry()?.trackAgentMessageSent({
      attachment_count: attachments.length,
      node_tag_count: nodes.length
    })
    const selectionWorkflow = selectedTarget.value
    return sendMessage(text, attachments, nodes, references, () =>
      selectionWorkflow ? cloudIdFor(selectionWorkflow) : undefined
    )
  },
  stop: stopTurn
})

function onStop(): void {
  if (!composerStore.requestSubmissionStop()) void stopTurn()
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
  composerStore.invalidateSubmission()
  cancelWorkflowSelection()
  exitNodeSelectionMode()
  composerStore.setWorkflowReferences([])
  composerStore.resetPromptHistory()
  // A new chat targets whatever tab is on screen right now, not the previous
  // chat's target - unlike onSelectHistory(), which resets to 'uninitialized'
  // so restoreTarget() can re-apply the loaded thread's own binding.
  agentPanelStore.setWorkflowTarget(workflowStore.activeWorkflow)
  newChat()
}

const panelRef = ref<InstanceType<typeof AgentPanel>>()
const fileInput = ref<HTMLInputElement>()
const assetDragActive = ref(false)
let assetDragDepth = 0
provide('agentAssetDragActive', readonly(assetDragActive))
let selectingNodes = false
let nodeSelectionCanvas: LGraphCanvas | undefined

watch(
  () => canvasStore.selectedItems,
  (items) => {
    if (agentNodeSelectionStore.restoredNodeIds !== null) {
      if (canReferenceNodes.value) {
        replaceSelectionTags(items.filter(isLGraphNode).map(toSelectedNode))
      }
      agentNodeSelectionStore.finishWorkflowLoad()
    }
  },
  { immediate: true }
)

function exitNodeSelectionMode(): void {
  const canvas = nodeSelectionCanvas
  nodeSelectionCanvas = undefined
  selectingNodes = false
  if (agentNodeSelectionStore.isActive) agentNodeSelectionStore.exit()
  if (canvas) {
    canvas.deselectAll()
  }
}

watch(
  () => agentNodeSelectionStore.isActive,
  (active) => {
    if (!active) exitNodeSelectionMode()
  }
)

watch(() => workflowStore.activeWorkflow, exitNodeSelectionMode)

watch(
  selectedTarget,
  (target, previous) => {
    exitNodeSelectionMode()
    composerStore.setNodeScope(target?.path ?? null)
    nodeReferenceWorkflow = null
    agentNodeSelectionStore.saveNodeIds(previous?.path, [])
    agentNodeSelectionStore.saveNodeIds(target?.path, [])
  },
  { flush: 'sync' }
)

watch(
  () => canvasStore.currentGraph,
  () => {
    if (!agentNodeSelectionStore.isLoadingWorkflow) exitNodeSelectionMode()
  },
  { flush: 'sync' }
)

function onSelectNodes(): void {
  if (!canReferenceNodes.value || selectingNodes) return
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
  if (merged.size) {
    canvas.selectItems([...merged.values()])
  }
  nodeSelectionCanvas = canvas
  selectingNodes = true
  agentNodeSelectionStore.enter()
  void nextTick(() => {
    if (selectingNodes) canvas.canvas.focus()
  })
}

const assetsStore = useAssetsStore()
let inputAssetRefresh: Promise<unknown> = Promise.resolve()

const attachment = useAttachment({
  upload: async (file, signal) => {
    const uploaded = await rest.uploadImage(file, file.name, signal)
    const filename = uploaded.name ?? file.name
    return {
      ref: filename,
      url: api.apiURL(
        `/view?filename=${encodeURIComponent(filename)}&type=input`
      )
    }
  },
  // The library caches input assets; without this refresh a just-uploaded file
  // is neither listed in the Assets tab nor mentionable this session. One run
  // per settled batch, chained, because the query queue coalesces an
  // overlapping refresh into the in-flight one instead of scheduling a
  // trailing pass.
  onUploaded: () => {
    inputAssetRefresh = inputAssetRefresh
      .then(() => assetsStore.inputAssets.loadNew())
      .catch(() => undefined)
  },
  maxBytes: () =>
    api.getServerFeature<GetFeaturesResponse['max_upload_size']>(
      'max_upload_size'
    ) ?? MAX_ATTACHMENT_BYTES,
  // A rejected file is the user's problem to fix, not an agent failure, so it
  // must not raise the server-error overlay.
  onError: (message) =>
    toast.add({ severity: 'warn', detail: message, life: 5000 }),
  stage: composerStore.addAttachment,
  update: composerStore.updateAttachment,
  remove: composerStore.removeAttachment
})

onBeforeUnmount(() => attachment.cancelAllUploads())

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
  if (!canReferenceNodes.value) return
  const stagedBefore = selectionTags.value.length
  addSelectionTag(node)
  if (selectionTags.value.length > stagedBefore)
    useTelemetry()?.trackAgentNodeTagged({ source: 'mention_picker' })
}

function onRemoveSelectionTag(id: string): void {
  removeSelectionTag(id)
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

  const result = await attachment.addDeferredFile(asset.name, async () => {
    const file = await fetchDroppedAsset(asset)
    return file && isAgentAttachable(file) ? file : undefined
  })
  if (result === 'unsupported')
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
  <AgentGraphActivityBar :canvas="canvasStore.canvas" />
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
      :node-reference-disabled-reason="nodeReferenceDisabledReason"
      :select-workflow-reference="onSelectWorkflowReference"
      :saving-reference="savingReference"
      :available-workflows="availableWorkflowReferences"
      :editable-workflow-id="editableWorkflowId"
      :active-tab="selectedTargetTab"
      :workflow-tabs="workflowTabs"
      :visible-tab-path="workflowStore.activeWorkflow?.path ?? null"
      :selecting-tab-path="selectingTarget?.path ?? null"
      :select-tab="onSelectWorkflowTarget"
      :workflow-detached="workflowDetached"
      :get-mention-nodes="mentionableNodes"
      :paywall-presentation="paywallPresentation"
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
      @open-assets="onOpenAssets"
      @select-nodes="onSelectNodes"
      @remove-tag="onRemoveSelectionTag"
      @mention-pick="onMentionPick"
      @request-workflow-references="onRequestWorkflowReferences"
      @remove-workflow-reference="composerStore.removeWorkflowReference"
      @feedback="onFeedback"
      @answer-ask="answerAsk"
      @open-workflow="onOpenApprovalWorkflow"
      @open-reference-workflow="onNavigateToReferenceWorkflow"
      @paywall-action="onPaywallAction"
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
      v-if="consentAccepted && onboardingKey && coachDeferredBy === null"
      :steps="coachSteps"
      :storage-key="onboardingKey"
    />
  </div>
</template>
