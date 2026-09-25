import { i18n } from '@/i18n'

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
  /**
   * Set on the notice that stands in for an ask the panel cannot render, so
   * it goes when that ask resolves instead of telling the user to stop a turn
   * that has moved on.
   */
  askId?: string
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

export interface AskUserOption {
  id: string
  label: string
  description?: string
}

/** The generic `ask_user` question: a prompt plus every option the agent offered. */
export interface AskUserPart {
  type: 'askUser'
  askId: string
  prompt: string
  options: AskUserOption[]
  minSelections: number
  maxSelections: number
  allowOther: boolean
}

export type AskPart = RunApprovalPart | AskUserPart

export function isAskPart(part: MessagePart): part is AskPart {
  return part.type === 'runApproval' || part.type === 'askUser'
}

type PendingAsk = NonNullable<AgentMessages[number]['pending_ask']>

/**
 * The body of `POST /agent/threads/:id/asks/:ask_id/answer`: the chosen option
 * ids plus, when the ask allows it, free text that counts as one more selection.
 */
export interface AgentAskAnswer {
  selected: string[]
  otherText?: string
}

type AskInput = Pick<
  PendingAsk,
  | 'kind'
  | 'ask_id'
  | 'context'
  | 'prompt'
  | 'options'
  | 'min_selections'
  | 'max_selections'
  | 'allow_other'
>

/**
 * Bounds on what an `ask_user` frame may render. The frame is untrusted input,
 * so a runaway option list or text cannot freeze the panel.
 */
export const ASK_USER_LIMITS = {
  options: 50,
  prompt: 2000,
  label: 200,
  description: 500
} as const

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

/** Unique options (first occurrence wins, as on the server), capped and clipped. */
function toAskUserOptions(options: AskInput['options']): AskUserOption[] {
  const seen = new Set<string>()
  const choices: AskUserOption[] = []
  for (const { id, label, description } of options) {
    if (seen.has(id)) continue
    seen.add(id)
    choices.push({
      id,
      label: clip(label, ASK_USER_LIMITS.label),
      description:
        clip(description?.trim() ?? '', ASK_USER_LIMITS.description) ||
        undefined
    })
    if (choices.length === ASK_USER_LIMITS.options) break
  }
  return choices
}

function toAskUserPart(ask: AskInput): AskUserPart | undefined {
  const options = toAskUserOptions(ask.options)
  // Free text counts as one more selection, so it is one more thing to choose.
  const choosable = options.length + (ask.allow_other ? 1 : 0)
  if (choosable === 0) return undefined
  const maxSelections = Math.min(Math.max(1, ask.max_selections), choosable)
  return {
    type: 'askUser',
    askId: ask.ask_id,
    prompt: clip(ask.prompt, ASK_USER_LIMITS.prompt),
    options,
    minSelections: Math.min(Math.max(0, ask.min_selections), maxSelections),
    maxSelections,
    allowOther: ask.allow_other
  }
}

/**
 * The card for an ask, by its explicit kind. An unknown or missing kind maps to
 * nothing: a privileged ask that lost its discriminator must not render as a
 * generic chooser.
 */
export function toAskPart(ask: AskInput): AskPart | undefined {
  switch (ask.kind) {
    case 'run_approval':
      return {
        type: 'runApproval',
        askId: ask.ask_id,
        workflowId: ask.context?.workflow_id || undefined,
        workflowName: ask.context?.workflow_name || undefined
      }
    case 'ask_user':
      return toAskUserPart(ask)
    default:
      return undefined
  }
}

/**
 * The ask's card, or a notice when it cannot be rendered, so the user sees why
 * the turn is waiting instead of an invisible prompt.
 */
export function toAskOrNoticePart(ask: AskInput): AskPart | NoticePart {
  const part = toAskPart(ask)
  if (part) return part
  console.warn('[agent] cannot render agent ask', {
    kind: ask.kind,
    askId: ask.ask_id
  })
  return {
    type: 'notice',
    level: 'warning',
    text: i18n.global.t('agent.askUnavailable'),
    askId: ask.ask_id
  }
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
  | AskUserPart
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
