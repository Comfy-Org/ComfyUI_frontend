<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

import AgentPanel from './components/agent/AgentPanel.vue'
import ChatHistoryDrawer from './components/agent/ChatHistoryDrawer.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import StartingPointModal from './components/agent/StartingPointModal.vue'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import { useAgentSession } from './composables/agent/useAgentSession'
import { useDraftCanvasApply } from './composables/agent/useDraftCanvasApply'
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
onBeforeUnmount(stop)

const history = useAgentChatHistoryStore()

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
</script>

<template>
  <div id="agent-panel-root" :class="cn('mx-auto size-full', panelWidth)">
    <AgentPanel
      :entries
      :streaming="isStreaming"
      :size-mode="sizeMode"
      @send="onSend"
      @stop="onStop"
      @new-chat="onNewChat"
      @open-history="historyOpen = true"
      @toggle-size="sizeMode = sizeMode === 'large' ? 'medium' : 'large'"
    />
    <ChatHistoryDrawer
      v-model:open="historyOpen"
      :groups="history.grouped"
      @select="history.setActive($event)"
      @delete="history.remove($event)"
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
