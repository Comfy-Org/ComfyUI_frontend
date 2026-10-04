import { uniqBy } from 'es-toolkit'

import type {
  AgentMessages,
  RenderedAskKind,
  TurnId
} from '../../schemas/agentApiSchema'
import {
  RENDERED_ASK_KINDS,
  zAgentAskNodeRef
} from '../../schemas/agentApiSchema'

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

/**
 * Stands in for an ask the panel cannot render, so the user sees why the turn
 * is waiting. It goes when that ask resolves.
 */
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

export interface AskUserOption {
  id: string
  label: string
  description?: string
}

/**
 * How an `ask_user` question was closed. `answered` is false when it was
 * cancelled, expired or retired without an answer this client can name.
 * `otherText` is only ever this client's own free text: the resolution frame
 * carries the winning option ids but not the text.
 */
export interface AskUserResolution {
  answered: boolean
  selected: string[]
  otherText?: string
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
  /** Set once the ask is resolved; the card then reads back the answer. */
  resolution?: AskUserResolution
}

/**
 * A canvas node a `delete_approval` would remove, as the host listed it.
 * `name` is the node's title, falling back to its type.
 */
export interface AskNodeRef {
  id: string
  name?: string
}

/** The agent asking before it deletes nodes the user added. */
export interface DeleteApprovalPart {
  type: 'deleteApproval'
  askId: string
  prompt: string
  nodes: AskNodeRef[]
  /**
   * Delete targets the card does not list (past the display cap, or
   * unreadable), so a Delete answer never covers nodes the user was not told
   * about.
   */
  hiddenNodeCount: number
  /** Set once the ask is resolved; the card then reads back the decision. */
  resolution?: AskUserResolution
}

export type AskPart = RunApprovalPart | AskUserPart | DeleteApprovalPart

export function isAskPart(part: MessagePart): part is AskPart {
  return (
    part.type === 'runApproval' ||
    part.type === 'askUser' ||
    part.type === 'deleteApproval'
  )
}

/** An ask card still waiting on the user (a resolved card is not). */
export function isPendingAskPart(part: MessagePart): part is AskPart {
  return (
    part.type === 'runApproval' ||
    (isAskPart(part) && part.resolution === undefined)
  )
}

/** The ask a part belongs to: its card or its stand-in notice. */
export function askIdOf(part: MessagePart): string | undefined {
  return isAskPart(part) || part.type === 'askUnavailable'
    ? part.askId
    : undefined
}

/**
 * The parts with ask `askId` retired: a run-approval card or the notice
 * standing in for an unrenderable ask is dropped, and an `ask_user` or
 * delete-approval card stays on screen read-only with its resolution. Returns the same array when
 * nothing changed, so callers can skip a republish.
 */
export function retireAskParts(
  parts: MessagePart[],
  askId: string,
  resolution: AskUserResolution = { answered: false, selected: [] }
): MessagePart[] {
  if (!parts.some((part) => askIdOf(part) === askId)) return parts
  return parts.flatMap((part): MessagePart[] => {
    if (askIdOf(part) !== askId) return [part]
    if (part.type !== 'askUser' && part.type !== 'deleteApproval') return []
    // A real answer outranks an earlier retirement that could not name one
    // (a 409, a lost frame), so the card ends up showing what was chosen.
    const keep =
      part.resolution && (part.resolution.answered || !resolution.answered)
    return [keep ? part : { ...part, resolution }]
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

/**
 * Bounds on what an `ask_user` frame may render. The frame is untrusted input,
 * so a runaway option list or text cannot freeze the panel.
 */
export const ASK_USER_LIMITS = {
  options: 50,
  prompt: 2000,
  label: 200,
  description: 500,
  nodes: 50
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

function toAskNodeRef(value: unknown): AskNodeRef | undefined {
  const parsed = zAgentAskNodeRef.safeParse(value)
  if (!parsed.success) return undefined
  const { id, title, type } = parsed.data
  const name = title?.trim() || type?.trim()
  return {
    id: clip(String(id), ASK_USER_LIMITS.label),
    name: name ? clip(name, ASK_USER_LIMITS.label) : undefined
  }
}

/**
 * The host's `context.nodes`: unique by id (first wins, as with options),
 * capped, and anything not listed counted as hidden. A list that is not an
 * array lists nothing.
 */
function toAskNodeRefs(
  context: AskInput['context']
): Pick<DeleteApprovalPart, 'nodes' | 'hiddenNodeCount'> {
  const raw: unknown = context?.nodes
  if (!Array.isArray(raw)) return { nodes: [], hiddenNodeCount: 0 }
  const readable = raw.flatMap((node) => toAskNodeRef(node) ?? [])
  const unique = uniqBy(readable, (node) => node.id)
  const nodes = unique.slice(0, ASK_USER_LIMITS.nodes)
  const duplicates = readable.length - unique.length
  return { nodes, hiddenNodeCount: raw.length - duplicates - nodes.length }
}

const DELETE_APPROVAL_OPTIONS = ['delete', 'keep']

/**
 * The delete decision card. It renders its own Delete and Keep buttons, so it
 * needs the host to offer exactly those two options as one required choice.
 */
function toDeleteApprovalPart(ask: AskInput): DeleteApprovalPart | undefined {
  const optionIds = ask.options.map(({ id }) => id)
  const offersDeleteOrKeep =
    optionIds.length === DELETE_APPROVAL_OPTIONS.length &&
    DELETE_APPROVAL_OPTIONS.every((id) => optionIds.includes(id)) &&
    ask.min_selections === 1 &&
    ask.max_selections === 1 &&
    !ask.allow_other
  if (!offersDeleteOrKeep) return undefined
  return {
    type: 'deleteApproval',
    askId: ask.ask_id,
    prompt: clip(ask.prompt, ASK_USER_LIMITS.prompt),
    ...toAskNodeRefs(ask.context)
  }
}

const ASK_PART_BUILDERS: Record<
  RenderedAskKind,
  (ask: AskInput) => AskPart | undefined
> = {
  run_approval: (ask) => ({
    type: 'runApproval',
    askId: ask.ask_id,
    workflowId: ask.context?.workflow_id || undefined,
    workflowName: ask.context?.workflow_name || undefined
  }),
  ask_user: toAskUserPart,
  delete_approval: toDeleteApprovalPart
}

export function isRenderedAskKind(kind: unknown): kind is RenderedAskKind {
  return RENDERED_ASK_KINDS.some((rendered) => rendered === kind)
}

/**
 * The card for an ask, by its explicit kind. An unknown or missing kind maps to
 * nothing: a privileged ask that lost its discriminator must not render as a
 * generic chooser.
 */
export function toAskPart(ask: AskInput): AskPart | undefined {
  return isRenderedAskKind(ask.kind)
    ? ASK_PART_BUILDERS[ask.kind](ask)
    : undefined
}

/**
 * The ask's card, or a stand-in notice when it cannot be rendered, so the
 * user sees why the turn is waiting instead of an invisible prompt.
 */
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
