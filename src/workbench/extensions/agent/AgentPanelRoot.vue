<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

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
import { createReconnectingEventSource } from './services/agent/agentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

const { t } = useI18n()
const toast = useToastStore()
const workspaceAuthStore = useWorkspaceAuthStore()

const { userDisplayName } = useCurrentUser()
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

const rest = createAgentRestClient({
  getAuthToken: () => workspaceAuthStore.workspaceToken ?? undefined
})

// Follows api.socket across reconnects (the api nulls and replaces its socket on
// close/reopen) so the panel is not left deaf after a reconnect.
const events = createReconnectingEventSource(api)

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

// Bind only when the server confirmed the id we sent for that tab; a freshly
// minted id stays unbound so its first patch opens (and binds) its own tab.
function onWorkflowAdopted(
  workflowId: string,
  sent: WorkflowTurnContext | undefined
): void {
  if (sent !== undefined && sent.id === workflowId)
    bindingStore.bind(workflowId, sent.tabPath)
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
    adopted: onWorkflowAdopted
  }
})

const noticeSeverity = {
  error: 'error',
  warning: 'warn',
  info: 'info'
} as const
let noticesSeen = 0
watch(
  () => notices.value.length,
  (length) => {
    for (const notice of notices.value.slice(noticesSeen)) {
      toast.add({
        severity: noticeSeverity[notice.level],
        summary: notice.text
      })
    }
    noticesSeen = length
  }
)

// The draft rides the wire untyped; validate through the host schema. A failed
// apply is a workflow error, surfaced via the host overlay once per failure streak.
const executionErrorStore = useExecutionErrorStore()
let draftRejectionNotified = false

function surfaceDraftApplyFailure(details: string): void {
  console.warn(details)
  if (draftRejectionNotified) return
  draftRejectionNotified = true
  executionErrorStore.lastPromptError = {
    type: 'agent_draft_apply_failed',
    message: t('errorCatalog.promptErrors.agent_draft_apply_failed.desc'),
    details
  }
  executionErrorStore.showErrorOverlay()
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
    if (tab === null) {
      const opened = workflowStore.openWorkflows.find(
        (w) => !openBefore.has(w.path)
      )
      if (opened) bindingStore.bind(workflowId, opened.path)
      return
    }
    // The canvas now equals the agent draft; clear the stale user-edit flag so
    // the next patch is not misread as a divergence.
    tab.isModified = false
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
    // The server's freshly minted draft starts empty; conjuring a blank tab
    // for it only confuses. Park until a patch carries actual nodes.
    const nodes = (content as { nodes?: unknown }).nodes
    if (!Array.isArray(nodes) || nodes.length === 0) return
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
  useTelemetry()?.trackAgentMessageFeedback({ message_id: turnId, vote })
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
    console.warn('[agent] listThreads failed:', error)
  }
}

watch(threadId, (id) => history.setActive(id), { immediate: true })

void refreshHistory()

async function onSelectHistory(id: string): Promise<void> {
  await loadThread(id)
  void refreshHistory()
}

// Only the active in-memory conversation has a transcript; a non-active id has nothing
// to serialize and gets an info toast instead.
function onCopyMarkdown(id: string): void {
  if (id === history.activeId) void copy(buildTranscriptMarkdown(entries.value))
  else toast.add({ severity: 'info', summary: t('agent.copyUnavailable') })
}

const coachSteps: CoachStep[] = [
  {
    target: '#agent-panel-root',
    title: t('agent.coachTitle'),
    body: t('agent.coachBody')
  }
]

// The agent's server-side draft never mirrors the live canvas, so a tagged
// node travels with its serialized definition (dropped if it left the graph).
function tagsWithNodeData(tags: SelectedNode[]) {
  return tags.map((tag) => ({
    ...tag,
    data: viewedGraphNodes()
      .find((node) => String(node.id) === tag.id)
      ?.serialize()
  }))
}

function onSend(text: string, attachments: ComposerAttachment[]): void {
  // A new turn re-arms applies AND replays the draft a 'Keep mine' parked —
  // its version may never advance, so the version watch alone cannot re-drive.
  applySuppressed = false
  void applyDraft()
  void sendMessage(text, attachments, tagsWithNodeData(consumeSelection()))
}

function onStop(): void {
  void stopTurn()
}

function onNewChat(): void {
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
  onError: (message) => toast.add({ severity: 'error', summary: message }),
  stage: (staged) => panelRef.value?.addAttachment(staged),
  update: (id, patch) => panelRef.value?.updateAttachment(id, patch),
  remove: (id) => panelRef.value?.removeAttachment(id)
})

function onAttach(): void {
  fileInput.value?.click()
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
      @mention-pick="addSelectionTag"
      @resolve-conflict="onResolveConflict"
      @feedback="onFeedback"
      @new-chat="onNewChat"
      @toggle-size="agentPanelStore.toggleMaximize()"
      @close="agentPanelStore.close()"
      @open-history="refreshHistory()"
      @select-history="onSelectHistory"
      @delete-history="history.remove($event)"
      @copy-history="onCopyMarkdown"
    />
    <OnboardingCoach
      :steps="coachSteps"
      storage-key="Comfy.AgentPanel.onboarded"
    />
  </div>
</template>
