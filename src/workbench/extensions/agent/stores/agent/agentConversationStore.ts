import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type {
  AgentChatEvent,
  AgentEventTransport
} from '../../services/agent/agentEventTransport'
import { createAgentEventTransport } from '../../services/agent/agentEventTransport'
import type { AssistantMessage } from '../../services/agent/agentMessageParts'
import { createAssistantMessage } from '../../services/agent/agentMessageParts'

export type ConversationStatus = 'idle' | 'thinking' | 'streaming'

// What a sent attachment leaves behind in the transcript: the upload's display
// name plus a local preview (object URL); the server ref is not re-fetchable yet.
export interface UserAttachment {
  name: string
  previewUrl?: string
}

// Recorded at send time because the event stream is assistant-only; paired to its
// assistant turn by the shared TurnId (the server-minted message_id).
interface UserEntry {
  id: TurnId
  role: 'user'
  text: string
  attachments?: UserAttachment[]
}

export type ConversationEntry = UserEntry | AssistantMessage

export const useAgentConversationStore = defineStore(
  'agentConversation',
  () => {
    const messages = ref<AssistantMessage[]>([])
    const activeTurnId = ref<TurnId | null>(null)
    // Held here (not the session composable) so it survives a panel remount: a reopened
    // panel with a null thread would post to 'new' and split the transcript across two
    // server threads.
    const threadId = ref<string | null>(null)
    const userTexts = ref(new Map<TurnId, string>())
    const userAttachments = ref(new Map<TurnId, UserAttachment[]>())

    let transport: AgentEventTransport | null = null
    // Reactive so status/isStreaming re-derive the instant a turn opens or settles; a plain
    // closure int leaves those computeds stale until the next messages mutation.
    const activeIndex = ref(-1)

    function replaceActive(message: AssistantMessage): void {
      if (activeIndex.value >= 0) messages.value[activeIndex.value] = message
    }

    function recordUser(
      turnId: TurnId,
      text: string,
      attachments?: UserAttachment[]
    ): void {
      userTexts.value.set(turnId, text)
      if (attachments !== undefined && attachments.length > 0)
        userAttachments.value.set(turnId, attachments)
    }

    function setThreadId(id: string | null): void {
      threadId.value = id
    }

    // Opens no transport and leaves activeTurnId/activeIndex untouched, so any in-flight
    // turn is unaffected.
    function recordFailedSend(
      turnId: TurnId,
      text: string,
      noticeText: string
    ): void {
      userTexts.value.set(turnId, text)
      const message = createAssistantMessage(turnId)
      message.streaming = false
      message.parts = [{ type: 'notice', level: 'error', text: noticeText }]
      messages.value.push(message)
    }

    // Abort any prior in-flight turn first so a dropped reply can't leave two turns live.
    function startTurn(turnId: TurnId): void {
      if (transport) abortActiveTurn()
      const message = createAssistantMessage(turnId)
      activeIndex.value = messages.value.push(message) - 1
      activeTurnId.value = turnId
      transport = createAgentEventTransport(message, replaceActive)
    }

    // The store owns turn filtering: events for a foreign turn are dropped here. Every v1
    // chat event carries data.message_id, so there is no absent-id case to guard.
    function ingest(event: AgentChatEvent): void {
      if (!transport) return
      if (event.data.message_id !== activeTurnId.value) return
      if (event.type === 'agent_message_done') {
        transport.finalize(event.data.usage)
        clearActive()
        return
      }
      transport.ingest(event)
    }

    // Settle the in-flight turn WITHOUT a done (socket drop mid-turn): close open blocks and
    // clear transport/activeTurnId so no spinner is stuck forever.
    function abortActiveTurn(): void {
      if (!transport) return
      transport.abort()
      clearActive()
    }

    function clearActive(): void {
      transport = null
      activeIndex.value = -1
      activeTurnId.value = null
    }

    // Dropped transcript previews are object URLs pinning image buffers;
    // release them or every sent image outlives its conversation.
    function dropAttachmentPreviews(): void {
      for (const attachments of userAttachments.value.values()) {
        for (const { previewUrl } of attachments) {
          if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
        }
      }
      userAttachments.value = new Map()
    }

    function reset(): void {
      messages.value = []
      userTexts.value = new Map()
      dropAttachmentPreviews()
      threadId.value = null
      clearActive()
    }

    // Rows pair by turn_id and order by seq. A turn whose assistant row is missing
    // (interrupted before the reply persisted) still gets a settled placeholder so its user
    // prompt renders.
    function hydrate(history: AgentMessages): void {
      clearActive()
      const texts = new Map<TurnId, string>()
      const assistants = new Map<TurnId, AssistantMessage>()
      const turnOrder: TurnId[] = []
      for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
        const turnId = row.turn_id as TurnId
        if (!turnOrder.includes(turnId)) turnOrder.push(turnId)
        const text =
          typeof row.content?.text === 'string' ? row.content.text : ''
        if (row.role === 'user') texts.set(turnId, text)
        if (row.role === 'assistant') {
          const message =
            assistants.get(turnId) ?? createAssistantMessage(turnId)
          message.streaming = false
          if (text)
            message.parts = [
              ...message.parts,
              { type: 'text', text, state: 'done' }
            ]
          assistants.set(turnId, message)
        }
      }
      messages.value = turnOrder.map((turnId) => {
        const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
        message.streaming = false
        return message
      })
      userTexts.value = texts
      // The history endpoint does not return attachment refs yet; hydrated
      // turns render text-only until the BE persists them on the message row.
      dropAttachmentPreviews()
    }

    const entries = computed<ConversationEntry[]>(() =>
      messages.value.flatMap((message) => {
        const text = userTexts.value.get(message.id)
        return text === undefined
          ? [message]
          : [
              {
                id: message.id,
                role: 'user',
                text,
                attachments: userAttachments.value.get(message.id)
              },
              message
            ]
      })
    )

    const activeMessage = computed(() =>
      activeIndex.value >= 0 ? messages.value[activeIndex.value] : null
    )
    const isStreaming = computed(() => activeMessage.value?.streaming ?? false)
    const status = computed<ConversationStatus>(() => {
      const message = activeMessage.value
      if (!message?.streaming) return 'idle'
      return message.thinking ? 'thinking' : 'streaming'
    })

    return {
      messages,
      entries,
      activeTurnId,
      threadId,
      isStreaming,
      status,
      recordUser,
      setThreadId,
      recordFailedSend,
      startTurn,
      ingest,
      abortActiveTurn,
      reset,
      hydrate
    }
  }
)
