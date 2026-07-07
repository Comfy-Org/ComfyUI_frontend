import type { TurnId } from '../../schemas/agentApiSchema'

/**
 * agentMessageParts: the shared assistant-message part model.
 *
 * The ordered part list a turn's v1 events fold into (agentEventTransport). The part
 * field shapes mirror ai's TextUIPart / ReasoningUIPart / FileUIPart so a later swap
 * to ai's own message model is mechanical, not a rewrite.
 */

// Text/reasoning stream lifecycle, mirroring ai's UIPart `state`.
export type PartState = 'streaming' | 'done'

// Mirrors ai's TextUIPart field shape.
export interface TextPart {
  type: 'text'
  text: string
  state: PartState
}

// Mirrors ai's ReasoningUIPart field shape.
export interface ReasoningPart {
  type: 'reasoning'
  text: string
  state: PartState
}

// Mirrors ai's FileUIPart field shape. Assets carry mediaType 'image' (valid per
// ai's FileUIPart contract) since the server only forwards rendered image/video
// outputs; `url` is the signed asset URL, `filename` the server-minted title.
export interface FilePart {
  type: 'file'
  mediaType: string
  url: string
  filename: string
}

// Panel-local UI card (no ai analog): a tool invocation the server ran and reports
// via a single post-completion agent_tool_call event; no id on the wire, callId is
// synthesized in arrival order (tool_0, tool_1, ...); cards arrive settled, ok
// mirrors the event status, finalize is a defensive backstop.
export interface ToolPart {
  type: 'tool'
  callId: string
  name: string
  state: PartState
  ok?: boolean
}

// Panel-local persistent notice (no ai analog): account-mismatch / server warnings.
export interface NoticePart {
  type: 'notice'
  level: 'info' | 'warning' | 'error'
  text: string
}

export type MessagePart =
  | TextPart
  | ReasoningPart
  | FilePart
  | ToolPart
  | NoticePart

export interface AssistantMessage {
  id: TurnId
  role: 'assistant'
  parts: MessagePart[]
  // Adopted once from agent_message_done usage.total_tokens; null usage on cancel
  // leaves the prior value.
  tokens: number
  // True until the reply arrives, an abort settles the turn, or an error surfaces.
  streaming: boolean
  // True once the thinking chip should show (a thinking phase with no text yet).
  thinking: boolean
}

// The reply text the server sends when NO text streamed is literal assistant
// content ('⚠️ ...', '_(stopped)_', '(no response)'), never a marker to detect
// or swallow - mirrors finalizeStream's `!gotText && replyText` branch
// (comfyAgent.ts:1512).
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

// A fresh message reference per emit so the store's ref assignment trips Vue's set
// trap: Object.is on the same object reference does NOT trigger reactivity, and a
// deep in-place mutation of an existing (possibly markRaw) object does not either.
// The shallow clone (+ new parts array) is what makes streaming deltas propagate.
export function snapshotMessage(message: AssistantMessage): AssistantMessage {
  return { ...message, parts: [...message.parts] }
}
