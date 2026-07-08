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

// The draft rides the wire untyped; validate it through the host workflow schema
// before loading. One toast per failure streak (a turn can carry many patches).
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
  // Cancel any in-flight turn so it does not keep generating and billing while the panel
  // is closed; unsubscribe only after the cancel settles so its ack is not torn down.
  void stopTurn().finally(stop)
})

const history = useAgentChatHistoryStore()
const agentPanelStore = useAgentPanelStore()

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
