import type { TurnId } from '../../schemas/agentApiSchema'

// Part field shapes mirror ai's TextUIPart so a later swap to ai's own message
// model is mechanical.
export type PartState = 'streaming' | 'done'

export interface TextPart {
  type: 'text'
  text: string
  state: PartState
}

// callId is synthesized in arrival order; the wire carries no tool id.
export interface ToolPart {
  type: 'tool'
  callId: string
  name: string
  state: PartState
  ok?: boolean
}

export interface NoticePart {
  type: 'notice'
  level: 'info' | 'warning' | 'error'
  text: string
}

type MessagePart = TextPart | ToolPart | NoticePart

export interface AssistantMessage {
  id: TurnId
  role: 'assistant'
  parts: MessagePart[]
  streaming: boolean
  thinking: boolean
}

export function createAssistantMessage(id: TurnId): AssistantMessage {
  return {
    id,
    role: 'assistant',
    parts: [],
    streaming: true,
    thinking: false
  }
}

// Fresh reference per emit: Vue's set trap skips same-reference (Object.is) and deep
// in-place mutations, so the shallow clone is what makes streaming deltas propagate.
export function snapshotMessage(message: AssistantMessage): AssistantMessage {
  return { ...message, parts: [...message.parts] }
}
