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
import { normalizeAgentTranscript } from '../../services/agent/agentTranscript'

export type ConversationStatus = 'idle' | 'thinking' | 'streaming'

export interface UserAttachment {
  name: string
  previewUrl?: string
  /** Uploaded input filename; resolves the sent file for grid previews. */
  ref?: string
}

interface UserEntry {
  id: TurnId
  role: 'user'
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
}

export type ConversationEntry = UserEntry | AssistantMessage

interface BackgroundTurn {
  turnId: TurnId
  message: AssistantMessage
  transport: AgentEventTransport
  userText: string | undefined
  attachments: UserAttachment[] | undefined
  tags: string[] | undefined
  settled: boolean
}

export const useAgentConversationStore = defineStore(
  'agentConversation',
  () => {
    const messages = ref<AssistantMessage[]>([])
    const activeTurnId = ref<TurnId | null>(null)
    const threadId = ref<string | null>(null)
    const userTexts = ref(new Map<TurnId, string>())
    const userAttachments = ref(new Map<TurnId, UserAttachment[]>())
    const userTags = ref(new Map<TurnId, string[]>())

    let transport: AgentEventTransport | null = null
    let liveMessage: AssistantMessage | null = null
    const backgroundTurns = new Map<string, BackgroundTurn>()
    let hydratedMessageIds = new Set<string>()
    let hydratedAssistantTurnIds = new Set<TurnId>()
    const activeIndex = ref(-1)

    function replaceActive(message: AssistantMessage): void {
      const index = activeIndex.value
      if (index >= 0 && messages.value[index]?.id === message.id)
        messages.value[index] = message
    }

    function recordUser(
      turnId: TurnId,
      text: string,
      attachments?: UserAttachment[],
      tags?: string[]
    ): void {
      userTexts.value.set(turnId, text)
      if (attachments !== undefined && attachments.length > 0)
        userAttachments.value.set(turnId, attachments)
      if (tags !== undefined && tags.length > 0)
        userTags.value.set(turnId, tags)
    }

    function setThreadId(id: string | null): void {
      threadId.value = id
    }

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

    function startTurn(turnId: TurnId): void {
      if (transport) abortActiveTurn()
      const message = createAssistantMessage(turnId)
      liveMessage = message
      activeIndex.value = messages.value.push(message) - 1
      activeTurnId.value = turnId
      transport = createAgentEventTransport(message, replaceActive)
    }

    function ingest(event: AgentChatEvent): void {
      const eventThreadId = event.data.thread_id
      if (
        transport &&
        event.data.message_id === activeTurnId.value &&
        (threadId.value === null ||
          eventThreadId === undefined ||
          eventThreadId === threadId.value)
      ) {
        if (event.type === 'agent_message_done') {
          transport.settle()
          clearActive()
          return
        }
        transport.ingest(event)
        return
      }
      // agent_active_tab is the one event whose message_id is optional; without
      // it the thread is the only routing key left.
      if (
        event.type === 'agent_active_tab' &&
        event.data.message_id === undefined
      ) {
        if (eventThreadId === undefined || eventThreadId === threadId.value)
          transport?.ingest(event)
        else backgroundTurns.get(eventThreadId)?.transport.ingest(event)
        return
      }
      if (eventThreadId === undefined) return
      const entry = backgroundTurns.get(eventThreadId)
      if (!entry || entry.turnId !== event.data.message_id) return
      if (event.type === 'agent_message_done') {
        entry.transport.settle()
        entry.settled = true
        return
      }
      entry.transport.ingest(event)
    }

    function abortActiveTurn(): void {
      if (!transport) return
      transport.settle()
      clearActive()
    }

    function stashActiveTurn(): void {
      if (!transport || liveMessage === null) return
      if (threadId.value === null || activeTurnId.value === null) {
        abortActiveTurn()
        return
      }
      backgroundTurns.set(threadId.value, {
        turnId: activeTurnId.value,
        message: liveMessage,
        transport,
        userText: userTexts.value.get(activeTurnId.value),
        attachments: userAttachments.value.get(activeTurnId.value),
        tags: userTags.value.get(activeTurnId.value),
        settled: false
      })
      clearActive()
    }

    function resumeBackgroundTurn(): void {
      if (threadId.value === null) return
      const entry = backgroundTurns.get(threadId.value)
      if (!entry) return
      backgroundTurns.delete(threadId.value)
      // The stash keys a turn by its message_id while hydrate() re-keys the same
      // turn by the server's turn_id; row.id bridges the two. Matching turns by
      // identity, not by shared user text, is what stops a repeated prompt from
      // colliding with an unrelated turn.
      const kept = messages.value.filter((m) => m.id !== entry.turnId)
      const last = kept.at(-1)
      let poppedHydratedCopy = false
      if (
        kept.length === messages.value.length &&
        last &&
        !hydratedAssistantTurnIds.has(last.id) &&
        entry.userText !== undefined &&
        userTexts.value.get(last.id) === entry.userText
      ) {
        kept.pop()
        userTexts.value.delete(last.id)
        poppedHydratedCopy = true
      }
      if (
        entry.settled &&
        !poppedHydratedCopy &&
        hydratedMessageIds.has(entry.turnId)
      )
        return
      if (entry.userText !== undefined && !userTexts.value.has(entry.turnId))
        userTexts.value.set(entry.turnId, entry.userText)
      if (entry.attachments !== undefined)
        userAttachments.value.set(entry.turnId, entry.attachments)
      if (entry.tags !== undefined) userTags.value.set(entry.turnId, entry.tags)
      const index = kept.push(entry.message) - 1
      messages.value = kept
      if (entry.settled) return
      activeIndex.value = index
      activeTurnId.value = entry.turnId
      transport = entry.transport
      liveMessage = entry.message
    }

    function settleBackgroundTurn(thread: string, turnId: string): void {
      const entry = backgroundTurns.get(thread)
      if (!entry || entry.turnId !== turnId) return
      entry.transport.settle()
      backgroundTurns.delete(thread)
    }

    function startBackgroundTurn(
      thread: string,
      turnId: TurnId,
      text: string,
      attachments?: UserAttachment[],
      tags?: string[]
    ): void {
      const message = createAssistantMessage(turnId)
      const backgroundTransport = createAgentEventTransport(message, () => {})
      backgroundTurns.set(thread, {
        turnId,
        message,
        transport: backgroundTransport,
        userText: text,
        attachments,
        tags,
        settled: false
      })
    }

    function dropBackgroundTurns(): void {
      for (const entry of backgroundTurns.values()) entry.transport.settle()
      backgroundTurns.clear()
    }

    function clearActive(): void {
      transport = null
      liveMessage = null
      activeIndex.value = -1
      activeTurnId.value = null
    }

    function dropAttachmentPreviews(): void {
      const retained = new Set(
        [...backgroundTurns.values()].flatMap(
          ({ attachments }) =>
            attachments?.map(({ previewUrl }) => previewUrl) ?? []
        )
      )
      for (const attachments of userAttachments.value.values()) {
        for (const { previewUrl } of attachments) {
          if (previewUrl?.startsWith('blob:') && !retained.has(previewUrl))
            URL.revokeObjectURL(previewUrl)
        }
      }
      userAttachments.value = new Map()
    }

    function reset(): void {
      messages.value = []
      userTexts.value = new Map()
      userTags.value = new Map()
      dropAttachmentPreviews()
      threadId.value = null
      hydratedMessageIds = new Set()
      hydratedAssistantTurnIds = new Set()
      clearActive()
    }

    function hydrate(history: AgentMessages): void {
      clearActive()
      const transcript = normalizeAgentTranscript(history)
      messages.value = transcript.messages
      userTexts.value = transcript.userTexts
      userTags.value = new Map()
      hydratedMessageIds = transcript.rowIds
      hydratedAssistantTurnIds = transcript.assistantTurnIds
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
                attachments: userAttachments.value.get(message.id),
                tags: userTags.value.get(message.id)
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
      stashActiveTurn,
      resumeBackgroundTurn,
      settleBackgroundTurn,
      startBackgroundTurn,
      dropBackgroundTurns,
      reset,
      hydrate
    }
  }
)
