<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
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
import ChatHistoryDrawer from './components/agent/ChatHistoryDrawer.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import StartingPointModal from './components/agent/StartingPointModal.vue'
import { useAttachment } from './composables/agent/useAttachment'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import type { ConversationEntry } from './stores/agent/agentConversationStore'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useDraftCanvasApply } from './composables/agent/useDraftCanvasApply'
import { buildTranscriptMarkdown } from './services/agent/agentTranscript'
import { createAgentRestClient } from './services/agent/agentRestClient'
import { createReconnectingEventSource } from './services/agent/agentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'

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
  notices
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
// of blind-casting before handing it to the canvas.
useDraftCanvasApply((content) => {
  void (async () => {
    const workflow = await validateComfyWorkflow(content)
    if (workflow) await app.loadGraphData(workflow)
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

const { copy } = useClipboard({ legacy: true })

// Message rating (PM-98). A null vote is a retraction of a prior thumb and is forwarded so
// the eval pipeline records it rather than dropping it.
// TODO(PM-98): move to a first-class rating endpoint when the backend exposes one; telemetry
// capture satisfies rating-after-generation for the eval pipeline meanwhile.
function onFeedback(turnId: string, vote: 'up' | 'down' | null): void {
  useTelemetry()?.trackAgentMessageFeedback({ message_id: turnId, vote })
}

// V0 mirrors the single in-memory conversation as one "current" history row, keyed by its
// first turn, so the drawer isn't empty mid-chat and copy-as-markdown has a target. The row
// is replaced (not archived) on new-chat; persisting past sessions is a documented V0 limit.
const currentPrompt = computed(
  () =>
    entries.value.find(
      (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
        entry.role === 'user'
    ) ?? null
)
watch(
  () => currentPrompt.value?.id ?? null,
  (id, previousId) => {
    if (previousId && id !== previousId) history.remove(previousId)
    const prompt = currentPrompt.value
    if (!prompt) return
    history.setActive(prompt.id)
    history.upsert({
      id: prompt.id,
      title: prompt.text.slice(0, 60) || t('agent.untitledChat'),
      updatedAt: Date.now()
    })
  }
)

// Copy-as-markdown (B12). Only the current in-memory conversation has a transcript; a
// non-active session id has nothing to serialize and gets an info toast instead.
function onCopyMarkdown(id: string): void {
  if (id === history.activeId) void copy(buildTranscriptMarkdown(entries.value))
  else toast.add({ severity: 'info', summary: t('agent.copyUnavailable') })
}

const sizeMode = ref<'medium' | 'large'>('medium')
const historyOpen = ref(false)
const startingOpen = ref(false)

const coachSteps: CoachStep[] = [
  {
    target: '#agent-panel-root',
    title: t('agent.coachTitle'),
    body: t('agent.coachBody')
  }
]

const panelWidth = computed(() =>
  sizeMode.value === 'large' ? 'max-w-2xl' : 'max-w-md'
)

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
  startingOpen.value = true
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
  <div id="agent-panel-root" :class="cn('mx-auto size-full', panelWidth)">
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
      :size-mode="sizeMode"
      :can-attach="true"
      @send="onSend"
      @stop="onStop"
      @attach="onAttach"
      @feedback="onFeedback"
      @new-chat="onNewChat"
      @open-history="historyOpen = true"
      @toggle-size="sizeMode = sizeMode === 'large' ? 'medium' : 'large'"
    />
    <ChatHistoryDrawer
      v-model:open="historyOpen"
      :groups="history.grouped"
      @select="history.setActive($event)"
      @delete="history.remove($event)"
      @copy-markdown="onCopyMarkdown"
    />
    <StartingPointModal
      v-model:open="startingOpen"
      @select="startingOpen = false"
    />
    <OnboardingCoach
      :steps="coachSteps"
      storage-key="Comfy.AgentPanel.onboarded"
    />
  </div>
</template>
