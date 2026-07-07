<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

import AgentPanel from './components/agent/AgentPanel.vue'
import type { AgentSessionDeps } from './composables/agent/useAgentSession'
import { useAgentSession } from './composables/agent/useAgentSession'
import type { ComposerAttachment } from './composables/agent/useComposer'
import { useDraftCanvasApply } from './composables/agent/useDraftCanvasApply'

// The embeddable panel root a HOST mounts via mountAgentPanel: the chat panel wired
// to a live session, none of the dev-harness fakes. History drawer, onboarding, and
// dock chrome are host-side decisions deferred to the FE-1187 design-alignment pass.
const { deps, applyDraft, userName } = defineProps<{
  deps: AgentSessionDeps
  applyDraft?: (content: Record<string, unknown>, version: number) => void
  userName?: string
}>()

const { start, stop, sendMessage, stopTurn, newChat, entries, isStreaming } =
  useAgentSession(deps)
if (applyDraft) useDraftCanvasApply(applyDraft)
start()
onBeforeUnmount(stop)

function onSend(text: string, attachments: ComposerAttachment[]): void {
  void sendMessage(
    text,
    attachments.map((attachment) => attachment.ref)
  )
}

function onStop(): void {
  void stopTurn()
}
</script>

<template>
  <AgentPanel
    :entries
    :streaming="isStreaming"
    :user-name="userName"
    @send="onSend"
    @stop="onStop"
    @new-chat="newChat"
  />
</template>
