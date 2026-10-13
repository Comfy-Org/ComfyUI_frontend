import type { AgentAskResolvedData } from '@comfyorg/ingest-types'
import { zAgentRunApprovalContext } from '@comfyorg/ingest-types/zod'
import { uniqBy } from 'es-toolkit'

import type {
  AgentAskOption,
  AgentMessages,
  RenderedAskKind,
  TurnId
} from '../../schemas/agentApiSchema'
import { RENDERED_ASK_KINDS } from '../../schemas/agentApiSchema'

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
  skill?: string
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

/** Stands in for an ask the panel cannot render. */
export interface AskUnavailablePart {
  type: 'askUnavailable'
  askId: string
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

/** How an ask was closed. */
export interface AskUserResolution {
  status: 'answered' | 'closed' | 'unknown' | 'retired'
  selected: string[]
  otherText?: string
}

const RESOLUTION_RANK: Record<AskUserResolution['status'], number> = {
  retired: 0,
  unknown: 1,
  closed: 2,
  answered: 2
}

function isServerDecided({ status }: AskUserResolution): boolean {
  return status === 'answered' || status === 'closed'
}

function namesAnswer({ selected, otherText }: AskUserResolution): boolean {
  return selected.length > 0 || otherText !== undefined
}

function supersedes(
  next: AskUserResolution,
  shown: AskUserResolution
): boolean {
  const rank = RESOLUTION_RANK[next.status] - RESOLUTION_RANK[shown.status]
  if (rank !== 0) return rank > 0
  return isServerDecided(next) && !namesAnswer(shown) && namesAnswer(next)
}

/** The resolution an ask keeps when `next` arrives after `shown`. */
export function settleResolution(
  shown: AskUserResolution | undefined,
  next: AskUserResolution = { status: 'retired', selected: [] }
): AskUserResolution {
  return shown === undefined || supersedes(next, shown) ? next : shown
}

/** The resolution an `agent_ask_resolved` frame reports. */
export function toAskResolution({
  status,
  selected,
  other_text: otherText
}: AgentAskResolvedData): AskUserResolution {
  if (status !== 'answered') return { status: 'closed', selected: [] }
  if (selected === null) return { status: 'answered', selected: [] }
  return otherText
    ? { status: 'answered', selected, otherText }
    : { status: 'answered', selected }
}

/** The generic `ask_user` question. */
export interface AskUserPart {
  type: 'askUser'
  askId: string
  prompt: string
  options: AgentAskOption[]
  minSelections: number
  maxSelections: number
  allowOther: boolean
  resolution?: AskUserResolution
}

export type AskPart = RunApprovalPart | AskUserPart

export function isAskPart(part: MessagePart): part is AskPart {
  return part.type === 'runApproval' || part.type === 'askUser'
}

/** An ask card still waiting on the user. */
export function isPendingAskPart(part: MessagePart): part is AskPart {
  return (
    part.type === 'runApproval' ||
    (part.type === 'askUser' && part.resolution === undefined)
  )
}

/** A pending ask card or the notice standing in for one. */
export function isOpenAskPart(part: MessagePart): boolean {
  return isPendingAskPart(part) || part.type === 'askUnavailable'
}

/** The ask a part belongs to: its card or its stand-in notice. */
export function askIdOf(part: MessagePart): string | undefined {
  return isAskPart(part) || part.type === 'askUnavailable'
    ? part.askId
    : undefined
}

/** The parts with ask `askId` retired; returns `parts` when nothing changed. */
export function retireAskParts(
  parts: MessagePart[],
  askId: string,
  resolution?: AskUserResolution
): MessagePart[] {
  if (!parts.some((part) => askIdOf(part) === askId)) return parts
  return parts.flatMap((part): MessagePart[] => {
    if (askIdOf(part) !== askId) return [part]
    if (part.type !== 'askUser') return []
    const settled = settleResolution(part.resolution, resolution)
    return [
      settled === part.resolution ? part : { ...part, resolution: settled }
    ]
  })
}

type PendingAsk = NonNullable<AgentMessages[number]['pending_ask']>

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

/** Bounds on what an `ask_user` frame may render. */
export const ASK_USER_LIMITS = {
  options: 50,
  prompt: 2000,
  label: 200,
  description: 500
} as const

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

function toAskUserOptions(options: AgentAskOption[]): AgentAskOption[] {
  return uniqBy(options, ({ id }) => id)
    .slice(0, ASK_USER_LIMITS.options)
    .map(({ id, label, description }) => ({
      id,
      label: clip(label, ASK_USER_LIMITS.label),
      description:
        clip(description?.trim() ?? '', ASK_USER_LIMITS.description) ||
        undefined
    }))
}

function toAskUserPart(ask: AskInput): AskUserPart | undefined {
  const options = toAskUserOptions(ask.options)
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

const ASK_PART_BUILDERS: Record<
  RenderedAskKind,
  (ask: AskInput) => AskPart | undefined
> = {
  run_approval: (ask) => {
    const context = zAgentRunApprovalContext.safeParse(ask.context).data
    return {
      type: 'runApproval',
      askId: ask.ask_id,
      workflowId: context?.workflow_id || undefined,
      workflowName: context?.workflow_name || undefined
    }
  },
  ask_user: toAskUserPart
}

export function isRenderedAskKind(kind: unknown): kind is RenderedAskKind {
  return RENDERED_ASK_KINDS.some((rendered) => rendered === kind)
}

/** The card for an ask, by its explicit kind. */
export function toAskPart(ask: AskInput): AskPart | undefined {
  return isRenderedAskKind(ask.kind)
    ? ASK_PART_BUILDERS[ask.kind](ask)
    : undefined
}

/** The ask's card, or a stand-in notice when it cannot be rendered. */
export function toAskOrNoticePart(ask: AskInput): AskPart | AskUnavailablePart {
  return toAskPart(ask) ?? { type: 'askUnavailable', askId: ask.ask_id }
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
  | AskUnavailablePart
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
