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

export interface UserAttachment {
  name: string
  previewUrl?: string
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
      if (transport && event.data.message_id === activeTurnId.value) {
        if (event.type === 'agent_message_done') {
          transport.settle()
          clearActive()
          return
        }
        transport.ingest(event)
        return
      }
      const entry = backgroundTurns.get(event.data.thread_id)
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
        settled: false
      })
      clearActive()
    }

    function resumeBackgroundTurn(): void {
      if (threadId.value === null) return
      const entry = backgroundTurns.get(threadId.value)
      if (!entry) return
      backgroundTurns.delete(threadId.value)
      const kept = messages.value.filter((m) => m.id !== entry.turnId)
      const last = kept.at(-1)
      let poppedHydratedCopy = false
      if (
        kept.length === messages.value.length &&
        last &&
        entry.userText !== undefined &&
        userTexts.value.get(last.id) === entry.userText
      ) {
        kept.pop()
        userTexts.value.delete(last.id)
        poppedHydratedCopy = true
      }
      if (entry.settled && !poppedHydratedCopy) {
        if (entry.userText === undefined) return
        const hydratedElsewhere = [...userTexts.value.values()].includes(
          entry.userText
        )
        if (hydratedElsewhere) return
      }
      if (entry.userText !== undefined && !userTexts.value.has(entry.turnId))
        userTexts.value.set(entry.turnId, entry.userText)
      const index = kept.push(entry.message) - 1
      messages.value = kept
      if (entry.settled) return
      activeIndex.value = index
      activeTurnId.value = entry.turnId
      transport = entry.transport
      liveMessage = entry.message
    }

    function settleBackgroundTurn(turnId: string): void {
      for (const [key, entry] of backgroundTurns) {
        if (entry.turnId !== turnId) continue
        entry.transport.settle()
        backgroundTurns.delete(key)
        return
      }
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
      userTags.value = new Map()
      dropAttachmentPreviews()
      threadId.value = null
      clearActive()
    }

    function hydrate(history: AgentMessages): void {
      clearActive()
      const texts = new Map<TurnId, string>()
      const assistants = new Map<TurnId, AssistantMessage>()
      const turnOrder: TurnId[] = []
      const seenTurns = new Set<TurnId>()
      for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
        const turnId = row.turn_id as TurnId
        if (!seenTurns.has(turnId)) {
          seenTurns.add(turnId)
          turnOrder.push(turnId)
        }
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
      userTags.value = new Map()
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
      dropBackgroundTurns,
      reset,
      hydrate
    }
  }
)
