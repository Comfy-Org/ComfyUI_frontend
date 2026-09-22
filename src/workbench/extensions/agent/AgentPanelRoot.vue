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
  onMounted,
  provide,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentErrorMetadata,
  AgentFreeUseNoticeMetadata,
  AgentMessageSentMetadata,
  AgentPaywallSurface,
  AgentRunApprovalDecision,
  AgentStopMethod
} from '@/platform/telemetry/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { formatWorkflowSyncErrorDetail } from '@/workbench/extensions/agent/crdt/workflowSyncErrorDetail'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useAppMode } from '@/composables/useAppMode'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { fetchDroppedAsset, getDroppedAsset } from '@/utils/eventUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { AGENT_ATTACH_ACCEPT, isAgentAttachable } from './utils/attachableFiles'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
// oxlint-disable-next-line comfy/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { MinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
import { registerMinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
// The composition root injects the renderer-owned layout port; follower core
// stays independent of renderer and LiteGraph runtime values.
// oxlint-disable-next-line comfy/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { blankGraph } from '@/scripts/defaultGraph'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToast } from '@/components/ui/toast/toastStore'
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
  resetCoach,
  scopedOnboardingKey,
  trackCoachDeferral
} from './composables/agent/useOnboarding'

import { useFreeUsePlacement } from './experiments/freeUsePlacement'
import { useStarterPromptSet } from './experiments/starterPromptSet'
import AgentPanel from './components/agent/AgentPanel.vue'
import { agentBoundWorkflowIdKey } from './components/agent/agentBoundWorkflowId'
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
import { useAgentConsent } from './composables/agent/useAgentConsent'
import { useAgentWorkflowResolver } from './composables/agent/useAgentWorkflowResolver'
import { useAgentWorkflowSelection } from './composables/agent/useAgentWorkflowSelection'
import {
  isRetryableRequestFailure,
  trackAgentError,
  useAgentSession
} from './composables/agent/useAgentSession'
import { useAgentDraftSubmission } from './composables/agent/useAgentDraftSubmission'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'
import { createAgentRestClient } from './services/agent/agentRestClient'
import type { DraftSnapshot } from './services/agent/agentRestClient'
import type { AgentPaywallAction } from './services/agent/agentPaywallPresentation'
import {
  DEFAULT_AGENT_PAYWALL_PRESENTATION,
  resolveAgentPaywallPresentation,
  toAgentPaywallCta,
  toAgentPaywallReason
} from './services/agent/agentPaywallPresentation'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { createStandaloneAgentEventSource } from './services/agent/standaloneAgentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { agentMessageText } from './utils/agentMessageText'
import {
  deriveSessionTitle,
  withCurrentSessionTitle
} from './utils/sessionTitle'
import { useAgentComposerStore } from './stores/agent/agentComposerStore'
import { useAgentConsentStore } from './stores/agent/agentConsentStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentGraphActivityStore } from './stores/agent/agentGraphActivityStore'
import {
  isCrdtDebugEnabled,
  resolveDebugPanelEnabled
} from './crdt/crdtDebugGate'
import { attachDocOpMinter } from './crdt/docOpMinter'
import { attachRestoreOpMinter } from './crdt/restoreOpMinter'
import { useAgentCrdtFollower } from './crdt/useAgentCrdtFollower'

const CrdtDevPanel = defineAsyncComponent(
  () => import('./crdt/CrdtDevPanel.vue')
)

const { t } = useI18n()
const toast = useToast()
const { open: openAccountPrecondition } = useAccountPreconditionDialog()
const { workspaceRole } = useWorkspaceUI()
const {
  subscription,
  tier: subscriptionTier,
  type: billingType,
  billingStatus,
  fetchStatus: refreshBillingStatus
} = useBillingContext()
const conversationStore = useAgentConversationStore()
const history = useAgentChatHistoryStore()
const { accepted: consentAccepted } = storeToRefs(useAgentConsentStore())
watch(
  subscription,
  (currentSubscription) => {
    if (currentSubscription?.agentHasFunds) conversationStore.resolvePaywalls()
  },
  { immediate: true }
)
const {
  canTopUp,
  canSubscribeSelfServe,
  hasResolvedCapabilities,
  isReady: capabilityReadSettled,
  snapshotAuthoritative
} = useBillingCapabilities()
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
const teamWorkspaceStore = useTeamWorkspaceStore()
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

const rest = createAgentRestClient()

const events =
  import.meta.env.VITE_AGENT_STANDALONE === 'true'
    ? createStandaloneAgentEventSource()
    : createAgentEventSource(api)

function onPaywallAction(
  action: AgentPaywallAction,
  surface: AgentPaywallSurface
): void {
  useTelemetry()?.trackAgentPaywallCtaClicked({
    cta: toAgentPaywallCta(action),
    surface
  })
  if (action === 'addCredits') {
    if (canTopUp.value) {
      useTelemetry()?.trackAddApiCreditButtonClicked({
        source: 'agent_paywall'
      })
    }
    openAccountPrecondition('credits', { source: 'agent_paywall' })
    return
  }
  useTelemetry()?.trackSubscription('subscribe_clicked', {
    current_tier: subscriptionTier.value?.toLowerCase(),
    reason: 'agent_paywall'
  })
  openAccountPrecondition('subscription', { source: 'agent_paywall' })
}

const { messages: conversationMessages, entries: conversationEntries } =
  storeToRefs(conversationStore)
watch(
  () =>
    // Gated on the read having *settled*, which includes settling as
    // unavailable. `snapshotAuthoritative` is narrower — it excludes that
    // outage state — and gating on it stranded those sessions: the paywall
    // still renders, an owner still gets the fallback Add credits CTA, and its
    // click is still reported, so the funnel saw CTAs with no impression.
    capabilityReadSettled.value
      ? conversationMessages.value
          .filter((message) =>
            message.parts.some((part) => part.type === 'paywall')
          )
          .map((message) => message.id)
      : [],
  (paywallMessageIds) => {
    const telemetry = useTelemetry()
    if (!telemetry) return
    for (const id of paywallMessageIds) {
      if (!conversationStore.claimPaywallImpression(id)) continue
      telemetry.trackAgentPaywallShown({
        // An unavailable read leaves `canTopUp` guessing true for an owner, so
        // the presentation would name a confident reason drawn from a fallback
        // rather than from capabilities. Report the impression as `unknown`.
        reason: snapshotAuthoritative.value
          ? toAgentPaywallReason(paywallPresentation.value)
          : 'unknown',
        surface: 'refused_send'
      })
    }
  },
  { immediate: true }
)

/**
 * The standing credit-exhaustion surface.
 *
 * The inline card above is reachable from exactly one moment: a turn POST that
 * came back 402/`no_funds` (`recordSendError` -> `recordPaywall`). Every other
 * way a user meets the ceiling — including a refusal inside a server-side LLM
 * hop that the browser cannot observe — needs a durable upgrade path.
 *
 * So this reads the funds signal the client already holds rather than waiting
 * for a refusal to carry it. It is deliberately the symmetric half of the
 * `hasFunds` watch above, which already clears paywalls when funds return.
 *
 * Consolidated cloud billing only: legacy balance loading currently collapses
 * unknown into false, so it cannot safely drive this surface.
 *
 * Non-blocking by construction — it renders beside the composer and disables
 * nothing.
 */
const agentHasFunds = computed(() => subscription.value?.agentHasFunds)
const creditsExhausted = computed(() => {
  if (!consentAccepted.value) return false
  if (billingType.value !== 'workspace') return false
  // Same gate as the impression report above: an unsettled read cannot say
  // which presentation is right, and a card naming the wrong remediation is
  // worse than no card.
  if (!capabilityReadSettled.value) return false
  if (agentHasFunds.value !== false) return false
  if (
    billingStatus.value === 'paused' ||
    billingStatus.value === 'payment_failed'
  )
    return false
  // A standing card must offer a next step. Refusal-anchored inline cards can
  // still explain member, sales-managed, or unavailable states without a CTA.
  return ['subscribed', 'subscriptionRequired', 'local'].includes(
    paywallPresentation.value.kind
  )
})

/**
 * Suppressed while the latest transcript entry is an unresolved inline card:
 * the two render the same copy. An older card may be scrolled away and must not
 * hide the standing recovery path after a later server-side refusal.
 */
const showStandingPaywall = computed(() => {
  if (!creditsExhausted.value) return false
  const latestEntry = conversationEntries.value.at(-1)
  return !(
    latestEntry?.role === 'assistant' &&
    latestEntry.parts.some((part) => part.type === 'paywall')
  )
})

const agentPanelStore = useAgentPanelStore()
const billingIdentity = computed(
  () =>
    `${resolvedUserInfo.value?.id ?? 'anonymous'}:${teamWorkspaceStore.workspaceId ?? 'none'}`
)

/**
 * One impression per exhaustion episode, not per render: the surface is
 * standing, so it is visible for as long as the workspace is out of credits and
 * a per-render report would make impressions a function of session length.
 * Reset when funds return, so a later exhaustion reports again — mirroring how
 * `useBillingBanner` scopes its dismissal to one episode.
 */
watch(billingIdentity, () => {
  agentPanelStore.reportedExhaustionIdentity = null
})

function onStandingPaywallShown(): void {
  if (
    !showStandingPaywall.value ||
    agentPanelStore.reportedExhaustionIdentity === billingIdentity.value
  )
    return
  const telemetry = useTelemetry()
  if (!telemetry) return
  agentPanelStore.reportedExhaustionIdentity = billingIdentity.value
  telemetry.trackAgentPaywallShown({
    reason: snapshotAuthoritative.value
      ? toAgentPaywallReason(paywallPresentation.value)
      : 'unknown',
    surface: 'credits_exhausted'
  })
}

const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const bindingStore = useAgentWorkflowTabBindingStore()
const composerStore = useAgentComposerStore()
const { selectedWorkflow: selectedTarget } = storeToRefs(agentPanelStore)
const { dismissedSelectionSignature, enabled: agentEnabled } =
  storeToRefs(agentPanelStore)
const workflowResolver = useAgentWorkflowResolver({
  workflows: workflowStore,
  bindings: bindingStore,
  listCloudWorkflows: () => rest.listCloudWorkflows(),
  getCloudWorkflow: (workflowId) => rest.getCloudWorkflow(workflowId)
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
  onVisibleWorkflowChanged,
  selectTarget: onSelectWorkflowTarget,
  selectReference: onSelectWorkflowReference,
  restoreTarget: onWorkflowRestored,
  requestReferences: onRequestWorkflowReferences,
  cancelSelection: cancelWorkflowSelection
} = useAgentWorkflowSelection({
  resolver: workflowResolver,
  canSelectTarget: () => !isSending.value && status.value === 'idle',
  warnWorkflowUnavailable,
  warnRestoreFailed,
  onTargetBound: (workflowId, previousWorkflowId, source) =>
    reportWorkflowBound(workflowId, previousWorkflowId, source)
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
// Claimed on mount rather than in setup so a setup failure cannot leave the id
// registered with no unmount to release it.
let agentMinimapLayer: MinimapDecorationLayer | undefined
function syncAgentMinimapLayer(activity: typeof graphActivity.state): void {
  if (activity.phase === 'idle') {
    agentMinimapLayer?.replace([])
    return
  }
  const rootGraphId = toRootGraphId(activity.rootGraphId)
  agentMinimapLayer?.replace(
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
}
watch(() => graphActivity.state, syncAgentMinimapLayer, { immediate: true })
onMounted(() => {
  agentMinimapLayer = registerMinimapDecorationLayer('agent.graph-activity')
  syncAgentMinimapLayer(graphActivity.state)
})
// Teardown must be total. Nothing is re-thrown: an error escaping an unmount
// hook reaches Vue's logError, which re-throws outside production builds (this
// app registers no app.config.errorHandler) and aborts both the steps after it
// and the rest of unmountComponent -- stranding this panel's later releases on
// singletons that outlive it, such as the PM-1575 canvas-sync gate below.
//
// Steps are keyed rather than positional for two reasons: the key names the
// failure in telemetry, which is now the only signal that a release was
// skipped, and insertion order is the run order (no key is integer-like, so
// Object.entries order is specified). They return `undefined` rather than
// `void` so an async step -- whose rejection would escape the catch below
// while still looking contained -- fails to compile instead.
function runPanelTeardown(
  steps: Readonly<Record<string, () => undefined>>
): void {
  for (const [step, release] of Object.entries(steps)) {
    try {
      release()
    } catch (error) {
      try {
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_tearing_down_agent_panel',
          tags: { step }
        })
      } catch {
        // A reporter that throws must not abort the teardown it reports on.
      }
    }
  }
}
onBeforeUnmount(() =>
  runPanelTeardown({
    disposeMinimapLayer: () => {
      agentMinimapLayer?.dispose()
    }
  })
)
const { withConsent } = useAgentConsent()
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
    // Only carry the pre-consent, device-wide flag into a scope that had
    // already accepted consent when it loaded. A newly consenting scope has
    // not seen this scoped tour yet and should receive it once.
    if (key && consentAccepted.value) adoptSharedOnboardingFlag(key)
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
const coachCompletionWaiters = new Set<() => void>()
function releaseCoachCompletionWaiters(): void {
  for (const resolve of coachCompletionWaiters) resolve()
  coachCompletionWaiters.clear()
}
watch(
  [consentAccepted, onboardingKey, coachDeferredBy],
  ([accepted, key, reason]) => {
    if (accepted && key && !hasSeenCoach(key)) trackCoachDeferral(key, reason)
    if (reason !== null) releaseCoachCompletionWaiters()
  },
  { immediate: true }
)
const coachRef = ref<InstanceType<typeof OnboardingCoach>>()

async function waitForCoachCompletion(): Promise<void> {
  const key = onboardingKey.value
  if (!key || hasSeenCoach(key)) return
  await nextTick()
  if (coachDeferredBy.value !== null || !coachRef.value) return
  await new Promise<void>((resolve) => coachCompletionWaiters.add(resolve))
}

function restartCoach(): void {
  // Take-the-tour stays clickable while the coach is deferred by App Mode, and
  // there is no instance to hand the transition to. Clearing the persisted flag
  // makes the replay wait for the mount instead of being dropped.
  if (coachRef.value) coachRef.value.restart()
  else if (onboardingKey.value) resetCoach(onboardingKey.value)
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
composerStore.setNodeScope(selectedTarget.value?.instanceId ?? null)
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
  onNodesAdded: agentPanelStore.retainWorkflowTarget,
  retainWhenNotLive: true,
  selection: selectedNodes,
  enabled: () => agentEnabled.value && selectedTarget.value !== null,
  isLive: () => agentPanelStore.isOpen,
  isTracking: () => canReferenceNodes.value && canvasStore.isPickingNodes,
  scope: () => selectedTarget.value?.instanceId ?? null,
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
  return (
    (canvasStore.currentGraph ?? app.canvas?.graph ?? app.graph)?.nodes ?? []
  )
}

function mentionableNodes(): SelectedNode[] {
  return canReferenceNodes.value ? viewedGraphNodes().map(toSelectedNode) : []
}

watch(
  selectionTags,
  (tags) => {
    nodeReferenceWorkflow = tags.length ? selectedTarget.value : null
  },
  { deep: true, flush: 'sync' }
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

function serializedCanvas(target: ComfyWorkflow) {
  if (target.path === workflowStore.activeWorkflow?.path)
    target.changeTracker?.prepareForSave()
  return target.activeState
}

function targetWorkflowDraft(origin?: TurnOrigin): DraftSnapshot | undefined {
  if (workflowDetached.value) return undefined
  const target = originWorkflow(origin)
  if (!target) return undefined
  const content = serializedCanvas(target)
  if (!content) return undefined
  return { content }
}

function canvasForWorkflow(workflowId: string): Record<string, unknown> | null {
  const target = boundOrOpenWorkflowFor(workflowId)
  return target ? serializedCanvas(target) : null
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
  sent: WorkflowTurnContext | undefined,
  previousWorkflowId: string | null
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
    reportWorkflowBound(
      workflowId,
      previousWorkflowId,
      sent.id === undefined ? 'minted' : 'active_tab'
    )
  }
}

function warnWorkflowUnavailable(): void {
  toast.warning(t('agent.targetNavigationUnavailable'), { duration: 5000 })
}

function warnRestoreFailed(): void {
  const { view } = agentPanelStore
  // A loading history row reports its own failure.
  if (view.screen === 'history' && view.selection.status === 'loading') return
  toast.warning(t('agent.targetWorkflowOpenFailed'), { duration: 5000 })
}

function trackWorkflowOpenFailure(
  uiTreatment: AgentErrorMetadata['ui_treatment']
): void {
  trackAgentError('workflow_open_failed', 'post_acceptance', uiTreatment, {
    retryable: false
  })
}

/**
 * The sent message, held from the moment the user sends until the cloud ids
 * are refreshed, alongside the turn's origin. Scoped to one `sendMessage`
 * call, so a send never hands these fields to the next one.
 */
let pendingSend: {
  metadata: AgentMessageSentMetadata
  origin: TurnOrigin
} | null = null

/**
 * A freshly opened tab has no cloud id until `refreshCloudWorkflowIds()` lands,
 * and the turn is posted with the id resolved by that refresh (QAF-19).
 * Reporting before it would file the first send of a session — the one the
 * activation funnel is measuring — against no workflow at all.
 *
 * Resolved through the turn's own origin rather than the live selection,
 * because `performSend` posts the origin tab's id: switching target or
 * starting a new chat while the refresh is in flight must not retarget the
 * report at a workflow the turn was never sent against.
 */
function reportPendingSend(): void {
  const sent = pendingSend
  if (!sent) return
  pendingSend = null
  useTelemetry()?.trackAgentMessageSent({
    ...sent.metadata,
    workflow_id: targetWorkflowTurnContext(sent.origin)?.id ?? null
  })
}

const {
  sendMessage,
  stopTurn,
  isSending: sessionIsSending,
  isTranscriptReady,
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
  reportWorkflowBound,
  answerAsk,
  answeringAskIds
} = useAgentSession({
  rest,
  events,
  onThreadStarted: (source) =>
    useTelemetry()?.trackAgentThreadStarted({ source }),
  onThreadActivated: (id) => history.setActive(id),
  onAskResolved: forgetApproval,
  workflow: {
    initialize: agentPanelStore.initializeTargetTracking,
    current: targetWorkflowTurnContext,
    adopted: onWorkflowAdopted,
    restored: onWorkflowRestored,
    prepare: async () => {
      try {
        await refreshCloudWorkflowIds()
      } finally {
        // In `finally` so a refresh that fails still reports the send, with
        // whichever id the client already had, rather than losing the event.
        reportPendingSend()
      }
    },
    disowned: forgetCloudWorkflowId,
    tabs: openTabsSnapshot,
    activeTab: enqueueActiveTab,
    draft: targetWorkflowDraft
  }
})

provide(
  agentBoundWorkflowIdKey,
  computed(() => boundWorkflowId.value ?? undefined)
)

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
  enqueueHumanOperations,
  docInputNames,
  docPromotedWidgets
} = useAgentCrdtFollower(
  boundWorkflowId,
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
          nodeIds,
          conversationTurnId.value
        )
        if (status.value === 'idle') graphActivity.finishTurn()
      }
    },
    onReset: graphActivity.resetWorkflow,
    onSyncError: (message, code) =>
      toast.error(t('agent.workflowSyncFailedTitle'), {
        description: formatWorkflowSyncErrorDetail(t, message, code)
      })
  },
  {
    getCanvas: () => app.canvas,
    withRemoteActor: (actor, fn) => layoutStore.withActor(actor, fn),
    viewportBounds() {
      const canvas = canvasStore.canvas
      if (!canvas || canvas.graph?.isRootGraph === false) return null
      const [x, y, width, height] = canvas.ds.visible_area
      return { x, y, width, height }
    }
  },
  canvasForWorkflow
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
const docOpMinter = attachDocOpMinter({
  isEnabled: () => agentPanelStore.enabled,
  isDocBound: () => isBoundWorkflowActive.value,
  enqueue: enqueueHumanOperations,
  getGraph: () => (app.isGraphReady ? app.rootGraph : null),
  boundRootGraphId,
  docInputNames,
  docPromotedWidgets
})
const restoreOpMinter = attachRestoreOpMinter({
  isEnabled: () => agentPanelStore.enabled,
  isDocBound: () => isBoundWorkflowActive.value,
  enqueue: enqueueHumanOperations,
  getGraph: () => (app.isGraphReady ? app.rootGraph : null),
  docInputNames: (nodeId) => {
    const parsed = parseNodeId(nodeId)
    return parsed === null ? null : docInputNames(parsed)
  },
  isRestoringState: () =>
    workflowStore.activeWorkflow?.changeTracker?._restoringState === true
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
let wasTurnActive = false
watch(
  [status, conversationTurnId],
  ([value, turnId]) => {
    const completedTurn = wasTurnActive && value === 'idle'
    if (value === 'idle') {
      // The immediate idle value on remount is a hydration snapshot, not a
      // completed turn. A real idle transition is observed after this pass.
      if (completedTurn) graphActivity.finishTurn()
    } else graphActivity.startTurn(turnId)
    wasTurnActive = value !== 'idle'
    if (value === 'idle') {
      // A server-side LLM-hop refusal does not reach the browser as a 402.
      // Refresh the authoritative effective-funds verdict after every observed
      // turn completion so both exhaustion and external top-ups converge.
      if (completedTurn && billingType.value === 'workspace') {
        void refreshBillingStatus().catch((error: unknown) => {
          reportError(error, {
            surface: 'agent',
            errorType: 'error_refreshing_agent_billing_status'
          })
        })
      }
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

function enqueueActiveTab(data: AgentActiveTabData): Promise<boolean> {
  const generation = ++activeTabGeneration
  const result = activeTabChain.then(() => onAgentActiveTab(data, generation))
  activeTabChain = result.then(() => undefined)
  return result
}

async function onOpenApprovalWorkflow(
  askId: string,
  workflowId: string,
  workflowName?: string
): Promise<void> {
  const decidedAt = Date.now()
  if (await enqueueActiveTab({ workflow_id: workflowId, name: workflowName }))
    trackApprovalResolved(askId, 'open_workflow', decidedAt)
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

async function onShowTarget(
  isNavigationCurrent: () => boolean = () => true,
  warnOpenFailed: () => void = warnWorkflowUnavailable
): Promise<boolean> {
  const target = selectedTarget.value
  if (target === null) return false
  const isCurrent = () =>
    isNavigationCurrent() && selectedTarget.value === target
  try {
    const opened = await workflowService.openWorkflow(target, { isCurrent })
    if (!isCurrent()) return false
    if (!opened) warnOpenFailed()
    return opened
  } catch {
    if (isCurrent()) warnOpenFailed()
    return false
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
): Promise<boolean> {
  const previousWorkflowId = boundWorkflowId.value
  const stale = () => generation !== activeTabGeneration
  if (stale()) return false
  try {
    const bound = boundOrOpenWorkflowFor(data.workflow_id)
    return bound
      ? await activateExistingAgentTab(data, bound, previousWorkflowId, stale)
      : await createAndActivateAgentTab(data, previousWorkflowId, stale)
  } catch (error) {
    if (stale()) return false
    bindWorkflow(data.workflow_id)
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_workflow_open_failed'
    })
    surfaceAgentError(
      'agent_api_failed',
      error instanceof Error ? error.message : String(error)
    )
    trackWorkflowOpenFailure('error_overlay')
    return false
  } finally {
    tabActivity.setCreating(false)
  }
}

async function activateExistingAgentTab(
  data: AgentActiveTabData,
  bound: ComfyWorkflow,
  previousWorkflowId: string | null,
  stale: () => boolean
): Promise<boolean> {
  const opened = await workflowService.openWorkflow(bound)
  if (stale()) return false
  if (!opened) {
    warnWorkflowUnavailable()
    trackWorkflowOpenFailure('toast')
    return false
  }
  bindingStore.bind(data.workflow_id, bound.path)
  if (status.value !== 'idle') tabActivity.setEditing(bound.path)
  bindWorkflow(data.workflow_id)
  reportWorkflowBound(data.workflow_id, previousWorkflowId, 'active_tab')
  useTelemetry()?.trackAgentWorkflowApplied({
    workflow_id: data.workflow_id,
    target: 'active_tab_switch'
  })
  return true
}

async function createAndActivateAgentTab(
  data: AgentActiveTabData,
  previousWorkflowId: string | null,
  stale: () => boolean
): Promise<boolean> {
  const creatingStartedAt = Date.now()
  tabActivity.setCreating(true)
  const remainingCreatingTime =
    CREATING_TAB_MIN_DURATION_MS - (Date.now() - creatingStartedAt)
  if (remainingCreatingTime > 0)
    await new Promise((resolve) => setTimeout(resolve, remainingCreatingTime))
  if (stale()) return false
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
    if (!stale()) {
      warnWorkflowUnavailable()
      trackWorkflowOpenFailure('toast')
    }
    return false
  }
  if (status.value !== 'idle') tabActivity.setEditing(tab.path)
  bindingStore.bind(data.workflow_id, tab.path)
  bindWorkflow(data.workflow_id)
  reportWorkflowBound(data.workflow_id, previousWorkflowId, 'active_tab')
  useTelemetry()?.trackAgentWorkflowApplied({
    workflow_id: data.workflow_id,
    target: 'active_tab_open'
  })
  return true
}

function onApprovalShown(
  askId: string,
  turnId: string,
  workflowId: string | null
): void {
  if (!conversationStore.recordApprovalShown(askId, Date.now())) return
  useTelemetry()?.trackAgentRunApprovalShown({
    turn_id: turnId,
    workflow_id: workflowId
  })
}

function trackApprovalResolved(
  askId: string,
  decision: AgentRunApprovalDecision,
  decidedAt = Date.now(),
  shownAt = conversationStore.approvalShownAt(askId)
): void {
  if (shownAt === undefined) return
  if (decision !== 'open_workflow')
    conversationStore.forgetApprovalTiming(askId)
  useTelemetry()?.trackAgentRunApprovalResolved({
    decision,
    time_to_decide_ms: Math.max(0, decidedAt - shownAt)
  })
}

function forgetApproval(askId: string): void {
  conversationStore.forgetApproval(askId)
}

async function onAnswerAsk(
  askId: string,
  selection: 'run' | 'cancel'
): Promise<void> {
  const shownAt = conversationStore.approvalShownAt(askId)
  const decidedAt = Date.now()
  if (await answerAsk(askId, selection))
    trackApprovalResolved(askId, selection, decidedAt, shownAt)
}

void refreshCloudWorkflowIds()
onBeforeUnmount(() => {
  runPanelTeardown({
    releaseCoachCompletionWaiters: () => {
      releaseCoachCompletionWaiters()
    },
    invalidateConsentHeldSubmission: () => {
      if (
        (coachDeferredBy.value === null || !agentPanelStore.isVisible) &&
        composerStore.submission?.id === consentHeldSubmissionId
      )
        composerStore.invalidateSubmission()
    },
    detachDocOpMinter: () => {
      docOpMinter.detach()
    },
    detachRestoreOpMinter: () => {
      restoreOpMinter.detach()
    },
    exitNodeSelectionMode: canvasStore.stopNodePicking,
    stopSession: () => {
      stop()
    },
    invalidateActiveTabGeneration: () => {
      ++activeTabGeneration
    },
    clearEditingTab: () => {
      tabActivity.setEditing(null)
    },
    clearCreatingTab: () => {
      tabActivity.setCreating(false)
    },
    // PM-1575: the store singleton outlives this component. Without resetting
    // the gate here, a remount's own setCanvasSyncGate() call is the only
    // thing standing between the old (now torn-down) follower's gate and a
    // turn resumed in the meantime reading it -- reset to the always-safe
    // default instead of leaving whatever this instance last set.
    resetCanvasSyncGate: () => {
      conversationStore.setCanvasSyncGate(
        () => false,
        () => 0
      )
    }
  })
})

const { copy } = useClipboard({ legacy: true })

/**
 * DES-1221. This component mounts only while the panel is on screen, so
 * reading the flag here keeps the exposure — and the experiment's
 * denominator — to the panel openers the hypothesis is about.
 */
const { variant: freeUsePlacement } = useFreeUsePlacement()
const {
  assignment: starterPromptAssignment,
  attributeExperiment: attributeStarterPromptExperiment,
  expose: exposeStarterPromptSet
} = useStarterPromptSet()

function onFreeUseNotice(metadata: AgentFreeUseNoticeMetadata): void {
  useTelemetry()?.trackAgentFreeUseNotice(metadata)
}

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
    turn_id: turnId,
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
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    titleSource: thread.title ? 'server' : 'fallback'
  }
}

const threadSummaries = ref<AgentThreadSummary[]>([])

async function refreshHistory(): Promise<void> {
  try {
    threadSummaries.value = await listThreads()
    history.replaceAll(threadSummaries.value.map(toChatSession))
  } catch (error) {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_thread_list_load_failed'
    })
    surfaceAgentError(
      'agent_api_failed',
      error instanceof Error ? error.message : String(error)
    )
    trackAgentError(
      'thread_list_load_failed',
      'pre_acceptance',
      'error_overlay',
      { retryable: isRetryableRequestFailure(error, false) }
    )
  }
}

void refreshHistory()

const currentChatReady = computed(
  () =>
    isTranscriptReady.value &&
    threadId.value === history.activeId &&
    selectedTarget.value !== null
)

const historyGroups = computed(() => {
  const id = threadId.value
  if (id === null || !isTranscriptReady.value || id !== history.activeId)
    return history.grouped
  return withCurrentSessionTitle(
    history.grouped,
    history.titleFor(id) || deriveSessionTitle(entries.value)
  )
})

async function onSelectHistory(
  id: string,
  isCurrent: () => boolean
): Promise<boolean> {
  if (currentChatReady.value && id === threadId.value)
    return onShowTarget(isCurrent, warnRestoreFailed)

  composerStore.invalidateSubmission()
  cancelWorkflowSelection()
  agentPanelStore.beginWorkflowRestoration()
  canvasStore.stopNodePicking()
  const opened = await loadThread(id, isCurrent)
  if (opened)
    useTelemetry()?.trackAgentThreadStarted({ source: 'history_select' })
  void refreshHistory()
  return opened
}

watch(
  [() => workflowStore.activeWorkflow, threadSummaries],
  ([workflow, threads]) => {
    if (workflow === null) return
    const workflowId = cloudIdFor(workflow)
    if (workflowId === undefined) return
    const matchingThread = threads.find(
      (thread) => thread.workflow_id === workflowId
    )
    if (matchingThread === undefined || matchingThread.id === threadId.value)
      return
    void onSelectHistory(matchingThread.id)
  }
)

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
  if (id === history.activeId && id === threadId.value)
    void copy(buildTranscriptMarkdown(entries.value))
  else toast.info(t('agent.copyUnavailable'))
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
    tooltip: t('agent.showChatHistory'),
    title: t('agent.coachHistoryTitle'),
    body: t('agent.coachHistoryBody')
  }
])

let consentHeldSubmissionId: number | undefined
async function consentAllowsSubmission(
  submissionId: number | undefined
): Promise<boolean> {
  let hasConsent = false
  consentHeldSubmissionId = submissionId
  try {
    await withConsent('first_message', () => {
      hasConsent = true
    })
    if (hasConsent) await waitForCoachCompletion()
  } finally {
    if (consentHeldSubmissionId === submissionId)
      consentHeldSubmissionId = undefined
  }
  return composerStore.submission?.id === submissionId && hasConsent
}

const { submit: onSend } = useAgentDraftSubmission({
  canSubmit: () => !workflowSelecting.value && !isSending.value,
  onSubmit: agentPanelStore.retainWorkflowTarget,
  target: () => selectedTarget.value,
  editableWorkflowId: () => editableWorkflowId.value,
  selection: {
    staged: selectionTags,
    workflow: () => nodeReferenceWorkflow,
    consume: consumeSelection,
    replace: replaceSelectionTags,
    exit: canvasStore.stopNodePicking
  },
  // fallow-ignore-next-line complexity -- Existing PR logic; this lane changes only the composing panel test.
  send: async (text, attachments, nodes, references, meta) => {
    const submissionId = composerStore.submission?.id
    if (
      !consentAccepted.value &&
      !(await consentAllowsSubmission(submissionId))
    )
      return false

    // The same origin `performSend` pins the turn to, taken in the same tick,
    // so the report follows the tab the turn is posted against. Everything but
    // the workflow id is captured now, like the thread; the id here is only
    // the fallback for a send that never reaches the refresh.
    const originContext = targetWorkflowTurnContext()
    pendingSend = {
      metadata: {
        attachment_count: attachments.length,
        node_tag_count: nodes.length,
        thread_id: threadId.value,
        workflow_id: originContext?.id ?? null,
        client_message_id: meta.clientMessageId,
        input_method: meta.inputMethod,
        starter_prompt_id: meta.starterPrompt?.id ?? null,
        starter_prompt_click_id: meta.starterPrompt?.clickId ?? null,
        ...(meta.starterPrompt?.assignment
          ? {
              '$feature/agent-starter-prompt-set': meta.starterPrompt.assignment
            }
          : {})
      },
      origin:
        originContext === undefined ? null : { tabPath: originContext.tabPath }
    }
    const selectionWorkflow = selectedTarget.value
    try {
      return await sendMessage(
        text,
        attachments,
        nodes,
        references,
        () => (selectionWorkflow ? cloudIdFor(selectionWorkflow) : undefined),
        // The same id reported on app:agent_message_sent just above. Sent to the
        // server so it can echo it onto agent_turn_started, which is what makes
        // the message -> turn step attributable instead of only countable.
        meta.clientMessageId
      )
    } finally {
      // Normally already consumed by the refresh. A send rejected before it
      // gets that far still reports here, so the funnel counts the attempt.
      reportPendingSend()
    }
  }
})

// The session owns the acknowledgement boundary: a stop that lands before the
// POST acks is remembered there and committed at ack (see stopPendingAck).
function onStop(method: AgentStopMethod): void {
  void stopTurn(method)
}

function onRenameChat(title: string): void {
  if (threadId.value !== null) history.rename(threadId.value, title)
}

function onRenameHistory(id: string, title: string): void {
  history.rename(id, title)
}

function onDeleteHistory(id: string): void {
  const isCurrent =
    id === history.activeId ||
    (history.activeId === null && id === threadId.value)
  history.remove(id)
  // Deleting the open chat also ends it; a dead thread must not stay editable.
  if (isCurrent) onNewChat('history_delete')
}

function onNewChat(source?: 'new_chat_button' | 'history_delete'): void {
  composerStore.invalidateSubmission()
  cancelWorkflowSelection()
  canvasStore.stopNodePicking()
  composerStore.setWorkflowReferences([])
  composerStore.resetPromptHistory()
  newChat(source)
  if (selectionTags.value.length) agentPanelStore.retainWorkflowTarget()
  else agentPanelStore.startFollowingVisibleWorkflow()
}

const fileInput = ref<HTMLInputElement>()
const assetDragActive = ref(false)
let assetDragDepth = 0

watch(
  selectedTarget,
  (target) => {
    canvasStore.stopNodePicking()
    composerStore.setNodeScope(target?.instanceId ?? null)
    nodeReferenceWorkflow = null
  },
  { flush: 'sync' }
)

watch(
  () => workflowStore.activeWorkflow,
  () => {
    canvasStore.stopNodePicking()
    onVisibleWorkflowChanged()
  },
  { flush: 'sync' }
)

// Target startup is an explicit session event, not a read of a thread ID that
// happens to have been assigned by start(). Register scope cleanup first.
start({
  restore:
    agentPanelStore.view.screen === 'chat' ||
    (agentPanelStore.view.selection.status === 'idle' &&
      threadId.value === agentPanelStore.view.previousThreadId)
})

watch(() => canvasStore.currentGraph, canvasStore.stopNodePicking, {
  flush: 'sync'
})

function onSelectNodes(): void {
  if (!canReferenceNodes.value || canvasStore.isPickingNodes) return
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
  canvasStore.startNodePicking()
  void nextTick(() => {
    if (canvasStore.isPickingNodes) canvas.canvas.focus()
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
  onError: (message) => toast.warning(message, { duration: 5000 }),
  onDuplicate: notifyDuplicateAttachments,
  stage: composerStore.addAttachment,
  update: composerStore.updateAttachment,
  remove: composerStore.removeAttachment
})

watch(
  [
    () => resolvedUserInfo.value?.id,
    () => workspaceStore.activeWorkspaceId,
    () => assetsStore.deletingAssetIds.size
  ],
  attachment.forgetUploads
)

function notifyDuplicateAttachments(names: string[]): void {
  toast.info(
    t(
      'agent.attachmentsAlreadyAdded',
      { name: names[0], count: names.length },
      names.length
    ),
    { duration: 3500 }
  )
}

onBeforeUnmount(() =>
  runPanelTeardown({
    cancelAllUploads: () => {
      attachment.cancelAllUploads()
    }
  })
)

function onAttach(): void {
  canvasStore.stopNodePicking()
  useTelemetry()?.trackAgentAttachButtonClicked({ method: 'menu' })
  fileInput.value?.click()
}

async function onAttachFiles(files: File[]): Promise<void> {
  if (await attachment.addFiles(files))
    useTelemetry()?.trackAgentAttachButtonClicked({ method: 'paste' })
}

function onOpenAssets(): void {
  canvasStore.stopNodePicking()
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
  const node = canvasStore.selectedItems
    .filter(isLGraphNode)
    .find((item) => selectedNodeKey(toSelectedNode(item)) === id)
  removeSelectionTag(id)
  if (node) {
    canvasStore.canvas?.deselect(node)
    canvasStore.canvas?.setDirty(true)
  }
}

function onClosePanel(): void {
  canvasStore.stopNodePicking()
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

async function attachDroppedAsset(event: DragEvent): Promise<boolean> {
  const asset = event.dataTransfer && getDroppedAsset(event.dataTransfer)
  if (!asset) {
    toast.warning(t('agent.assetNotAttachable'), { duration: 5000 })
    return false
  }

  const sourceKey = asset.ref ? `asset:${asset.ref}` : `uri:${asset.uri}`
  if (asset.ref && asset.kind !== 'other') {
    if (composerStore.attachments.some((item) => item.ref === asset.ref)) {
      notifyDuplicateAttachments([asset.name])
      return false
    }
    const added = composerStore.addAttachment({
      id: `asset:${crypto.randomUUID()}`,
      name: asset.name,
      ref: asset.ref,
      sourceKey,
      previewUrl: asset.previewUrl,
      mediaUrl: asset.mediaUrl,
      mediaKind: asset.kind
    })
    if (!added) notifyDuplicateAttachments([asset.name])
    return added
  }

  const result = await attachment.addDeferredFile(
    asset.name,
    async () => {
      const file = await fetchDroppedAsset(asset)
      return file && isAgentAttachable(file) ? file : undefined
    },
    sourceKey
  )
  if (result === 'unsupported')
    toast.warning(t('agent.assetNotAttachable'), { duration: 5000 })
  return result === 'uploaded'
}

function onPanelDragOver(event: DragEvent): void {
  if (isAttachableDrag(event)) event.preventDefault()
}

async function onPanelDrop(event: DragEvent): Promise<void> {
  clearAssetDrag()
  // A dropped asset card carries a URI, not a File, so the claim must happen
  // before the async fetch resolves it into one.
  if ((event.dataTransfer?.files.length ?? 0) === 0 && isAssetDrag(event)) {
    event.preventDefault()
    void attachDroppedAsset(event).then((attached) => {
      if (attached)
        useTelemetry()?.trackAgentAttachButtonClicked({ method: 'drag_drop' })
    })
    return
  }
  // Anything the composer cannot attach still belongs to the graph loader, which
  // only runs while the drop is unclaimed, so claim the attachable files alone.
  const files = Array.from(event.dataTransfer?.files ?? []).filter(
    isAgentAttachable
  )
  if (files.length === 0) return
  event.preventDefault()
  if (await attachment.addFiles(files))
    useTelemetry()?.trackAgentAttachButtonClicked({ method: 'drag_drop' })
}
</script>

<template>
  <AgentGraphActivityBar :canvas="canvasStore.canvas" />
  <div
    id="agent-panel-root"
    class="relative size-full"
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
      :entries
      :editable-turn-id="editableTurnId"
      :answering-ask-ids="answeringAskIds"
      :user-name="userName"
      :streaming="isStreaming"
      :submitting="isSending || status === 'thinking'"
      :can-attach="true"
      :can-open-assets="!isBuilderMode"
      :is-maximized="agentPanelStore.isMaximized"
      :history-groups="historyGroups"
      :select-history="onSelectHistory"
      :current-chat-ready="currentChatReady"
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
      :follows-visible-workflow="agentPanelStore.followsVisibleWorkflow"
      :selecting-tab-path="selectingTarget?.path ?? null"
      :select-tab="onSelectWorkflowTarget"
      :workflow-detached="workflowDetached"
      :target-unavailable="agentPanelStore.targetUnavailable"
      :get-mention-nodes="mentionableNodes"
      :paywall-presentation="paywallPresentation"
      :credits-exhausted="showStandingPaywall"
      :free-use-placement="freeUsePlacement"
      :starter-prompt-assignment="starterPromptAssignment"
      :attribute-starter-prompt-experiment="attributeStarterPromptExperiment"
      @starter-prompt-rendered="exposeStarterPromptSet"
      @free-use-notice="onFreeUseNotice"
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
      @attach-files="onAttachFiles"
      @open-assets="onOpenAssets"
      @select-nodes="onSelectNodes"
      @remove-tag="onRemoveSelectionTag"
      @mention-pick="onMentionPick"
      @request-workflow-references="onRequestWorkflowReferences"
      @remove-workflow-reference="composerStore.removeWorkflowReference"
      @feedback="onFeedback"
      @answer-ask="onAnswerAsk"
      @approval-shown="onApprovalShown"
      @open-workflow="onOpenApprovalWorkflow"
      @open-reference-workflow="onNavigateToReferenceWorkflow"
      @show-target="onShowTarget"
      @paywall-action="onPaywallAction"
      @standing-paywall-shown="onStandingPaywallShown"
      @new-chat="onNewChat('new_chat_button')"
      @start-tour="restartCoach"
      @toggle-size="agentPanelStore.toggleMaximize()"
      @close="onClosePanel"
      @open-history="refreshHistory()"
      @delete-history="onDeleteHistory"
      @rename-history="onRenameHistory"
      @rename-chat="onRenameChat"
      @copy-history="onCopyMarkdown"
    >
      <template v-if="isCrdtDevPanelEnabled" #instrument>
        <CrdtDevPanel :status="crdtStatus" :snapshot="crdtDebugSnapshot" />
      </template>
    </AgentPanel>
    <div
      v-if="assetDragActive"
      role="status"
      class="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-default bg-secondary-background/90 p-4 font-inter text-sm/5 text-base-foreground"
    >
      <span
        aria-hidden="true"
        class="icon-[lucide--upload] size-8 shrink-0 text-muted-foreground"
      />
      <span>{{ t('agent.dragAndDropAssets') }}</span>
    </div>
    <OnboardingCoach
      v-if="consentAccepted && onboardingKey && coachDeferredBy === null"
      :key="onboardingKey"
      ref="coachRef"
      :steps="coachSteps"
      :storage-key="onboardingKey"
      @finished="releaseCoachCompletionWaiters"
    />
  </div>
</template>
