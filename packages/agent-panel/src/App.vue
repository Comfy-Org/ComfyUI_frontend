<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import AgentPanel from './components/agent/AgentPanel.vue'
import ChatHistoryDrawer from './components/agent/ChatHistoryDrawer.vue'
import OnboardingCoach from './components/agent/OnboardingCoach.vue'
import StartingPointModal from './components/agent/StartingPointModal.vue'
import MinimizedBall from './components/agent/dock/MinimizedBall.vue'
import type { CoachStep } from './composables/agent/useOnboarding'
import type { ComposerAttachment } from './composables/agent/useComposer'
import { useAgentSession } from './composables/agent/useAgentSession'
import type { AgentEventSource } from './composables/agent/useAgentSession'
import { useAgentFeatureGate } from './composables/agent/useAgentFeatureGate'
import type { AgentFlagSource } from './composables/agent/useAgentFeatureGate'
import { zAgentWsEvent } from './schemas/agentApiSchema'
import type {
  AgentCancelAccepted,
  AgentDraftSnapshot,
  AgentMessages,
  AgentThreadCreated,
  AgentTurnAccepted,
  AgentWsEvent,
  UploadImageResult
} from './schemas/agentApiSchema'
import type { AgentRestClient } from './services/agent/agentRestClient'
import { createAgentRestClient } from './services/agent/agentRestClient'
import { createWebSocketEventSource } from './services/agent/agentEventSource'
import { cn } from './utils/cn'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'

// Dev harness, two modes. Default: an inline fake REST client mints incrementing message
// ids and an inline scripted event source plays one turn's worth of frames per send, so
// the composer <-> message-stream loop and the M6 chrome stay exercisable offline.
// LIVE mode: when localStorage carries agentDevAuth (a bearer token pasted in devtools,
// kept off disk on purpose), REST and /ws route through the vite proxy to the real
// comfy-agent test environment; agentDevWorkflow optionally binds the draft workflow.
const THREAD_ID = 'dev-thread'
const STEP_MS = 350

const liveAuth = window.localStorage.getItem('agentDevAuth')
const liveWorkflow = window.localStorage.getItem('agentDevWorkflow')

// Dev harness gate: always on. Production hosts must pass
// createPostHogFlagSource(posthog) so the panel stays dark unless
// 'agent-in-app-experience' is enabled.
const devFlagSource: AgentFlagSource = { isEnabled: () => true }
const gate = useAgentFeatureGate(devFlagSource)

let listener: ((raw: unknown) => void) | undefined
let timer: ReturnType<typeof setInterval> | undefined
let messageSeq = 0

function stopPlayback(): void {
  clearInterval(timer)
  timer = undefined
}

function scriptTurn(messageId: string, text: string): AgentWsEvent[] {
  const data = { message_id: messageId, thread_id: THREAD_ID }
  return [
    zAgentWsEvent.parse({
      type: 'agent_thinking',
      data: { ...data, delta: 'Working out a response.' }
    }),
    zAgentWsEvent.parse({
      type: 'agent_tool_call',
      data: { ...data, tool_name: 'add_node', status: 'ok', args: [] }
    }),
    zAgentWsEvent.parse({
      type: 'agent_message_delta',
      data: { ...data, delta: `You said: **${text}**.\n\nHere is a plan.` }
    }),
    zAgentWsEvent.parse({
      type: 'agent_message_done',
      data: { ...data, usage: null }
    })
  ]
}

function playTurn(messageId: string, text: string): void {
  stopPlayback()
  const frames = scriptTurn(messageId, text)
  let index = 0
  timer = setInterval(() => {
    if (index >= frames.length) {
      stopPlayback()
      return
    }
    listener?.(frames[index++])
  }, STEP_MS)
}

const rest: AgentRestClient = {
  createThread: (): Promise<AgentThreadCreated> =>
    Promise.resolve({ thread_id: THREAD_ID }),
  postMessage: (_threadId, req): Promise<AgentTurnAccepted> => {
    const messageId = `dev-msg-${++messageSeq}`
    playTurn(messageId, req.content)
    return Promise.resolve({ thread_id: THREAD_ID, message_id: messageId })
  },
  getMessages: (): Promise<AgentMessages> => Promise.resolve([]),
  cancelMessage: (_threadId, messageId): Promise<AgentCancelAccepted> => {
    // Mirror the captured wire tail: stop playback, then deliver the terminal delta and
    // done for the in-flight message id through the same scripted listener path, so Stop
    // settles the turn instead of deadlocking on a spinner.
    stopPlayback()
    const data = { message_id: messageId, thread_id: THREAD_ID }
    listener?.(
      zAgentWsEvent.parse({
        type: 'agent_message_delta',
        data: { ...data, delta: 'Stopped at your request.' }
      })
    )
    listener?.(
      zAgentWsEvent.parse({
        type: 'agent_message_done',
        data: { ...data, usage: null }
      })
    )
    return Promise.resolve({ status: 'cancelling' })
  },
  getDraft: (): Promise<AgentDraftSnapshot> =>
    Promise.resolve({ content: {}, version: 0 }),
  uploadImage: (): Promise<UploadImageResult> =>
    Promise.resolve({ name: '', subfolder: '', type: 'input' })
}

const events: AgentEventSource = {
  subscribe(fn) {
    listener = fn
    return () => {
      listener = undefined
    }
  }
}

let liveSocket: WebSocket | undefined

function buildLiveDeps(auth: string) {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  liveSocket = new WebSocket(
    `${scheme}://${window.location.host}/ws?token=${encodeURIComponent(auth)}`
  )
  return {
    rest: createAgentRestClient({ getAuthToken: () => auth }),
    events: createWebSocketEventSource(liveSocket),
    workflowId: () => liveWorkflow ?? undefined
  }
}

const { start, stop, sendMessage, stopTurn, newChat, entries, isStreaming } =
  useAgentSession(liveAuth ? buildLiveDeps(liveAuth) : { rest, events })
start()
onBeforeUnmount(() => {
  stopPlayback()
  stop()
  liveSocket?.close()
  gate.dispose()
})

const history = useAgentChatHistoryStore()
history.upsert({
  id: 's1',
  title: 'Upscale portrait',
  updatedAt: Date.now() - 3_600_000
})
history.upsert({
  id: 's2',
  title: 'Inpaint mask',
  updatedAt: Date.now() - 90_000_000
})

const minimized = ref(false)
const sizeMode = ref<'medium' | 'large'>('medium')
const historyOpen = ref(false)
const startingOpen = ref(false)

const panelWidth = computed(() =>
  sizeMode.value === 'large' ? 'max-w-2xl' : 'max-w-md'
)

const coachSteps: CoachStep[] = [
  {
    target: '#agent-harness',
    title: 'Meet the agent',
    body: 'Ask it to build or edit graphs.'
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
  stopPlayback()
  newChat()
  startingOpen.value = true
}
</script>

<template>
  <template v-if="gate.enabled.value">
    <MinimizedBall v-if="minimized" @open="minimized = false" />
    <div
      v-else
      id="agent-harness"
      :class="
        cn('border-agent-border mx-auto h-screen w-full border-x', panelWidth)
      "
    >
      <AgentPanel
        :entries="entries"
        :streaming="isStreaming"
        :size-mode="sizeMode"
        user-name="Ada"
        @send="onSend"
        @stop="onStop"
        @new-chat="onNewChat"
        @close="minimized = true"
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
</template>
