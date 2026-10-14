import type {
  AgentAskOption,
  AgentAskResolvedData
} from '@comfyorg/ingest-types'
import {
  zAgentDeleteApprovalContext,
  zAgentRunApprovalContext
} from '@comfyorg/ingest-types/zod'
import { isEqual, uniqBy } from 'es-toolkit'

import type {
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

export type AskUserResolution =
  | { status: 'answered'; selected: string[]; otherText?: string }
  | { status: 'closed' | 'unknown' | 'retired' }

const UNANSWERED_SCORE: Record<
  Exclude<AskUserResolution['status'], 'answered'>,
  number
> = { retired: 0, unknown: 1, closed: 2 }

function resolutionScore(resolution: AskUserResolution): number {
  if (resolution.status !== 'answered')
    return UNANSWERED_SCORE[resolution.status]
  return resolution.selected.length > 0 || resolution.otherText !== undefined
    ? 3
    : 2
}

export function settleResolution(
  shown: AskUserResolution | undefined,
  next: AskUserResolution
): AskUserResolution {
  return shown === undefined || resolutionScore(next) > resolutionScore(shown)
    ? next
    : shown
}

export function toAskResolution({
  status,
  selected,
  other_text: otherText
}: Partial<
  Pick<AgentAskResolvedData, 'status' | 'selected' | 'other_text'>
>): AskUserResolution {
  if (status === undefined) return { status: 'retired' }
  if (status !== 'answered') return { status: 'closed' }
  return otherText
    ? { status: 'answered', selected: selected ?? [], otherText }
    : { status: 'answered', selected: selected ?? [] }
}

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

interface DeleteTarget {
  id: string
  name?: string
}

/** The agent asking before it deletes nodes the user added. */
export interface DeleteApprovalPart {
  type: 'deleteApproval'
  askId: string
  prompt: string
  nodes: DeleteTarget[]
  hiddenNodeCount: number
  resolution?: AskUserResolution
}

export type AskPart = RunApprovalPart | AskUserPart | DeleteApprovalPart

function isAskPart(part: MessagePart): part is AskPart {
  return (
    part.type === 'runApproval' ||
    part.type === 'askUser' ||
    part.type === 'deleteApproval'
  )
}

export function isPendingAskPart(part: MessagePart): part is AskPart {
  return (
    part.type === 'runApproval' ||
    (isAskPart(part) && part.resolution === undefined)
  )
}

export function isOpenAskPart(part: MessagePart): boolean {
  return isPendingAskPart(part) || part.type === 'askUnavailable'
}

export function askIdOf(part: MessagePart): string | undefined {
  return 'askId' in part ? part.askId : undefined
}

export function retireAskParts(
  parts: MessagePart[],
  askId: string,
  resolution: AskUserResolution
): MessagePart[] {
  const next = parts.flatMap((part): MessagePart[] => {
    if (askIdOf(part) !== askId) return [part]
    if (!isAskPart(part) || part.type === 'runApproval') return []
    const settled = settleResolution(part.resolution, resolution)
    return [
      settled === part.resolution ? part : { ...part, resolution: settled }
    ]
  })
  return next.length === parts.length &&
    next.every((part, index) => part === parts[index])
    ? parts
    : next
}

type PendingAsk = NonNullable<AgentMessages[number]['pending_ask']>

type AskInput = Omit<PendingAsk, 'message_id'>

const ASK_LIMITS = {
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
    .slice(0, ASK_LIMITS.options)
    .map(({ id, label, description }) => ({
      id,
      label: clip(label, ASK_LIMITS.label),
      description:
        clip(description?.trim() ?? '', ASK_LIMITS.description) || undefined
    }))
}

export function choosableCount({
  options,
  allowOther
}: Pick<AskUserPart, 'options' | 'allowOther'>): number {
  return options.length + (allowOther ? 1 : 0)
}

function toAskUserPart(ask: AskInput): AskUserPart | undefined {
  const options = toAskUserOptions(ask.options)
  const choosable = choosableCount({ options, allowOther: ask.allow_other })
  if (choosable === 0) return undefined
  const maxSelections = Math.min(Math.max(1, ask.max_selections), choosable)
  return {
    type: 'askUser',
    askId: ask.ask_id,
    prompt: clip(ask.prompt, ASK_LIMITS.prompt),
    options,
    minSelections: Math.min(Math.max(0, ask.min_selections), maxSelections),
    maxSelections,
    allowOther: ask.allow_other
  }
}

function toDeleteTargets(
  context: AskInput['context']
): Pick<DeleteApprovalPart, 'nodes' | 'hiddenNodeCount'> | undefined {
  const parsed = zAgentDeleteApprovalContext.safeParse(context)
  if (!parsed.success) return undefined
  const { nodes, hidden_node_count: hiddenNodeCount = 0 } = parsed.data
  if (nodes.some(({ id }) => id.trim() === '')) return undefined
  return {
    nodes: uniqBy(nodes, ({ id }) => id).map(({ id, title, type }) => {
      const name = title?.trim() || type?.trim()
      return { id, name: name ? clip(name, ASK_LIMITS.label) : undefined }
    }),
    hiddenNodeCount
  }
}

function toDeleteApprovalPart(ask: AskInput): DeleteApprovalPart | undefined {
  const offersDeleteOrKeep =
    isEqual(ask.options.map(({ id }) => id).sort(), ['delete', 'keep']) &&
    ask.min_selections === 1 &&
    ask.max_selections === 1 &&
    !ask.allow_other
  const targets = toDeleteTargets(ask.context)
  if (!offersDeleteOrKeep || !targets) return undefined
  return {
    type: 'deleteApproval',
    askId: ask.ask_id,
    prompt: clip(ask.prompt, ASK_LIMITS.prompt),
    ...targets
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
  ask_user: toAskUserPart,
  delete_approval: toDeleteApprovalPart
}

function isRenderedAskKind(kind: AskInput['kind']): kind is RenderedAskKind {
  return RENDERED_ASK_KINDS.some((rendered) => rendered === kind)
}

export function toAskPart(ask: AskInput): AskPart | undefined {
  return isRenderedAskKind(ask.kind)
    ? ASK_PART_BUILDERS[ask.kind](ask)
    : undefined
}

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
  | DeleteApprovalPart
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
