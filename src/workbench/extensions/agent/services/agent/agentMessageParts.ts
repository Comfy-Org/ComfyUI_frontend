import type { TurnId } from '../../schemas/agentApiSchema'

// Part field shapes mirror ai's TextUIPart / ReasoningUIPart / FileUIPart so a later
// swap to ai's own message model is mechanical.
export type PartState = 'streaming' | 'done'

export interface TextPart {
  type: 'text'
  text: string
  state: PartState
}

export interface ReasoningPart {
  type: 'reasoning'
  text: string
  state: PartState
}

// url is the signed asset URL, filename the server-minted title.
export interface FilePart {
  type: 'file'
  mediaType: string
  url: string
  filename: string
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

type MessagePart = TextPart | ReasoningPart | FilePart | ToolPart | NoticePart

export interface AssistantMessage {
  id: TurnId
  role: 'assistant'
  parts: MessagePart[]
  tokens: number
  streaming: boolean
  thinking: boolean
}

export function createAssistantMessage(id: TurnId): AssistantMessage {
  return {
    id,
    role: 'assistant',
    parts: [],
    tokens: 0,
    streaming: true,
    thinking: false
  }
}

// Fresh reference per emit: Vue's set trap skips same-reference (Object.is) and deep
// in-place mutations, so the shallow clone is what makes streaming deltas propagate.
export function snapshotMessage(message: AssistantMessage): AssistantMessage {
  return { ...message, parts: [...message.parts] }
}
