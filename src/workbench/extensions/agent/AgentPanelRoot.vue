<script setup lang="ts">
import './agentPanel.css'

import { useClipboard } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { appendWorkflowJsonExt } from '@/utils/formatUtil'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'

import AgentPanel from './components/agent/AgentPanel.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import type { ConflictChoice } from './components/agent/safety/ConflictDialog.vue'
import { useAttachment } from './composables/agent/useAttachment'
import type { ActiveTab } from './components/agent/ActiveTabStrip.vue'
import type { SelectedNode } from './composables/agent/useCanvasSelection'
import { useCanvasSelection } from './composables/agent/useCanvasSelection'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import type {
  AgentActiveTabData,
  AgentDraftSnapshot,
  AgentThreadSummary
} from './schemas/agentApiSchema'
import type { ChatSession } from './stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from './stores/agent/agentConversationStore'
import type { WorkflowTurnContext } from './composables/agent/useAgentSession'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useAgentDraftStore } from './stores/agent/agentDraftStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'
import {
  AgentApiError,
  createAgentRestClient
} from './services/agent/agentRestClient'
import type {
  DraftUpload,
  OpenTabsSnapshot
} from './services/agent/agentRestClient'
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

const events = createAgentEventSource(api)

const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const bindingStore = useAgentWorkflowTabBindingStore()
const draftStore = useAgentDraftStore()
const agentPanelStore = useAgentPanelStore()

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

function viewedGraphNodes() {
  return app.canvas?.graph?.nodes ?? app.graph?.nodes ?? []
}

function mentionableNodes(): SelectedNode[] {
  return viewedGraphNodes().map((node) => ({
    id: String(node.id),
    title: node.title || node.type
  }))
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
    console.warn('[agent] could not refresh cloud workflow ids', error)
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

let lastKnownGraph: { serialized: string; workflowId: string } | null = null

function reclaimMovedBinding(activePath: string): string | undefined {
  if (lastKnownGraph === null) return undefined
  const graph = app.graph?.serialize()
  if (!graph || JSON.stringify(graph) !== lastKnownGraph.serialized)
    return undefined
  const { workflowId } = lastKnownGraph
  bindingStore.bind(workflowId, activePath)
  lastKnownGraph = null
  return workflowId
}

function activeWorkflowTurnContext(): WorkflowTurnContext | undefined {
  const active = workflowStore.activeWorkflow
  if (!active) return undefined
  const bound = cloudIdFor(active) ?? reclaimMovedBinding(active.path)
  return bound === undefined ? undefined : { id: bound, tabPath: active.path }
}

const activeTab = computed<ActiveTab | null>(() => {
  const active = workflowStore.activeWorkflow
  return active ? { path: active.path, name: active.filename } : null
})

const workflowTabs = computed<ActiveTab[]>(() =>
  workflowStore.openWorkflows.map((tab) => ({
    path: tab.path,
    name: tab.filename
  }))
)

async function onSelectTab(path: string): Promise<void> {
  const tab = workflowStore.getWorkflowByPath(path)
  if (tab) await workflowService.openWorkflow(tab)
}

let lastSentGraph: string | null = null
let snapshotTabPath: string | null = null

function takeWorkflowSnapshot(): DraftUpload | undefined {
  const graph = app.graph?.serialize()
  if (!graph?.nodes?.length) return undefined
  const serialized = JSON.stringify(graph)
  const activePath = workflowStore.activeWorkflow?.path ?? null
  if (serialized === lastSentGraph && activePath === snapshotTabPath)
    return undefined
  lastSentGraph = serialized
  snapshotTabPath = activePath
  return { content: graph, version: draftStore.version }
}

function resetSnapshotGuard(): void {
  lastSentGraph = null
  snapshotTabPath = null
  lastKnownGraph = null
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
    current_tab: active ? cloudIdFor(active) : undefined
  }
}

function onWorkflowAdopted(
  workflowId: string,
  sent: WorkflowTurnContext | undefined,
  uploaded: boolean
): void {
  if (uploaded && lastSentGraph !== null)
    lastKnownGraph = { serialized: lastSentGraph, workflowId }
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
    prepare: refreshCloudWorkflowIds,
    snapshot: takeWorkflowSnapshot,
    uploadSkipped: resetSnapshotGuard,
    tabs: openTabsSnapshot,
    activeTab: enqueueActiveTab
  }
})

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

let draftRejectionNotified = false

function surfaceDraftApplyFailure(details: string): void {
  console.warn(details)
  if (draftRejectionNotified) return
  draftRejectionNotified = true
  surfaceAgentError('agent_draft_apply_failed', details)
}

const conflictOpen = ref(false)
let applySuppressed = false
let lastApplied: { workflowId: string; version: number } | null = null
let applying = false
let reapplyQueued = false

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

function unusedFilenameFor(tab: ComfyWorkflow): string {
  const takenByOther = (filename: string) => {
    const path =
      tab.directory +
      '/' +
      appendWorkflowJsonExt(filename, tab.initialMode === 'app')
    return path !== tab.path && workflowStore.getWorkflowByPath(path) !== null
  }
  if (!takenByOther(tab.filename)) return tab.filename
  let counter = 2
  while (takenByOther(`${tab.filename} (${counter})`)) counter++
  return `${tab.filename} (${counter})`
}

async function autosaveAppliedDraft(
  workflowId: string,
  tab: ComfyWorkflow
): Promise<void> {
  try {
    const saved = tab.isTemporary
      ? await workflowService.saveWorkflowAs(tab, {
          filename: unusedFilenameFor(tab)
        })
      : await workflowService.saveWorkflow(tab)
    if (!saved) console.error(`Agent draft autosave failed for ${tab.path}`)
  } catch (error) {
    console.error(`Agent draft autosave failed for ${tab.path}:`, error)
  } finally {
    bindingStore.bind(workflowId, tab.path)
  }
}

let activeTabGeneration = 0
let activeTabChain: Promise<void> = Promise.resolve()
const lastRenderedVersions = new Map<string, number>()

function enqueueActiveTab(data: AgentActiveTabData): void {
  const generation = ++activeTabGeneration
  activeTabChain = activeTabChain.then(() => onAgentActiveTab(data, generation))
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

async function fetchDraftSnapshot(
  workflowId: string
): Promise<AgentDraftSnapshot | null> {
  try {
    return await rest.getDraft(workflowId)
  } catch (error) {
    if (error instanceof AgentApiError && error.status === 404) return null
    throw error
  }
}

function recordRenderedVersion(nextWorkflowId: string): void {
  const leaving = draftStore.workflowId
  if (leaving === null || leaving === nextWorkflowId) return
  if (lastApplied?.workflowId === leaving)
    lastRenderedVersions.set(leaving, lastApplied.version)
  else lastRenderedVersions.delete(leaving)
}

async function adoptDraftBase(
  workflowId: string,
  snapshot: AgentDraftSnapshot,
  armVersion: number = snapshot.version
): Promise<void> {
  draftStore.bind(workflowId)
  await nextTick()
  if (
    !(
      lastApplied?.workflowId === workflowId && lastApplied.version > armVersion
    )
  )
    lastApplied = { workflowId, version: armVersion }
  draftStore.adoptSnapshot(snapshot)
}

async function onAgentActiveTab(
  data: AgentActiveTabData,
  generation: number
): Promise<void> {
  const stale = () => generation !== activeTabGeneration
  if (stale()) return
  try {
    recordRenderedVersion(data.workflow_id)
    const bound = boundTabFor(data.workflow_id)
    if (bound) {
      const alreadyCurrent =
        draftStore.workflowId === data.workflow_id &&
        draftStore.version !== null
      await workflowService.openWorkflow(bound)
      if (stale()) return
      draftStore.bind(data.workflow_id)
      const snapshot = await fetchDraftSnapshot(data.workflow_id)
      if (stale()) return
      if (
        snapshot !== null &&
        !(alreadyCurrent && (draftStore.version ?? -1) >= snapshot.version)
      )
        await adoptDraftBase(
          data.workflow_id,
          snapshot,
          lastRenderedVersions.get(data.workflow_id) ?? -1
        )
      useTelemetry()?.trackAgentWorkflowApplied({
        workflow_id: data.workflow_id,
        target: 'active_tab_switch'
      })
      return
    }
    const snapshot = await fetchDraftSnapshot(data.workflow_id)
    if (stale()) return
    let validationError = ''
    const workflow =
      snapshot === null
        ? null
        : await validateComfyWorkflow(snapshot.content, (error) => {
            validationError = error
          })
    if (stale()) return
    if (snapshot !== null && !workflow) {
      surfaceDraftApplyFailure(validationError)
      draftStore.bind(data.workflow_id)
      return
    }
    const tab = workflowStore.createTemporary(
      agentTabFilename(data.name),
      workflow ?? undefined
    )
    await workflowService.openWorkflow(tab)
    if (stale()) return
    await autosaveAppliedDraft(data.workflow_id, tab)
    if (stale()) return
    if (snapshot === null) draftStore.bind(data.workflow_id)
    else await adoptDraftBase(data.workflow_id, snapshot)
    useTelemetry()?.trackAgentWorkflowApplied({
      workflow_id: data.workflow_id,
      target: 'active_tab_open'
    })
  } catch (error) {
    if (stale()) return
    draftStore.bind(data.workflow_id)
    surfaceAgentError(
      'agent_api_failed',
      error instanceof Error ? error.message : String(error)
    )
  }
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
  const openBefore = new Set(workflowStore.openWorkflows.map((w) => w.path))
  try {
    await app.loadGraphData(workflow, true, true, tab)
    draftRejectionNotified = false
    lastApplied = { workflowId, version }
    const rendered = app.graph?.serialize()
    if (rendered)
      lastKnownGraph = { serialized: JSON.stringify(rendered), workflowId }
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
        await autosaveAppliedDraft(workflowId, opened)
      }
      return
    }
    await autosaveAppliedDraft(workflowId, tab)
  } catch (error) {
    surfaceDraftApplyFailure(
      error instanceof Error ? error.message : String(error)
    )
  }
}

async function applyDraft(): Promise<void> {
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

watch(
  () => draftStore.version,
  (version) => {
    if (version === null || draftStore.content === null) return
    void applyDraft()
  }
)
watch(
  () => workflowStore.activeWorkflow?.path,
  () => void applyDraft()
)
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
    lastApplied = { workflowId, version }
    return
  }
  void loadDraft(
    workflowId,
    version,
    content,
    choice === 'agent' ? boundTabFor(workflowId) : null
  )
}

start()
void refreshCloudWorkflowIds()
onBeforeUnmount(stop)

const history = useAgentChatHistoryStore()

const { copy } = useClipboard({ legacy: true })

function onFeedback(turnId: string, vote: 'up' | 'down' | null): void {
  useTelemetry()?.trackAgentMessageFeedback({
    message_id: turnId,
    vote,
    workflow_id: draftStore.workflowId
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
  resetSnapshotGuard()
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
  applySuppressed = false
  void applyDraft()
  const nodeTags = consumeSelection()
  useTelemetry()?.trackAgentMessageSent({
    attachment_count: attachments.length,
    node_tag_count: nodeTags.length
  })
  void sendMessage(text, attachments, nodeTags).then((ok) => {
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
      :workflow-tabs="workflowTabs"
      :conflict-open="conflictOpen"
      :get-mention-nodes="mentionableNodes"
      @select-tab="onSelectTab"
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
