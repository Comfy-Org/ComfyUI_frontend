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
 * How an ask was closed. The server decides `answered` (naming the committed
 * answer as far as it reported it; `selected` may be empty) and `closed`
 * (cancelled or expired). The client alone decides `unknown` (it sent an
 * answer but could not confirm the server took it) and `retired` (it stopped
 * waiting knowing nothing, e.g. a 409 or the turn ending).
 */
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

/**
 * Whether `next` should replace the resolution a card already shows. What the
 * server decided outranks anything this client guessed, and a local guess
 * never replaces the server's. Between two server reports, one that names the
 * answer replaces one that did not.
 */
function supersedes(
  next: AskUserResolution,
  shown: AskUserResolution
): boolean {
  const rank = RESOLUTION_RANK[next.status] - RESOLUTION_RANK[shown.status]
  if (rank !== 0) return rank > 0
  return isServerDecided(next) && !namesAnswer(shown) && namesAnswer(next)
}

/**
 * The resolution an ask ends up with when `next` arrives after `shown`: the
 * same rule a card on screen follows, for anything that keeps a resolution.
 */
export function settleResolution(
  shown: AskUserResolution | undefined,
  next: AskUserResolution = { status: 'retired', selected: [] }
): AskUserResolution {
  return shown === undefined || supersedes(next, shown) ? next : shown
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

export type AskPart = RunApprovalPart | AskUserPart

export function isAskPart(part: MessagePart): part is AskPart {
  return part.type === 'runApproval' || part.type === 'askUser'
}

/** An ask card still waiting on the user (a resolved `ask_user` card is not). */
export function isPendingAskPart(part: MessagePart): part is AskPart {
  return (
    part.type === 'runApproval' ||
    (part.type === 'askUser' && part.resolution === undefined)
  )
}

/**
 * A part still waiting on an answer: a pending card or the notice standing in
 * for one. Only a live turn's transport can settle it, so a settled turn drops
 * it rather than keep an answerable form.
 */
export function isOpenAskPart(part: MessagePart): boolean {
  return isPendingAskPart(part) || part.type === 'askUnavailable'
}

/** The ask a part belongs to: its card or its stand-in notice. */
export function askIdOf(part: MessagePart): string | undefined {
  return isAskPart(part) || part.type === 'askUnavailable'
    ? part.askId
    : undefined
}

/**
 * The parts with ask `askId` retired: a run-approval card or the notice
 * standing in for an unrenderable ask is dropped, and an `ask_user` card
 * stays on screen read-only with its resolution. Returns the same array when
 * nothing changed, so callers can skip a republish.
 */
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
  ask_user: toAskUserPart
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
