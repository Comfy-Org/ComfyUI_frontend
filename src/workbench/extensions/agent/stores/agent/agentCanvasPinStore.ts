import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { watch } from 'vue'

import type { AssistantMessage } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

/** What a canvas pin shows: its turn's state, or `seen` once a finished answer was opened. */
export type AgentCanvasPinStatus =
  | 'working'
  | 'waiting'
  | 'done'
  | 'failed'
  | 'seen'

/** A pin left on the canvas by a message sent from the selection toolbox. */
export interface AgentCanvasPin {
  id: string
  threadId: string
  turnId: string
  nodeIds: string[]
  workflowPath: string
  seen: boolean
  outcome?: 'done' | 'failed'
}

const SHOWN_WHEN_HIDDEN: readonly AgentCanvasPinStatus[] = [
  'waiting',
  'done',
  'failed'
]

/** Whether a pin shows while pins are hidden: only a question, an unseen answer or a failure stays. */
export function pinShowsWhenHidden(status: AgentCanvasPinStatus): boolean {
  return SHOWN_WHEN_HIDDEN.includes(status)
}

function failed(message: AssistantMessage): boolean {
  return message.parts.some(
    (part) => part.type === 'notice' && part.level === 'error'
  )
}

function awaitsAnswer(
  message: AssistantMessage,
  pendingAskIds: ReadonlySet<string>
): boolean {
  return message.parts.some(
    (part) => 'askId' in part && pendingAskIds.has(part.askId)
  )
}

export const useAgentCanvasPinStore = defineStore('agentCanvasPin', () => {
  const conversation = useAgentConversationStore()
  const pins = useLocalStorage<AgentCanvasPin[]>('Comfy.Agent.CanvasPins', [])

  function add(pin: Omit<AgentCanvasPin, 'id' | 'seen'>): void {
    pins.value = [...pins.value, { ...pin, id: uuidv4(), seen: false }]
  }

  function markSeen(id: string): void {
    pins.value = pins.value.map((pin) =>
      pin.id === id ? { ...pin, seen: true } : pin
    )
  }

  function loadedMessage(pin: AgentCanvasPin): AssistantMessage | undefined {
    if (conversation.threadId !== pin.threadId) return undefined
    return conversation.messages.find((message) => message.id === pin.turnId)
  }

  function isLive(pin: AgentCanvasPin): boolean {
    return conversation
      .liveTurns()
      .some(
        (turn) =>
          turn.threadId === pin.threadId && turn.messageId === pin.turnId
      )
  }

  function settledOutcome(pin: AgentCanvasPin): 'done' | 'failed' | undefined {
    const message = loadedMessage(pin)
    if (!message || message.streaming || !message.parts.length) return undefined
    return failed(message) ? 'failed' : 'done'
  }

  function statusOf(pin: AgentCanvasPin): AgentCanvasPinStatus {
    if (isLive(pin)) {
      const message = loadedMessage(pin)
      const asks = new Set(conversation.pendingAskIds)
      return message && awaitsAnswer(message, asks) ? 'waiting' : 'working'
    }
    const outcome = settledOutcome(pin) ?? pin.outcome
    if (!outcome) return 'working'
    return outcome === 'done' && pin.seen ? 'seen' : outcome
  }

  watch(
    () =>
      pins.value.map((pin) =>
        isLive(pin) ? pin.outcome : (settledOutcome(pin) ?? pin.outcome)
      ),
    (outcomes) => {
      if (outcomes.every((outcome, i) => outcome === pins.value[i].outcome))
        return
      pins.value = pins.value.map((pin, i) => ({
        ...pin,
        outcome: outcomes[i]
      }))
    }
  )

  return { pins, add, markSeen, statusOf }
})
