<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onBeforeUnmount, ref } from 'vue'

import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

import AgentPanel from './components/agent/AgentPanel.vue'
import ChatHistoryDrawer from './components/agent/ChatHistoryDrawer.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import StartingPointModal from './components/agent/StartingPointModal.vue'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import { useAgentSession } from './composables/agent/useAgentSession'
import type { AgentEventSource } from './composables/agent/useAgentSession'
import { useDraftCanvasApply } from './composables/agent/useDraftCanvasApply'
import { createAgentRestClient } from './services/agent/agentRestClient'
import { createWebSocketEventSource } from './services/agent/agentEventSource'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'

// The in-source agent panel root: the sidebar tab renders this directly (type 'vue'),
// so it runs in the single host pinia + host i18n context and wires every host
// dependency itself. It replaces the former package mount + dev harness: a live REST
// client, the host /ws event source, the draft-to-canvas seam, and the M6 chrome
// (history drawer, starting-point modal, onboarding coach).
const workspaceAuthStore = useWorkspaceAuthStore()

const rest = createAgentRestClient({
  getAuthToken: () => workspaceAuthStore.workspaceToken ?? undefined
})

// The host /ws carries the agent_* broadcasts; the panel filters them off the shared
// socket. A null socket means the tab opened before the host socket connected; supply a
// no-op source so the session still constructs (deaf until a remount) rather than
// throwing during setup.
// TODO(FE-1187): the adapter binds THIS socket instance, so an api reconnect (which
// replaces api.socket) leaves the panel deaf until the tab remounts; also confirm
// agent_* message types reach raw socket listeners rather than being swallowed by the
// api dispatcher.
const events: AgentEventSource = api.socket
  ? createWebSocketEventSource(api.socket)
  : (console.warn('[agent-panel] host /ws socket not connected yet'),
    { subscribe: () => () => {} })

const { sendMessage, stopTurn, newChat, start, stop, entries, isStreaming } =
  useAgentSession({ rest, events })

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
    target: '#agent-harness',
    title: 'Meet the agent',
    body: 'Ask it to build or edit graphs.'
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
  <div id="agent-harness" :class="cn('mx-auto size-full', panelWidth)">
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
      storage-key="Comfy.AgentPanel.demoOnboarded"
    />
  </div>
</template>
