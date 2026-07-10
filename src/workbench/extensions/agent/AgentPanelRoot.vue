<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'

import AgentPanel from './components/agent/AgentPanel.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import type { ConflictChoice } from './components/agent/safety/safetyTypes'
import { useAttachment } from './composables/agent/useAttachment'
import type { ActiveTab } from './components/agent/ActiveTabStrip.vue'
import type { SelectedNode } from './composables/agent/useCanvasSelection'
import { useCanvasSelection } from './composables/agent/useCanvasSelection'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import type { AgentThreadSummary } from './schemas/agentApiSchema'
import type { ChatSession } from './stores/agent/agentChatHistoryStore'
import type { WorkflowTurnContext } from './composables/agent/useAgentSession'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useDraftCanvasApply } from './composables/agent/useDraftCanvasApply'
import { useAgentDraftStore } from './stores/agent/agentDraftStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'
import { buildTranscriptMarkdown } from './services/agent/agentTranscript'
import { createAgentRestClient } from './services/agent/agentRestClient'
import type { WorkflowUpload } from './services/agent/agentRestClient'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

const { t } = useI18n()
const toast = useToastStore()

const { userDisplayName } = useCurrentUser()
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

const rest = createAgentRestClient()

// Rides the api's own typed /ws dispatch (which survives socket reconnects), so the
// panel is not left deaf after a reconnect and each frame is JSON-parsed only once.
const events = createAgentEventSource(api)

const workflowStore = useWorkflowStore()
const bindingStore = useAgentWorkflowTabBindingStore()
const draftStore = useAgentDraftStore()
const agentPanelStore = useAgentPanelStore()

// B7 @-tagging: selected nodes stage removable chips; consume() on send clears
// them and the same selection does not re-tag until it changes.
const canvasStore = useCanvasStore()
const selectedNodes = computed<SelectedNode[]>(() =>
  canvasStore.selectedItems.filter(isLGraphNode).map((node) => ({
    id: String(node.id),
    title: node.title || node.type
  }))
)
const {
  staged: selectionTags,
  consume: consumeSelection,
  remove: removeSelectionTag,
  add: addSelectionTag
} = useCanvasSelection({
  selection: selectedNodes,
  isLive: () => agentPanelStore.isOpen
})

// The graph the canvas is showing (root or an open subgraph); the deprecated
// app.graph getter only ever returns root, which misses subgraph-inner nodes.
function viewedGraphNodes() {
  return app.canvas?.graph?.nodes ?? app.graph?.nodes ?? []
}

// The @ picker lists the viewed graph's nodes, computed on open (not watched).
function mentionableNodes(): SelectedNode[] {
  return viewedGraphNodes().map((node) => ({
    id: String(node.id),
    title: node.title || node.type
  }))
}

// A bound tab resolves to its id; a cloud-saved tab offers its persisted uuid
// speculatively (the server 403s foreign ids and the send retries without).
function activeWorkflowTurnContext(): WorkflowTurnContext | undefined {
  const active = workflowStore.activeWorkflow
  if (!active) return undefined
  const bound = bindingStore.workflowIdFor(active.path)
  if (bound !== undefined)
    return { id: bound, speculative: false, tabPath: active.path }
  const savedId = active.activeState?.id
  return typeof savedId === 'string'
    ? { id: savedId, speculative: true, tabPath: active.path }
    : undefined
}

// B17/Jo QA: the panel names the tab the agent acts on.
const activeTab = computed<ActiveTab | null>(() => {
  const active = workflowStore.activeWorkflow
  return active ? { name: active.filename } : null
})

// The turn runs against the canvas as of the send: upload the serialized
// graph when it changed since the last upload so the server can seed the
// thread's draft from it (cloud postMessage.workflow contract; servers
// without the field ignore it). Oversized graphs are skipped, matching the
// server's 413 limit.
const MAX_UPLOAD_CHARS = 2_000_000
let lastSentGraph: string | null = null
let snapshotTabPath: string | null = null

function takeWorkflowSnapshot(): WorkflowUpload | undefined {
  const graph = app.graph?.serialize()
  if (!graph) return undefined
  const serialized = JSON.stringify(graph)
  if (serialized === lastSentGraph || serialized.length > MAX_UPLOAD_CHARS)
    return undefined
  lastSentGraph = serialized
  snapshotTabPath = workflowStore.activeWorkflow?.path ?? null
  return { graph, last_seen_version: draftStore.version }
}

// A fresh thread gets a fresh draft on the server: re-upload on next send.
function resetSnapshotGuard(): void {
  lastSentGraph = null
  snapshotTabPath = null
}

// Bind when the server confirmed the id we sent for that tab, or when the
// send uploaded this tab's canvas: the draft then mirrors the tab, so even a
// freshly minted id applies in place instead of opening a new tab.
function onWorkflowAdopted(
  workflowId: string,
  sent: WorkflowTurnContext | undefined,
  uploaded: boolean
): void {
  if (sent !== undefined && sent.id === workflowId) {
    bindingStore.bind(workflowId, sent.tabPath)
    return
  }
  if (uploaded && snapshotTabPath !== null)
    bindingStore.bind(workflowId, snapshotTabPath)
}

const {
  sendMessage,
  stopTurn,
  newChat,
  start,
  stop,
  entries,
  isStreaming,
  status,
  notices,
  threadId,
  listThreads,
  loadThread
} = useAgentSession({
  rest,
  events,
  workflow: {
    current: activeWorkflowTurnContext,
    adopted: onWorkflowAdopted,
    snapshot: takeWorkflowSnapshot
  }
})

// Every agent error goes through the ONE existing host error modal — no
// bespoke toasts.
const executionErrorStore = useExecutionErrorStore()

function surfaceAgentError(
  type: 'agent_api_failed' | 'agent_draft_apply_failed',
  details: string
): void {
  executionErrorStore.lastPromptError = {
    type,
    message: t(`errorCatalog.promptErrors.${type}.desc`),
    details
  }
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

// The draft rides the wire untyped; validate through the host schema. A failed
// apply is a workflow error, surfaced once per failure streak.
let draftRejectionNotified = false

function surfaceDraftApplyFailure(details: string): void {
  console.warn(details)
  if (draftRejectionNotified) return
  draftRejectionNotified = true
  surfaceAgentError('agent_draft_apply_failed', details)
}

// B16 graph write: patches route to their workflow_id's bound tab — in place when
// active, lazily on refocus, via the conflict dialog when the user edited the tab.
const conflictOpen = ref(false)
// 'Keep mine' parks the draft until the user's next turn re-arms applies.
let applySuppressed = false
let lastApplied: { workflowId: string; version: number } | null = null
let applying = false
let reapplyQueued = false

function boundTabFor(workflowId: string): ComfyWorkflow | null {
  const path = bindingStore.tabPathFor(workflowId)
  return path === undefined ? null : workflowStore.getWorkflowByPath(path)
}

// Agent writes autosave: re-baseline the tracker to the canvas as loaded (a
// minted tab's stored baseline carries an id the canvas never adopts, so the
// next capture would flip isModified and every following patch would raise
// the conflict dialog). The baseline must be the RAW serialization, not the
// schema-normalized form: captures compare raw serialize() output via strict
// graphEqual, so a normalized baseline would re-flip isModified unedited.
function autosaveAppliedDraft(tab: ComfyWorkflow): void {
  const canvasState = app.graph?.serialize()
  if (!canvasState) return
  tab.changeTracker?.reset(canvasState as unknown as ComfyWorkflowJSON)
  tab.isModified = false
}

async function loadDraft(
  workflowId: string,
  version: number,
  content: Record<string, unknown>,
  tab: ComfyWorkflow | null
): Promise<void> {
  const workflow = await validateComfyWorkflow(content, (error) => {
    surfaceDraftApplyFailure(error)
  })
  if (!workflow) return
  // A user tab-switch mid-load must not misbind: identify the minted tab by
  // diffing the open set rather than trusting post-await focus.
  const openBefore = new Set(workflowStore.openWorkflows.map((w) => w.path))
  try {
    await app.loadGraphData(workflow, true, true, tab)
    draftRejectionNotified = false
    lastApplied = { workflowId, version }
    useTelemetry()?.trackAgentWorkflowApplied({
      workflow_id: workflowId,
      target: tab === null ? 'new_tab' : 'existing_tab'
    })
    if (tab === null) {
      const opened = workflowStore.openWorkflows.find(
        (w) => !openBefore.has(w.path)
      )
      if (opened) {
        bindingStore.bind(workflowId, opened.path)
        autosaveAppliedDraft(opened)
      }
      return
    }
    autosaveAppliedDraft(tab)
  } catch (error) {
    surfaceDraftApplyFailure(
      error instanceof Error ? error.message : String(error)
    )
  }
}

async function applyDraft(): Promise<void> {
  // Patches stream faster than loadGraphData settles; serialize applies and
  // coalesce whatever arrived meanwhile into one trailing re-run.
  if (applying) {
    reapplyQueued = true
    return
  }
  applying = true
  try {
    const workflowId = draftStore.workflowId
    const version = draftStore.version
    const content = draftStore.content
    if (workflowId === null || version === null || content === null) return
    if (applySuppressed) return
    if (
      lastApplied !== null &&
      lastApplied.workflowId === workflowId &&
      lastApplied.version >= version
    )
      return
    // An agent draft with no nodes is noise (the server's freshly minted
    // draft starts empty): applying it would blank a bound tab or conjure an
    // empty one. Park until a patch carries actual nodes.
    const nodes = (content as { nodes?: unknown }).nodes
    if (!Array.isArray(nodes) || nodes.length === 0) return
    const boundTab = boundTabFor(workflowId)
    if (boundTab) {
      if (workflowStore.activeWorkflow?.path !== boundTab.path) return
      if (boundTab.isModified) {
        conflictOpen.value = true
        return
      }
      await loadDraft(workflowId, version, content, boundTab)
      return
    }
    await loadDraft(workflowId, version, content, null)
  } finally {
    applying = false
    if (reapplyQueued) {
      reapplyQueued = false
      void applyDraft()
    }
  }
}

useDraftCanvasApply(() => void applyDraft())
// A patch parked while its tab was backgrounded applies when the tab refocuses.
watch(
  () => workflowStore.activeWorkflow?.path,
  () => void applyDraft()
)
// A rebind opens a new epoch: guards scoped to the old workflow must not leak
// into it (a parked 'mine', a stale lastApplied, an open dialog).
watch(
  () => draftStore.workflowId,
  () => {
    lastApplied = null
    applySuppressed = false
    conflictOpen.value = false
  }
)

function onResolveConflict(choice: ConflictChoice): void {
  conflictOpen.value = false
  const workflowId = draftStore.workflowId
  const version = draftStore.version
  const content = draftStore.content
  if (workflowId === null || version === null || content === null) return
  if (choice === 'cancel') {
    applySuppressed = true
    return
  }
  if (choice === 'mine') {
    // Decided: this draft version stays off the canvas; only a NEWER agent
    // edit asks again.
    lastApplied = { workflowId, version }
    return
  }
  // 'agent' overwrites the bound tab; 'newtab' leaves it with the user's state
  // and rebinds the workflow to a fresh tab, where future patches follow.
  void loadDraft(
    workflowId,
    version,
    content,
    choice === 'agent' ? boundTabFor(workflowId) : null
  )
}

start()
onBeforeUnmount(() => {
  // Cancel any in-flight turn so it does not keep generating and billing while the panel
  // is closed; unsubscribe only after the cancel settles so its ack is not torn down.
  void stopTurn().finally(stop)
})

const history = useAgentChatHistoryStore()

const { copy } = useClipboard({ legacy: true })

// A null vote is a retraction of a prior thumb and is forwarded so the eval pipeline
// records it rather than dropping it.
function onFeedback(turnId: string, vote: 'up' | 'down' | null): void {
  useTelemetry()?.trackAgentMessageFeedback({
    message_id: turnId,
    vote,
    workflow_id: draftStore.workflowId
  })
}

// title is "" until the server names the thread, so the row falls back to the preview
// (the first prompt).
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
  resetSnapshotGuard()
  await loadThread(id)
  void refreshHistory()
}

// Only the active in-memory conversation has a transcript; a non-active id has nothing
// to serialize and gets an info toast instead.
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
  // A new turn re-arms applies AND replays the draft a 'Keep mine' parked —
  // its version may never advance, so the version watch alone cannot re-drive.
  applySuppressed = false
  void applyDraft()
  const nodeTags = consumeSelection()
  useTelemetry()?.trackAgentMessageSent({
    attachment_count: attachments.length,
    node_tag_count: nodeTags.length
  })
  void sendMessage(text, attachments, nodeTags).then((ok) => {
    // A failed send consumed the snapshot guard without reaching the
    // server; drop it so the next send re-uploads.
    if (!ok) resetSnapshotGuard()
  })
}

function onStop(): void {
  void stopTurn()
}

function onNewChat(): void {
  resetSnapshotGuard()
  newChat()
}

// uploadImage answers {name, subfolder, type}; the send path forwards `name` as the
// LoadImage-style ref.
const panelRef = ref<InstanceType<typeof AgentPanel>>()
const fileInput = ref<HTMLInputElement>()

const attachment = useAttachment({
  upload: async (file) => ({
    ref: (await rest.uploadImage(file, file.name)).name
  }),
  onError: (message) => surfaceAgentError('agent_api_failed', message),
  stage: (staged) => panelRef.value?.addAttachment(staged),
  update: (id, patch) => panelRef.value?.updateAttachment(id, patch),
  remove: (id) => panelRef.value?.removeAttachment(id)
})

function onAttach(): void {
  useTelemetry()?.trackAgentAttachButtonClicked()
  fileInput.value?.click()
}

function onMentionPick(node: SelectedNode): void {
  const stagedBefore = selectionTags.value.length
  addSelectionTag(node)
  if (selectionTags.value.length > stagedBefore)
    useTelemetry()?.trackAgentNodeTagged({ source: 'mention_picker' })
}

function onClosePanel(): void {
  useTelemetry()?.trackAgentCloseButtonClicked()
  agentPanelStore.close('close_button')
}

async function onFilesPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) await attachment.addFiles(Array.from(files))
  // Clear so re-picking the same file fires change again.
  input.value = ''
}
</script>

<template>
  <div id="agent-panel-root" class="size-full">
    <input
      ref="fileInput"
      type="file"
      accept="image/*,video/*"
      multiple
      class="hidden"
      data-testid="agent-file-input"
      @change="onFilesPicked"
    />
    <AgentPanel
      ref="panelRef"
      :entries
      :user-name="userName"
      :streaming="isStreaming"
      :submitting="status === 'thinking'"
      :can-attach="true"
      :is-maximized="agentPanelStore.isMaximized"
      :history-groups="history.grouped"
      :selection-tags="selectionTags"
      :active-tab="activeTab"
      :conflict-open="conflictOpen"
      :get-mention-nodes="mentionableNodes"
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
      @remove-tag="removeSelectionTag"
      @mention-pick="onMentionPick"
      @resolve-conflict="onResolveConflict"
      @feedback="onFeedback"
      @new-chat="onNewChat"
      @toggle-size="agentPanelStore.toggleMaximize()"
      @close="onClosePanel"
      @open-history="refreshHistory()"
      @select-history="onSelectHistory"
      @delete-history="history.remove($event)"
      @copy-history="onCopyMarkdown"
    />
    <OnboardingCoach
      :step="coachStep"
      storage-key="Comfy.AgentPanel.onboarded"
    />
  </div>
</template>
