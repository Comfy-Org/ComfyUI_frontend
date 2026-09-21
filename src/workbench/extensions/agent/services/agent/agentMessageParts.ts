import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'

export type PartState = 'streaming' | 'done'

export interface TextPart {
  type: 'text'
  text: string
  state: PartState
}

export interface ToolPart {
  type: 'tool'
  callId: string
  name: string
  state: PartState
  ok?: boolean
  durationMs?: number
}

export interface ThinkingPart {
  type: 'thinking'
  text: string
  state: PartState
  durationMs?: number
}

export interface NoticePart {
  type: 'notice'
  level: 'info' | 'warning' | 'error'
  text: string
  /**
   * Seconds the server asked the client to wait before retrying (parsed from
   * a `Retry-After` response header), e.g. on `funds_unavailable` admission
   * denials. Presentation-only - the caller decides whether/how to honour it
   * (countdown, disabled input, auto-retry); never implies a scheduled retry
   * on its own.
   */
  retryAfterSeconds?: number
}

export interface TabLinkPart {
  type: 'tabLink'
  workflowId: string
  locatorId?: string
  name?: string
}

export interface RunApprovalPart {
  type: 'runApproval'
  askId: string
  workflowId?: string
  workflowName?: string
}

export interface PermissionAskPart {
  type: 'permissionAsk'
  askId: string
  requestId?: string
  targetKind: 'path' | 'host'
  target: string
  reason?: string
}

export type AskPart = RunApprovalPart | PermissionAskPart

export function isAskPart(part: MessagePart): part is AskPart {
  return part.type === 'runApproval' || part.type === 'permissionAsk'
}

type PendingAsk = NonNullable<AgentMessages[number]['pending_ask']>

export type AgentAskSelection = 'run' | 'cancel' | 'allow' | 'deny'

export function toAskPart({
  kind,
  ask_id: askId,
  context
}: Pick<PendingAsk, 'kind' | 'ask_id' | 'context'>):
  | RunApprovalPart
  | PermissionAskPart
  | undefined {
  if (kind === 'run_approval')
    return {
      type: 'runApproval',
      askId,
      workflowId: context?.workflow_id || undefined,
      workflowName: context?.workflow_name || undefined
    }
  if (kind === 'permission' && context?.target_kind && context.target)
    return {
      type: 'permissionAsk',
      askId,
      requestId: context.request_id || undefined,
      targetKind: context.target_kind,
      target: context.target,
      reason: context.reason?.trim() || undefined
    }
  return undefined
}

export interface PaywallPart {
  type: 'paywall'
  message?: string
}

export type ActivityPart = ThinkingPart | ToolPart

export type MessagePart =
  | TextPart
  | ThinkingPart
  | ToolPart
  | NoticePart
  | TabLinkPart
  | RunApprovalPart
  | PermissionAskPart
  | PaywallPart

export interface AssistantMessage {
  id: TurnId
  role: 'assistant'
  parts: MessagePart[]
  streaming: boolean
  thinking: boolean
  thinkingText?: string
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

export function snapshotMessage(message: AssistantMessage): AssistantMessage {
  return { ...message, parts: message.parts.map((part) => ({ ...part })) }
}
