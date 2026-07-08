<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@/platform/telemetry'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

import AgentPanel from './components/agent/AgentPanel.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import { useAttachment } from './composables/agent/useAttachment'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import type { AgentThreadSummary } from './schemas/agentApiSchema'
import type { ChatSession } from './stores/agent/agentChatHistoryStore'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useDraftCanvasApply } from './composables/agent/useDraftCanvasApply'
import { buildTranscriptMarkdown } from './services/agent/agentTranscript'
import { createAgentRestClient } from './services/agent/agentRestClient'
import { createReconnectingEventSource } from './services/agent/agentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

// The in-source agent panel root: the sidebar tab renders this directly (type 'vue'),
// so it runs in the single host pinia + host i18n context and wires every host
// dependency itself. It replaces the former package mount + dev harness: a live REST
// client, the host /ws event source, the draft-to-canvas seam, and the M6 chrome
// (history drawer, starting-point modal, onboarding coach).
const { t } = useI18n()
const toast = useToastStore()
const workspaceAuthStore = useWorkspaceAuthStore()

// Personalize the greeting with the logged-in user's first name (design A / B5: "Hello Jo,").
const { userDisplayName } = useCurrentUser()
const userName = computed(
  () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
)

const rest = createAgentRestClient({
  getAuthToken: () => workspaceAuthStore.workspaceToken ?? undefined
})

// The host /ws carries the agent_* broadcasts; the panel filters them off the shared
// socket. The reconnecting source follows api.socket across reconnects (the api nulls and
// replaces its socket on close/reopen), so the panel is not left deaf after a reconnect.
// TODO(FE-1187): confirm agent_* message types reach raw socket listeners rather than
// being swallowed by the api dispatcher.
const events = createReconnectingEventSource(api)

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
} = useAgentSession({ rest, events })

// Session notices (cancel-failure, draft-resync errors) have no inline conversation row,
// so surface each newly appended one through the host toast. New-entries-only: the watch
// forwards the tail past the previously seen length, no dedupe beyond that.
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

// V0 draft apply is a full-graph load per the tech design (no incremental edits). The
// draft rides the wire untyped; parse it through the host's own workflow schema instead
// of blind-casting before handing it to the canvas. A rejected draft must be visible:
// silently dropping it strands the user on a stale canvas while the agent narrates a
// graph they never see. One toast per failure streak (a turn can carry many patches),
// reset on the next draft that applies.
let draftRejectionNotified = false
useDraftCanvasApply((content) => {
  void (async () => {
    const workflow = await validateComfyWorkflow(content, (error) => {
      console.warn(error)
      if (draftRejectionNotified) return
      draftRejectionNotified = true
      toast.add({
        severity: 'error',
        summary: t('agent.draftApplyFailed')
      })
    })
    if (!workflow) return
    draftRejectionNotified = false
    await app.loadGraphData(workflow)
  })()
})

start()
onBeforeUnmount(() => {
  // A sidebar toggle unmounts this component. Cancel any in-flight turn so it does not keep
  // generating and billing while the panel is closed (its events would be missed and leave a
  // turn stuck streaming on reopen); the thread id is persisted, so a reopen resumes the
  // conversation.
  void stopTurn()
  stop()
})

const history = useAgentChatHistoryStore()
const agentPanelStore = useAgentPanelStore()

const { copy } = useClipboard({ legacy: true })

// Message rating (PM-98). A null vote is a retraction of a prior thumb and is forwarded so
// the eval pipeline records it rather than dropping it.
// TODO(PM-98): move to a first-class rating endpoint when the backend exposes one; telemetry
// capture satisfies rating-after-generation for the eval pipeline meanwhile.
function onFeedback(turnId: string, vote: 'up' | 'down' | null): void {
  useTelemetry()?.trackAgentMessageFeedback({ message_id: turnId, vote })
}

// Chat History (B12) is server-backed via GET /api/agent/threads. The list is refreshed
// when the panel mounts and each time it is opened; the active row tracks the current
// thread. Best-effort: a failed fetch leaves the last-known list rather than blanking it.
// title is "" until the server names the thread, so the row falls back to the preview
// (the first prompt), mirroring how the session bar titles a live chat.
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
    // History is a best-effort side panel; a list failure must not disrupt the chat.
    // Logged, not surfaced: a schema/shape drift here must stay diagnosable.
    console.warn('[agent] listThreads failed:', error)
  }
}

// The active row follows the live thread (adopted on the first send's ack, or on load).
watch(threadId, (id) => history.setActive(id), { immediate: true })

// Prime the list on mount so the panel opens with a populated Chat History.
void refreshHistory()

// Load a past chat from history: adopt + hydrate the thread, then refresh the list so its
// row moves to "Current".
async function onSelectHistory(id: string): Promise<void> {
  await loadThread(id)
  void refreshHistory()
}

// Copy-as-markdown (B12). Only the current in-memory conversation has a transcript; a
// non-active session id has nothing to serialize and gets an info toast instead.
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

function onSend(text: string, attachments: ComposerAttachment[]): void {
  void sendMessage(
    text,
    attachments.map((attachment) => attachment.ref)
  )
}

function onStop(): void {
  void stopTurn()
}

function onNewChat(): void {
  // V0: a new chat just clears the conversation back to the empty state. The onboarding
  // "starting point" modal is out of scope for V0 (Key Decision #2).
  newChat()
}

// Attachments (P0 B6): the composer's attach affordance opens this hidden picker; picked
// image/video files upload through the cloud REST client, and the staged refs ride the next
// send's attachments. uploadImage answers {name, subfolder, type}; the send path forwards
// `name` as the LoadImage-style ref.
const panelRef = ref<InstanceType<typeof AgentPanel>>()
const fileInput = ref<HTMLInputElement>()

const attachment = useAttachment({
  upload: async (file) => ({
    ref: (await rest.uploadImage(file, file.name)).name
  }),
  onError: (message) => toast.add({ severity: 'error', summary: message })
})

function onAttach(): void {
  fileInput.value?.click()
}

async function onFilesPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    for (const staged of await attachment.addFiles(Array.from(files))) {
      panelRef.value?.addAttachment(staged)
    }
  }
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
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
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
