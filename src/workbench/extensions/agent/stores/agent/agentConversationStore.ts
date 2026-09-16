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
import type { WorkflowReference } from '../../types/workflowReference'
import { useAgentGeneratedNodesStore } from '../agentGeneratedNodesStore'

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
  workflowReferences?: WorkflowReference[]
}

export type ConversationEntry = UserEntry | AssistantMessage

interface BackgroundTurn {
  messageId: TurnId
  message: AssistantMessage
  transport: AgentEventTransport
  userText: string | undefined
  settled: boolean
}

export const useAgentConversationStore = defineStore(
  'agentConversation',
  () => {
    const graphActivity = useAgentGeneratedNodesStore()
    const messages = ref<AssistantMessage[]>([])
    const activeTurnId = ref<TurnId | null>(null)
    const threadId = ref<string | null>(null)
    const userTexts = ref(new Map<TurnId, string>())
    const userAttachments = ref(new Map<TurnId, UserAttachment[]>())
    const userTags = ref(new Map<TurnId, string[]>())
    const userWorkflowReferences = ref(new Map<TurnId, WorkflowReference[]>())
    const latestWorkflowId = ref<string>()

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
      tags?: string[],
      workflowReferences?: WorkflowReference[]
    ): void {
      userTexts.value.set(turnId, text)
      if (attachments !== undefined && attachments.length > 0)
        userAttachments.value.set(turnId, attachments)
      if (tags !== undefined && tags.length > 0)
        userTags.value.set(turnId, tags)
      if (workflowReferences !== undefined && workflowReferences.length > 0)
        userWorkflowReferences.value.set(turnId, workflowReferences)
    }

    function setThreadId(id: string | null): void {
      threadId.value = id
    }

    function recordSettledReply(
      turnId: TurnId,
      text: string,
      parts: AssistantMessage['parts']
    ): void {
      userTexts.value.set(turnId, text)
      const message = createAssistantMessage(turnId)
      message.streaming = false
      message.parts = parts
      messages.value.push(message)
    }

    function recordFailedSend(
      turnId: TurnId,
      text: string,
      noticeText: string
    ): void {
      recordSettledReply(turnId, text, [
        { type: 'notice', level: 'error', text: noticeText }
      ])
    }

    function recordPaywall(turnId: TurnId, text: string): void {
      recordSettledReply(turnId, text, [{ type: 'paywall' }])
    }

    function startTurn(turnId: TurnId): void {
      if (transport) abortActiveTurn()
      graphActivity.beginTurn(turnId)
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
          graphActivity.finishTurn(activeTurnId.value)
          clearActive()
          return
        }
        transport.ingest(event)
        return
      }
      const eventThreadId = event.data.thread_id
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
      if (!entry || entry.messageId !== event.data.message_id) return
      if (event.type === 'agent_message_done') {
        entry.transport.settle()
        graphActivity.finishTurn(entry.messageId)
        entry.settled = true
        return
      }
      entry.transport.ingest(event)
    }

    function abortActiveTurn(): void {
      if (!transport) return
      transport.settle()
      if (activeTurnId.value) graphActivity.finishTurn(activeTurnId.value)
      clearActive()
    }

    function stashActiveTurn(): void {
      if (!transport || liveMessage === null) return
      if (threadId.value === null || activeTurnId.value === null) {
        abortActiveTurn()
        return
      }
      backgroundTurns.set(threadId.value, {
        messageId: activeTurnId.value,
        message: liveMessage,
        transport,
        userText: userTexts.value.get(liveMessage.id),
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
      const kept = messages.value.filter((m) => m.id !== entry.message.id)
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
        hydratedMessageIds.has(entry.messageId)
      )
        return
      if (
        entry.userText !== undefined &&
        !userTexts.value.has(entry.message.id)
      )
        userTexts.value.set(entry.message.id, entry.userText)
      const index = kept.push(entry.message) - 1
      messages.value = kept
      if (entry.settled) return
      activeIndex.value = index
      activeTurnId.value = entry.messageId
      graphActivity.beginTurn(entry.messageId)
      transport = entry.transport
      liveMessage = entry.message
    }

    function settleBackgroundTurn(turnId: string): void {
      for (const [key, entry] of backgroundTurns) {
        if (entry.messageId !== turnId) continue
        entry.transport.settle()
        graphActivity.finishTurn(entry.messageId)
        backgroundTurns.delete(key)
        return
      }
    }

    function dropBackgroundTurns(): void {
      for (const entry of backgroundTurns.values()) {
        entry.transport.settle()
        graphActivity.finishTurn(entry.messageId)
      }
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
      if (activeTurnId.value) graphActivity.finishTurn(activeTurnId.value)
      messages.value = []
      userTexts.value = new Map()
      userTags.value = new Map()
      userWorkflowReferences.value = new Map()
      latestWorkflowId.value = undefined
      dropAttachmentPreviews()
      threadId.value = null
      hydratedMessageIds = new Set()
      hydratedAssistantTurnIds = new Set()
      clearActive()
    }

    function hydrate(history: AgentMessages): void {
      const transcript = normalizeAgentTranscript(history)
      if (
        activeTurnId.value &&
        activeTurnId.value !== transcript.pending?.messageId
      )
        graphActivity.finishTurn(activeTurnId.value)
      clearActive()
      messages.value = transcript.messages
      userTexts.value = transcript.userTexts
      userTags.value = new Map()
      userWorkflowReferences.value = transcript.userWorkflowReferences
      latestWorkflowId.value = transcript.latestWorkflowId
      hydratedMessageIds = transcript.rowIds
      hydratedAssistantTurnIds = transcript.assistantTurnIds
      dropAttachmentPreviews()
      if (transcript.pending) {
        liveMessage = transcript.pending.message
        activeIndex.value = messages.value.indexOf(transcript.pending.message)
        activeTurnId.value = transcript.pending.messageId
        graphActivity.beginTurn(transcript.pending.messageId)
        transport = createAgentEventTransport(
          transcript.pending.message,
          replaceActive
        )
      }
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
                tags: userTags.value.get(message.id),
                workflowReferences: userWorkflowReferences.value.get(message.id)
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
      latestWorkflowId,
      recordUser,
      setThreadId,
      recordFailedSend,
      recordPaywall,
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
