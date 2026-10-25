<script setup lang="ts">
import './agentPanel.css'

import type { AgentAnswerRequest } from '@comfyorg/ingest-types'
import { useClipboard, useEventListener } from '@vueuse/core'
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
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentErrorMetadata,
  AgentMessageSentMetadata,
  AgentPaywallSurface,
  AgentRunApprovalDecision,
  AgentStopMethod
} from '@/platform/telemetry/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { hasUnsyncedHumanOps } from '@/workbench/extensions/agent/crdt/unsyncedHumanOps'
import { formatWorkflowSyncErrorDetail } from '@/workbench/extensions/agent/crdt/workflowSyncErrorDetail'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useAppMode } from '@/composables/useAppMode'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { findServerPreviewUrl } from '@/platform/assets/utils/assetPreviewUtil'
import { fetchDroppedAsset, getDroppedAsset } from '@/utils/eventUtils'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import type { DroppedAsset } from '@/utils/eventUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import {
  AGENT_ATTACH_ACCEPT,
  agentAttachRefVerdict,
  agentAttachVerdict,
  isValidAgentAttachment
} from './utils/attachableFiles'
import type { AgentAttachVerdict } from './utils/attachableFiles'
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
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import { isCloud } from '@/platform/distribution/types'
import { parseNodeId } from '@/types/nodeId'
import { parseNodeLocatorId } from '@/types/nodeIdentification'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useAccountPreconditionDialog } from '@/platform/billing/subscription/composables/useAccountPreconditionDialog'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
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
import AgentCreditTransitionNotice from './components/agent/AgentCreditTransitionNotice.vue'
import RunNoticeBanner from './components/agent/RunNoticeBanner.vue'
import { agentBoundWorkflowIdKey } from './components/agent/agentBoundWorkflowId'
import AgentGraphActivityBar from './components/AgentGraphActivityBar.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TURN_ATTACHMENTS,
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
  AgentWsEvent,
  TurnId
} from './schemas/agentApiSchema'
import { toTurnId } from './schemas/agentApiSchema'
import type {
  ConversationEntry,
  TurnTab
} from './stores/agent/agentConversationStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import type {
  TurnOrigin,
  WorkflowTurnContext
} from './composables/agent/useAgentSession'
import type { CoachStep } from './composables/agent/useOnboarding'
import { useBillingIdentity } from './composables/useBillingIdentity'
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
import { useAgentChatHistoryRefresh } from './composables/agent/useAgentChatHistoryRefresh'
import { useAgentWorkflowChatFollow } from './composables/agent/useAgentWorkflowChatFollow'
import {
  agentSocketAuthParams,
  ensureSignedIn,
  hasAgentCredential
} from './services/agent/agentAuth'
import type { DraftSnapshot } from './services/agent/agentRestClient'
import type { AgentPaywallAction } from './services/agent/agentPaywallPresentation'
import {
  DEFAULT_AGENT_PAYWALL_PRESENTATION,
  resolveAgentPaywallPresentation,
  toAgentPaywallCta,
  toAgentPaywallReason
} from './services/agent/agentPaywallPresentation'
import type { CanvasConfirmation } from './services/agent/agentEventTransport'
import { toolCanClaimCanvasContent } from './services/agent/agentToolClassification'
import { areAgentWorkflowIdsEquivalent } from './services/agent/agentWorkflowId'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { resolveAgentIdentity } from './services/agent/agentIdentity'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentNodeDefinitionRefreshStore } from './stores/agent/agentNodeDefinitionRefreshStore'
import { agentMessageText } from './utils/agentMessageText'
import {
  deriveSessionTitle,
  withCurrentSessionTitle
} from './utils/sessionTitle'
import { useAgentComposerStore } from './stores/agent/agentComposerStore'
import { useAgentConsentStore } from './stores/agent/agentConsentStore'
import { isCreditTransitionNoticeShown } from './stores/agent/creditTransitionNoticeState'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentPanelRenderStore } from './stores/agent/agentPanelRenderStore'
import { useAgentGraphActivityStore } from './stores/agent/agentGraphActivityStore'
import {
  isCrdtDebugEnabled,
  resolveDebugPanelEnabled,
  startCrdtDebugGate
} from './crdt/crdtDebugGate'
import { attachDocOpMinter } from './crdt/docOpMinter'
import { attachRestoreOpMinter } from './crdt/restoreOpMinter'
import { useAgentCrdtFollower } from './crdt/useAgentCrdtFollower'
import { createAgentDocFrameTransport } from './crdt/agentDocFrameTransport'

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
  canAccessSubscriptionFeatures,
  fetchStatus: refreshBillingStatus
} = useBillingContext()
const conversationStore = useAgentConversationStore()
const history = useAgentChatHistoryStore()
const { accepted: consentAccepted, identity: consentIdentity } = storeToRefs(
  useAgentConsentStore()
)
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
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

onBeforeUnmount(startCrdtDebugGate())

const rest = createAgentRestClient()

const events = createAgentEventSource({
  endpoint: api.apiURL('/agent/events'),
  getAuthParams: agentSocketAuthParams
})

const docTransport = createAgentDocFrameTransport(events)
onBeforeUnmount(() => docTransport.destroy())

const agentIdentity = resolveAgentIdentity({
  getIdentity: () => rest.getIdentity(),
  onSocketOpen: (listener) => docTransport.onSocketOpen(listener),
  isRetryable: (error) => isRetryableRequestFailure(error, false),
  onFailure: (error) =>
    reportError(error, {
      surface: 'agent',
      errorType: 'failure_resolving_agent_identity',
      level: 'warning'
    })
})
onBeforeUnmount(() => agentIdentity.stop())

const authStore = useAuthStore()
const apiKeyAuthStore = useApiKeyAuthStore()
const agentAccountId = computed(
  () => authStore.userId ?? apiKeyAuthStore.currentUser?.id ?? null
)
watch(agentAccountId, () => {
  events.reconnect()
  agentIdentity.reset()
})

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
const agentScopedHasFunds = computed(
  () => subscription.value?.agentScopedHasFunds
)
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

const unresolvedPaywallPending = computed(() =>
  conversationEntries.value.some(
    (entry) =>
      entry.role === 'assistant' &&
      entry.parts.some((part) => part.type === 'paywall')
  )
)

/**
 * Suppressed while the latest transcript entry is an unresolved inline card:
 * the two render the same copy. An older card may be scrolled away and must not
 * hide the standing recovery path after a later server-side refusal.
 */
const latestEntryHasPaywall = computed(() => {
  const latestEntry = conversationEntries.value.at(-1)
  return (
    latestEntry?.role === 'assistant' &&
    latestEntry.parts.some((part) => part.type === 'paywall')
  )
})
const threadHasUserMessage = computed(() =>
  conversationEntries.value.some((entry) => entry.role === 'user')
)
async function sendWithFundsRecheck(
  send: (onAccepted: () => void) => Promise<boolean>
): Promise<boolean> {
  if (billingType.value !== 'workspace' || agentHasFunds.value !== false)
    return send(() => undefined)
  let recheckId: number | undefined
  let stopAdoptionWatch: (() => void) | undefined
  const settle = () => {
    if (recheckId !== undefined) agentPanelStore.finishFundsRecheck(recheckId)
  }
  let admitted = false
  let sent: boolean
  try {
    sent = await send(() => {
      admitted = true
      recheckId = agentPanelStore.beginFundsRecheck(billingIdentity.value, () =>
        stopAdoptionWatch?.()
      )
      stopAdoptionWatch = watch([subscription, billingIdentity], settle, {
        flush: 'sync'
      })
    })
  } finally {
    if (!admitted) settle()
  }
  if (!admitted) return sent
  void refreshBillingStatus().catch((error: unknown) => {
    reportError(error, {
      surface: 'agent',
      errorType: 'error_refreshing_agent_billing_status'
    })
  })
  return sent
}

const showStandingPaywall = computed(() => {
  if (!creditsExhausted.value || !threadHasUserMessage.value) return false
  if (agentPanelStore.hasPendingFundsRecheck(billingIdentity.value))
    return false
  return !latestEntryHasPaywall.value
})

const agentPanelStore = useAgentPanelStore()
const billingIdentity = useBillingIdentity()

watch(billingIdentity, () => {
  agentPanelStore.cancelFundsRechecks()
  agentPanelStore.reportedExhaustionIdentity = null
})

const showCreditTransitionNotice = computed(
  () =>
    isCreditTransitionNoticeShown(
      agentPanelStore.creditTransitionNotice,
      billingIdentity.value
    ) &&
    consentAccepted.value &&
    billingType.value === 'workspace' &&
    capabilityReadSettled.value &&
    canAccessSubscriptionFeatures.value &&
    agentScopedHasFunds.value === false &&
    agentHasFunds.value === true
)

function onDismissCreditTransitionNotice(): void {
  useTelemetry()?.trackAgentCreditTransitionNotice({ action: 'dismissed' })
  agentPanelStore.dismissCreditTransitionNotice(billingIdentity.value)
}

function onCreditTransitionNoticeShown(): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  if (
    !agentPanelStore.claimCreditTransitionNoticeImpression(
      billingIdentity.value
    )
  )
    return
  telemetry.trackAgentCreditTransitionNotice({ action: 'shown' })
}

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
  adoptTarget: adoptWorkflowTarget,
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
const coachCompletionWaiters = new Set<(proceed: boolean) => void>()
function releaseCoachCompletionWaiters(proceed = true): void {
  for (const resolve of coachCompletionWaiters) resolve(proceed)
  coachCompletionWaiters.clear()
}
watch(
  [consentAccepted, onboardingKey, coachDeferredBy, consentIdentity],
  ([accepted, key, reason, identity], previous) => {
    if (accepted && key && !hasSeenCoach(key)) trackCoachDeferral(key, reason)
    if (!accepted || reason !== null || identity !== previous[3])
      releaseCoachCompletionWaiters()
  },
  { immediate: true }
)
const coachRef = ref<InstanceType<typeof OnboardingCoach>>()
const sendHeldByCoach = ref(false)

async function waitForCoachCompletion(): Promise<boolean> {
  const key = onboardingKey.value
  if (!key || hasSeenCoach(key)) return true
  await nextTick()
  if (
    key !== onboardingKey.value ||
    !consentAccepted.value ||
    coachDeferredBy.value !== null ||
    !coachRef.value
  )
    return true
  sendHeldByCoach.value = true
  try {
    return await new Promise<boolean>((resolve) =>
      coachCompletionWaiters.add(resolve)
    )
  } finally {
    sendHeldByCoach.value = false
  }
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
  if (canvasMissedDocumentFrames(cloudIdFor(target))) return undefined
  const content = serializedCanvas(target)
  if (!content) return undefined
  return { content }
}

function canvasMissedDocumentFrames(documentId: string | undefined): boolean {
  return (
    documentId !== undefined &&
    boundWorkflowId.value === documentId &&
    crdtStatus.value.canvasMayBeStale
  )
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
  const adoptable =
    sent.id === undefined
      ? bindingStore.tabPathFor(workflowId) === undefined &&
        storedWorkflowFor(workflowId) === null
      : sent.id === workflowId
  if (adoptable) {
    bindingStore.bind(workflowId, sent.tabPath)
    reportWorkflowBound(
      workflowId,
      previousWorkflowId,
      sent.id === undefined ? 'minted' : 'active_tab'
    )
  }
}

async function onWorkflowRestoredAndBound(
  workflowId: string | undefined,
  isCurrent: () => boolean
): Promise<boolean> {
  const { ready, committedWorkflowId } = await onWorkflowRestored(
    workflowId,
    isCurrent
  )
  if (committedWorkflowId === null || !isCurrent()) return ready
  if (hasUnsyncedHumanOps(committedWorkflowId)) return ready
  if (boundWorkflowId.value !== committedWorkflowId)
    bindWorkflow(committedWorkflowId)
  return ready
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

function registerAgentRunJobOwner(event: AgentWsEvent): void {
  if (event.type !== 'agent_tool_call') return
  const { job_id: jobId, job_workflow_id: workflowId } = event.data
  if (!jobId || !workflowId) return
  const workflow = boundOrOpenWorkflowFor(workflowId)
  if (workflow) useExecutionStore().registerJobOwner(jobId, workflow)
}

const agentNodeDefinitionRefresh = useAgentNodeDefinitionRefreshStore()

function observeAgentEvent(event: AgentWsEvent): void {
  agentNodeDefinitionRefresh.observeAgentEvent(event)
  registerAgentRunJobOwner(event)
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
  onAgentEvent: observeAgentEvent,
  onThreadActivated: (id) => history.setActive(id),
  onAskResolved: forgetApproval,
  refreshCredentialDuringTurns: !isCloud,
  workflow: {
    initialize: agentPanelStore.initializeTargetTracking,
    current: targetWorkflowTurnContext,
    adopted: onWorkflowAdopted,
    restored: restoreChatWorkflow,
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
const agentUserId = computed(() => {
  const identity = agentIdentity.state.value
  return identity.status === 'resolved' ? identity.userId : null
})

const isFollowerActive = computed(
  () => isBoundWorkflowActive.value && agentUserId.value !== null
)

const {
  status: crdtStatus,
  debugSnapshot: crdtDebugSnapshot,
  enqueueHumanOperations,
  retrySubscription,
  docInputNames,
  docWidgetValue,
  docPromotedWidgets,
  mayWritePromotedHost,
  docHasSubgraphDefinition,
  notifyWidgetWriteRefused,
  subscriptionSent
} = useAgentCrdtFollower(boundWorkflowId, {
  transport: docTransport,
  userId: () => agentUserId.value,
  isTargetActive: isFollowerActive,
  // `app.isGraphReady` is a plain getter; reading `canvasStore.canvas` (set
  // right after `app.setup()`) makes the follower's graph watch fire once the
  // root graph exists.
  getGraph: () =>
    canvasStore.canvas && app.isGraphReady ? app.rootGraph : null,
  events: {
    onAppliedUpdate({ workflowId, opIds, isLive }) {
      conversationStore.notifyCanvasCaughtUp({ workflowId, opIds, isLive })
    },
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
  applierDeps: {
    getCanvas: () => app.canvas,
    withRemoteActor: (actor, fn) => layoutStore.withActor(actor, fn),
    viewportBounds() {
      const canvas = canvasStore.canvas
      if (!canvas || canvas.graph?.isRootGraph === false) return null
      const [x, y, width, height] = canvas.ds.visible_area
      return { x, y, width, height }
    }
  },
  canvasFor: canvasForWorkflow
})
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
function followerCanDeliver(): boolean {
  return isFollowerActive.value && subscriptionSent()
}
const docOpMinter = attachDocOpMinter({
  isEnabled: () => agentPanelStore.enabled,
  isDocBound: followerCanDeliver,
  enqueue: enqueueHumanOperations,
  getGraph: () => (app.isGraphReady ? app.rootGraph : null),
  boundRootGraphId,
  docInputNames,
  docWidgetValue,
  docPromotedWidgets,
  mayWritePromotedHost,
  docHasSubgraphDefinition,
  onWidgetWriteRefused: notifyWidgetWriteRefused
})
const restoreOpMinter = attachRestoreOpMinter({
  isEnabled: () => agentPanelStore.enabled,
  isDocBound: followerCanDeliver,
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

function canvasConfirmationState(workflowId?: string): CanvasConfirmation {
  const bound = boundWorkflowId.value ?? undefined
  if (bound === undefined) return 'none'
  if (
    workflowId !== undefined &&
    !areAgentWorkflowIdsEquivalent(bound, workflowId)
  )
    return 'unavailable'
  if (!isBoundWorkflowActive.value) return 'unavailable'
  const status = crdtStatus.value
  if (!status.enabled) return 'none'
  if (status.connected) return 'awaiting'
  return status.terminal === null ? 'none' : 'unavailable'
}
conversationStore.setCanvasSyncGate(
  canvasConfirmationState,
  () => crdtStatus.value.outcomes.appliedLive
)

function tabAt(path: string | undefined, status: 'guessed' | 'known'): TurnTab {
  const workflow =
    path === undefined ? undefined : workflowStore.getWorkflowByPath(path)
  return workflow
    ? { status, workflowInstanceId: workflow.instanceId }
    : { status: 'unknown' }
}

function turnTab(): TurnTab {
  if (workflowDetached.value)
    return {
      status: agentPanelStore.canRestoreWorkflow ? 'unknown' : 'none'
    }
  const bound = boundWorkflowId.value
  const context = targetWorkflowTurnContext()
  if (bound === null)
    return tabAt(
      context?.id === undefined ? undefined : context.tabPath,
      'guessed'
    )
  return tabAt(
    bindingStore.tabPathFor(bound) ??
      (context?.id === bound ? context.tabPath : undefined),
    'known'
  )
}

function adoptRestoredWorkflowTab(workflowId: string): void {
  const restored = selectedTarget.value
  const threadId = conversationStore.threadId
  if (
    restored !== null &&
    threadId !== null &&
    bindingStore.tabPathFor(workflowId) === restored.path
  )
    conversationStore.adoptThreadTab(threadId, restored.instanceId)
}

async function restoreThreadWorkflow(
  workflowId: string | undefined,
  isCurrent: () => boolean
): Promise<boolean> {
  const restoring = agentPanelStore.canRestoreWorkflow
  const ready = await onWorkflowRestoredAndBound(workflowId, isCurrent)
  if (ready && restoring && workflowId !== undefined)
    adoptRestoredWorkflowTab(workflowId)
  return ready
}

conversationStore.setTurnTabResolver(turnTab)
conversationStore.onTurnCompleted((path) => tabActivity.markModified(path))
watch(
  () => conversationStore.turnTabs,
  (tabs) => tabActivity.setAgentTurnTabs(tabs),
  { immediate: true, flush: 'sync' }
)

const boundCanvasNodeCount = ref(0)
function readBoundCanvasNodeCount(): void {
  boundCanvasNodeCount.value = isBoundWorkflowActive.value
    ? (workflowStore.activeWorkflow?.activeState?.nodes?.length ?? 0)
    : 0
}
watch([boundWorkflowId, isBoundWorkflowActive], readBoundCanvasNodeCount, {
  immediate: true
})
useEventListener(
  api,
  'graphChanged',
  (event: CustomEvent<ComfyWorkflowJSON>) => {
    if (isBoundWorkflowActive.value)
      boundCanvasNodeCount.value = event.detail.nodes?.length ?? 0
  }
)

const completedTurnClaimedCanvasContent = ref(false)
function completedTurnCanClaimCanvasContent(): boolean {
  const lastCanvasTool = conversationMessages.value
    .at(-1)
    ?.parts.findLast(
      (part) =>
        part.type === 'tool' &&
        (part.name === 'clear_canvas'
          ? part.ok === true
          : part.ok !== false && toolCanClaimCanvasContent(part.name))
    )
  return (
    lastCanvasTool?.type === 'tool' && lastCanvasTool.name !== 'clear_canvas'
  )
}
const canvasEmptyAfterTurn = computed(
  () =>
    completedTurnClaimedCanvasContent.value &&
    isBoundWorkflowActive.value &&
    boundCanvasNodeCount.value === 0
)

function refreshBillingAfterTurn(): void {
  if (billingType.value !== 'workspace') return
  void refreshBillingStatus().catch((error: unknown) => {
    reportError(error, {
      surface: 'agent',
      errorType: 'error_refreshing_agent_billing_status'
    })
  })
}

// Adoption (onWorkflowAdopted) and tab activation (onAgentActiveTab) are the
// primary spinner setters; the non-idle branch only re-arms it after the
// stash/resume flip of a panel remount, where those setters never run.
let wasTurnActive = false
watch(
  [status, conversationTurnId],
  ([value, turnId]) => {
    const active = value !== 'idle'
    const completedTurn = wasTurnActive && !active
    if (completedTurn)
      completedTurnClaimedCanvasContent.value =
        completedTurnCanClaimCanvasContent()
    else if (active) completedTurnClaimedCanvasContent.value = false
    wasTurnActive = active
    if (active) {
      graphActivity.startTurn(turnId)
      return
    }
    if (completedTurn) {
      graphActivity.finishTurn()
      refreshBillingAfterTurn()
    }
  },
  { immediate: true, flush: 'sync' }
)
watch([threadId, boundWorkflowId], () => {
  completedTurnClaimedCanvasContent.value = false
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

let activeTabGeneration = 0
let activeTabChain: Promise<void> = Promise.resolve()

function enqueueActiveTab(data: AgentActiveTabData): Promise<boolean> {
  const generation = ++activeTabGeneration
  const turnId =
    data.message_id === undefined
      ? conversationTurnId.value
      : toTurnId(data.message_id)
  const result = activeTabChain.then(() =>
    onAgentActiveTab(data, generation, turnId)
  )
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

interface ActiveTabActivation {
  stale: () => boolean
  showTurnOn: (tab: ComfyWorkflow) => void
}

async function onAgentActiveTab(
  data: AgentActiveTabData,
  generation: number,
  turnId: TurnId | null
): Promise<boolean> {
  const previousWorkflowId = boundWorkflowId.value
  const stale = () => generation !== activeTabGeneration
  if (stale()) return false
  const activation: ActiveTabActivation = {
    stale,
    showTurnOn: (tab) => {
      if (turnId !== null)
        conversationStore.moveTurnToTab(turnId, tab.instanceId)
    }
  }
  try {
    const bound = boundOrOpenWorkflowFor(data.workflow_id)
    return bound
      ? await activateExistingAgentTab(
          data,
          bound,
          previousWorkflowId,
          activation
        )
      : await createAndActivateAgentTab(data, previousWorkflowId, activation)
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
  { stale, showTurnOn }: ActiveTabActivation
): Promise<boolean> {
  const opened = await workflowService.openWorkflow(bound)
  if (stale()) return false
  if (!opened) {
    warnWorkflowUnavailable()
    trackWorkflowOpenFailure('toast')
    return false
  }
  bindingStore.bind(data.workflow_id, bound.path)
  showTurnOn(bound)
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
  { stale, showTurnOn }: ActiveTabActivation
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
  showTurnOn(tab)
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
  answer: AgentAnswerRequest
): Promise<void> {
  const shownAt = conversationStore.approvalShownAt(askId)
  const decidedAt = Date.now()
  const decision = runApprovalDecision(answer)
  if ((await answerAsk(askId, answer)) && decision)
    trackApprovalResolved(askId, decision, decidedAt, shownAt)
}

function runApprovalDecision(
  answer: AgentAnswerRequest
): 'run' | 'cancel' | undefined {
  if (answer.selected.length !== 1 || answer.other_text) return undefined
  const [choice] = answer.selected
  return choice === 'run' || choice === 'cancel' ? choice : undefined
}

void refreshCloudWorkflowIds()
onBeforeUnmount(() => {
  runPanelTeardown({
    releaseCoachCompletionWaiters: () => {
      releaseCoachCompletionWaiters(
        coachDeferredBy.value !== null && agentPanelStore.isVisible
      )
    },
    invalidateConsentHeldSubmission: () => {
      if (
        !sendHeldByCoach.value &&
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
    clearAgentTurnTabs: () => {
      tabActivity.setAgentTurnTabs([])
    },
    resetTurnTabResolver: () => {
      conversationStore.setTurnTabResolver(() => ({ status: 'unknown' }))
    },
    clearCreatingTab: () => {
      tabActivity.setCreating(false)
    },
    resetCanvasSyncGate: () => {
      conversationStore.setCanvasSyncGate(() => 'none')
    }
  })
})

const { copy } = useClipboard({ legacy: true })

// DES-1221. Read while the panel is on screen, so the experiment's denominator
// is the panel openers the hypothesis is about.
const { variant: freeUseVariant, reportNotice: onFreeUseNotice } =
  useFreeUsePlacement()
const {
  assignment: starterPromptAssignment,
  attributeExperiment: attributeStarterPromptExperiment,
  expose: exposeStarterPromptSet
} = useStarterPromptSet()

/**
 * `Try your first chat for free!` is a claim about the Agent's own granted
 * allowance, so it renders on `scoped_has_funds.agent` as received. `=== true`
 * is the whole gate: an absent field, an unsettled read and a rail that reports
 * no scoped balance all fail closed without a separate branch.
 */
const freeUseGrantActive = computed(
  () => subscription.value?.agentScopedHasFunds === true
)

const freeUsePlacement = computed(() =>
  !freeUseGrantActive.value || unresolvedPaywallPending.value
    ? 'control'
    : freeUseVariant.value
)

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

const { refreshHistory } = useAgentChatHistoryRefresh({
  listThreads: rest.listThreads,
  history,
  untitledChat: () => t('agent.untitledChat'),
  onFailure: (failure, uiTreatment) => {
    const error =
      failure.status === 'failed'
        ? failure.cause
        : new Error('Agent thread list ended before its last page')
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_thread_list_load_failed',
      tags:
        failure.status === 'incomplete' ? { reason: failure.reason } : undefined
    })
    if (uiTreatment === 'error_overlay')
      surfaceAgentError(
        'agent_api_failed',
        error instanceof Error ? error.message : String(error)
      )
    trackAgentError('thread_list_load_failed', 'pre_acceptance', uiTreatment, {
      retryable:
        failure.status === 'failed' && isRetryableRequestFailure(error, false)
    })
  }
})

const provisionalTitle = ref<string>()

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

const workflowChatFollow = useAgentWorkflowChatFollow({
  activeWorkflow: () => workflowStore.activeWorkflow,
  selectedTarget: () => selectedTarget.value,
  currentThreadId: () => threadId.value,
  sessions: () => history.sessions,
  followsVisibleWorkflow: () => agentPanelStore.followsVisibleWorkflow,
  hasDraft: () => composerStore.hasDraft,
  userEngaged,
  cloudIdFor,
  refreshCloudWorkflowIds,
  refreshHistory,
  loadThread,
  clearDraft: () => composerStore.setText(''),
  trackThreadStarted: () =>
    useTelemetry()?.trackAgentThreadStarted({ source: 'history_select' }),
  restoreThreadWorkflow,
  adoptWorkflowTarget,
  adoptRestoredWorkflowTab
})

const {
  failure: followFailure,
  openingWorkflowName,
  followTab,
  retireFollow,
  retryFollow: onRetryFollow
} = workflowChatFollow

watch(
  threadId,
  (id, previousId) => {
    if (
      id === null ||
      previousId !== null ||
      provisionalTitle.value === undefined
    )
      return
    if (!workflowChatFollow.isOpeningThread(id))
      history.rename(id, provisionalTitle.value)
    provisionalTitle.value = undefined
  },
  { immediate: true, flush: 'sync' }
)

function onOpenHistory(): void {
  retireFollow()
  void refreshHistory()
}

async function onSelectHistory(
  id: string,
  isCurrent: () => boolean
): Promise<boolean> {
  retireFollow()
  provisionalTitle.value = undefined
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

function userEngaged(): boolean {
  return composerStore.hasDraft || isSending.value || workflowSelecting.value
}

function restoreChatWorkflow(
  workflowId: string | undefined,
  isCurrent: () => boolean
): Promise<boolean> | boolean {
  return workflowChatFollow.restoreChatWorkflow(workflowId, isCurrent)
}

onBeforeUnmount(retireFollow)

watch(
  () => workflowStore.activeWorkflow,
  workflowChatFollow.activeWorkflowChanged
)

workflowStore.onUserActivation((workflow) => void followTab(workflow))

watch(userEngaged, workflowChatFollow.userEngagementChanged)

const mountedOn = workflowStore.activeWorkflow
if (
  mountedOn !== null &&
  selectedTarget.value !== null &&
  selectedTarget.value.path !== mountedOn.path
)
  void followTab(mountedOn)

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
  let coachReleased = false
  let acceptedIdentity: string | null = null
  consentHeldSubmissionId = submissionId
  try {
    await withConsent('first_message', () => {
      hasConsent = true
      acceptedIdentity = consentIdentity.value
    })
    if (hasConsent) coachReleased = await waitForCoachCompletion()
  } finally {
    if (consentHeldSubmissionId === submissionId)
      consentHeldSubmissionId = undefined
  }
  return (
    composerStore.submission?.id === submissionId &&
    hasConsent &&
    coachReleased &&
    consentAccepted.value &&
    consentIdentity.value === acceptedIdentity
  )
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
    if (
      !agentPanelStore.onboarding.introduceBeforeSignIn &&
      !hasAgentCredential() &&
      !(await ensureSignedIn())
    )
      return false
    const submissionId = composerStore.submission?.id
    if (
      !consentAccepted.value &&
      !(await consentAllowsSubmission(submissionId))
    )
      return false
    if (!hasAgentCredential()) {
      const identityBeforeSignIn = consentIdentity.value
      if (!(await ensureSignedIn())) return false
      if (
        composerStore.submission?.id !== submissionId ||
        !consentAccepted.value ||
        consentIdentity.value !== identityBeforeSignIn
      )
        return false
    }

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
      return await sendWithFundsRecheck((onAccepted) =>
        sendMessage(
          text,
          attachments,
          nodes,
          references,
          () => (selectionWorkflow ? cloudIdFor(selectionWorkflow) : undefined),
          // The same id reported on app:agent_message_sent just above. Sent to
          // the server so it can echo it onto agent_turn_started, which is what
          // makes the message -> turn step attributable instead of only
          // countable.
          meta.clientMessageId,
          onAccepted
        )
      )
    } finally {
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
  if (threadId.value === null) provisionalTitle.value = title
  else history.rename(threadId.value, title)
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
  retireFollow()
  provisionalTitle.value = undefined
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
const { flags } = useFeatureFlags()

const attachment = useAttachment({
  validate: isValidAgentAttachment,
  upload: async (file, signal) => {
    const uploaded = await rest.uploadImage(file, file.name, signal)
    const filename = uploaded.name ?? file.name
    return {
      ref: filename,
      url: isHdrImageFilename(file.name)
        ? undefined
        : api.apiURL(
            `/view?filename=${encodeURIComponent(filename)}&type=input`
          )
    }
  },
  resolveStoredPreview: async (file, ref) =>
    isHdrImageFilename(file.name)
      ? ((await findServerPreviewUrl(ref)) ?? undefined)
      : undefined,
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
  maxBytes: () => flags.maxUploadSize ?? MAX_ATTACHMENT_BYTES,
  onError: warnAttachment,
  onDuplicate: notifyDuplicateAttachments,
  staged: () => composerStore.attachments,
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

function warnAttachment(message: string): void {
  toast.warning(message, { duration: 5000 })
}

function droppedAssetVerdict(asset: DroppedAsset): AgentAttachVerdict {
  const fromRef = asset.ref ? agentAttachRefVerdict(asset.ref) : 'unknown'
  return fromRef === 'unknown' ? agentAttachVerdict(asset.name) : fromRef
}

function stageAcceptedAssetCard(
  asset: DroppedAsset,
  ref: string,
  sourceKey: string
): boolean {
  if (composerStore.attachments.some((item) => item.ref === ref)) {
    notifyDuplicateAttachments([asset.name])
    return false
  }
  if (composerStore.attachments.length >= MAX_TURN_ATTACHMENTS) {
    warnAttachment(
      t('agent.attachmentCountExceeded', { count: MAX_TURN_ATTACHMENTS })
    )
    return false
  }
  const added = composerStore.addAttachment({
    id: `asset:${crypto.randomUUID()}`,
    name: asset.name,
    ref,
    sourceKey,
    previewUrl: asset.previewUrl,
    mediaUrl: asset.mediaUrl,
    mediaKind: asset.kind
  })
  if (!added) notifyDuplicateAttachments([asset.name])
  return added
}

async function attachDroppedAsset(event: DragEvent): Promise<boolean> {
  const asset = event.dataTransfer && getDroppedAsset(event.dataTransfer)
  if (!asset) {
    warnAttachment(t('agent.assetNotAttachable'))
    return false
  }

  const sourceKey = asset.ref ? `asset:${asset.ref}` : `uri:${asset.uri}`
  if (droppedAssetVerdict(asset) === 'rejected') {
    attachment.addUnsupportedAsset(asset.name, sourceKey)
    return false
  }
  if (asset.ref && asset.kind !== 'other') {
    return stageAcceptedAssetCard(asset, asset.ref, sourceKey)
  }

  const result = await attachment.addDeferredFile(
    asset.name,
    (signal) => fetchDroppedAsset(asset, { signal, nameFromSource: true }),
    sourceKey
  )
  if (result === 'fetch_failed')
    warnAttachment(t('agent.assetFetchFailed', { name: asset.name }))
  return result === 'uploaded'
}

function onPanelDragOver(event: DragEvent): void {
  if (isAttachableDrag(event)) event.preventDefault()
}

async function onPanelDrop(event: DragEvent): Promise<void> {
  clearAssetDrag()
  if ((event.dataTransfer?.files.length ?? 0) === 0 && isAssetDrag(event)) {
    event.preventDefault()
    void attachDroppedAsset(event).then((attached) => {
      if (attached)
        useTelemetry()?.trackAgentAttachButtonClicked({ method: 'drag_drop' })
    })
    return
  }
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length === 0) return
  event.preventDefault()
  if (await attachment.addFiles(files))
    useTelemetry()?.trackAgentAttachButtonClicked({ method: 'drag_drop' })
}

const agentPanelRenderStore = useAgentPanelRenderStore()
onMounted(() => agentPanelRenderStore.reach('drawn'))
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
      :opening-workflow-name="openingWorkflowName"
      :session-id="threadId"
      :custom-title="
        history.titleFor(threadId) ??
        historyGroups.current.find((session) => session.id === threadId)
          ?.title ??
        provisionalTitle
      "
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
      :canvas-empty-after-turn="canvasEmptyAfterTurn"
      :get-mention-nodes="mentionableNodes"
      :paywall-presentation="paywallPresentation"
      :credits-exhausted="showStandingPaywall"
      :sync-retry-available="
        crdtStatus.terminal === 'retry_exhausted' ||
        crdtStatus.terminal === 'timeout'
      "
      :free-use-placement="freeUsePlacement"
      :starter-prompt-assignment="starterPromptAssignment"
      :attribute-starter-prompt-experiment="attributeStarterPromptExperiment"
      @starter-prompt-rendered="exposeStarterPromptSet"
      @free-use-notice="onFreeUseNotice"
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
      @attach-files="onAttachFiles"
      @remove-attachment="attachment.cancelUpload"
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
      @retry-sync="retrySubscription"
      @new-chat="onNewChat('new_chat_button')"
      @start-tour="restartCoach"
      @toggle-size="agentPanelStore.toggleMaximize()"
      @close="onClosePanel"
      @open-history="onOpenHistory"
      @delete-history="onDeleteHistory"
      @rename-history="onRenameHistory"
      @rename-chat="onRenameChat"
      @copy-history="onCopyMarkdown"
    >
      <template v-if="isCrdtDevPanelEnabled" #instrument>
        <CrdtDevPanel :status="crdtStatus" :snapshot="crdtDebugSnapshot" />
      </template>
      <template #composerNotice>
        <RunNoticeBanner
          v-if="followFailure"
          context="followFailed"
          :workflow-name="followFailure.filename"
          @retry="onRetryFollow"
        />
        <AgentCreditTransitionNotice
          v-if="showCreditTransitionNotice"
          data-testid="agent-credit-transition-notice"
          @shown="onCreditTransitionNoticeShown"
          @dismiss="onDismissCreditTransitionNotice"
        />
      </template>
    </AgentPanel>
    <div
      v-if="assetDragActive"
      role="status"
      class="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-secondary/90 p-4 font-inter text-sm/5 text-foreground"
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
      :hold-notice="sendHeldByCoach ? t('agent.coachHoldNotice') : undefined"
      @finished="releaseCoachCompletionWaiters"
      @stalled="releaseCoachCompletionWaiters"
    />
  </div>
</template>
