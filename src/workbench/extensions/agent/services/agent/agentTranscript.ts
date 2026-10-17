import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import {
  toTurnId,
  zPersistedToolCallSummary
} from '../../schemas/agentApiSchema'
import type { WorkflowReference } from '../../types/workflowReference'
import type { SkillReference } from '../../types/skillReference'
import { parseSkillReferenceText } from '../../utils/skillReferenceText'
import { parseWorkflowReferences } from '../../utils/workflowReferenceText'
import type { AssistantMessage, ToolPart } from './agentMessageParts'
import {
  createAssistantMessage,
  isOpenAskPart,
  toAskOrNoticePart
} from './agentMessageParts'

type AttachmentKind = 'image' | 'video' | 'audio'

/**
 * A file attached to a user turn. `previewUrl` and `mediaUrl` are captured
 * when the turn is sent and are not rehydrated; without them, `ref`, the
 * uploaded input-namespace filename, resolves the file. `name` is the label
 * shown to the user; it falls back to `ref` for legacy/unresolved rows and
 * otherwise comes from the persisted asset `display_name`.
 *
 * `id` and `kind` are the server's own resolution of that name, replayed off
 * the row's `attachment_refs`. `kind` is what lets a rehydrated attachment be
 * classified when its name cannot classify itself — a library asset is
 * attached under its content hash, which carries no extension to read a kind
 * off. `id` identifies the asset behind that same hash.
 */
export interface UserAttachment {
  name: string
  previewUrl?: string
  mediaUrl?: string
  ref?: string
  id?: string
  kind?: AttachmentKind
}

type ParsedAttachmentRef = Pick<UserAttachment, 'id' | 'kind'> & {
  ref: string
  key: string
  displayName?: string
}

export interface NormalizedAgentTranscript {
  /** Includes placeholders for turns without assistant text. */
  messages: AssistantMessage[]
  userTexts: Map<TurnId, string>
  userAttachments: Map<TurnId, UserAttachment[]>
  userWorkflowReferences: Map<TurnId, WorkflowReference[]>
  userSkillReferences: Map<TurnId, SkillReference>
  latestWorkflowId?: string
  rowIds: Set<string>
  /** Tracks turns with assistant rows, including rows that produce no parts. */
  assistantTurnIds: Set<TurnId>
  pending?: {
    messageId: TurnId
    message: AssistantMessage
  }
}

function isNamedAttachment(name: unknown): name is string {
  return typeof name === 'string' && name.trim() !== ''
}

function attachmentId(entry: object): Pick<UserAttachment, 'id'> {
  if (!('id' in entry) || typeof entry.id !== 'string' || entry.id === '')
    return {}
  return { id: entry.id }
}

function attachmentKind(entry: object): Pick<UserAttachment, 'kind'> {
  if (!('kind' in entry) || !isAttachmentKind(entry.kind)) return {}
  return { kind: entry.kind }
}

function attachmentDisplayName(
  entry: object
): Pick<ParsedAttachmentRef, 'displayName'> {
  if (!('display_name' in entry) || !isNamedAttachment(entry.display_name))
    return {}
  return { displayName: entry.display_name }
}

function parseAttachmentRef(entry: unknown): ParsedAttachmentRef | undefined {
  if (typeof entry !== 'object' || entry === null || !('name' in entry))
    return undefined
  if (!isNamedAttachment(entry.name)) return undefined

  return {
    ref: entry.name,
    key: entry.name.trim(),
    ...attachmentId(entry),
    ...attachmentKind(entry),
    ...attachmentDisplayName(entry)
  }
}

function parseAttachmentRefs(value: unknown): ParsedAttachmentRef[] {
  if (!Array.isArray(value)) return []
  const entries: unknown[] = value
  return entries.flatMap((entry) => {
    const parsed = parseAttachmentRef(entry)
    return parsed ? [parsed] : []
  })
}

function isAttachmentKind(value: unknown): value is AttachmentKind {
  return value === 'image' || value === 'video' || value === 'audio'
}

function parseUserAttachments(
  content: Record<string, unknown> | undefined
): UserAttachment[] | undefined {
  const refs = parseAttachmentRefs(content?.attachment_refs)
  const resolved = new Map<string, ParsedAttachmentRef>()
  for (const entry of refs) {
    if (!resolved.has(entry.key)) resolved.set(entry.key, entry)
  }
  const rawAttachments: unknown = content?.attachments
  let postedNames: string[] | undefined
  if (Array.isArray(rawAttachments)) {
    const entries: unknown[] = rawAttachments
    postedNames = entries.filter(isNamedAttachment)
  }
  const names = postedNames ?? refs.map(({ ref }) => ref)
  return names.length > 0
    ? names.map((ref) => {
        const match = resolved.get(ref.trim())
        return {
          name: match?.displayName ?? ref,
          ref,
          ...(match?.id ? { id: match.id } : {}),
          ...(match?.kind ? { kind: match.kind } : {})
        }
      })
    : undefined
}

/**
 * A persisted user row's `workflow_references` are `{workflow_id, name,
 * unavailable?}` entries describing workflows the user @-referenced in their
 * message text. Parsing them rewrites the display text (dropping the raw
 * reference markup) and yields the structured references the UI renders as
 * chips, so this returns both together or `undefined` when there is nothing
 * to apply.
 */
function parseUserWorkflowReferences(
  text: string,
  rawReferences: unknown
): { text: string; references: WorkflowReference[] } | undefined {
  if (!Array.isArray(rawReferences)) return undefined
  const references = (rawReferences as unknown[]).flatMap((value) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('workflow_id' in value) ||
      !('name' in value)
    )
      return []
    const { workflow_id: id, name } = value
    return typeof id === 'string' && typeof name === 'string'
      ? [
          {
            id,
            name,
            ...('unavailable' in value && value.unavailable === true
              ? { unavailable: true }
              : {})
          }
        ]
      : []
  })
  return references.length > 0
    ? parseWorkflowReferences(text, references)
    : undefined
}

/**
 * A persisted tool-call status is `pending`/`running` while it was still in
 * flight when a dead turn ended, and terminal (`success`/`error`, or the
 * older `ok` success alias — see `toolCallOk`) otherwise.
 *
 * A restored (non-live) row has no transport left to ever settle its tool
 * parts, so a `pending`/`running` status there is clamped straight to
 * `done` (never rendered as a perpetual-progress chip) rather than left
 * spinning forever; only `isLive` (the row is the one actively backed by a
 * live transport — the run_approval mid-ask case) keeps it `streaming`.
 */
function toolCallPartState(
  status: unknown,
  isLive: boolean
): ToolPart['state'] {
  const inProgress = status === 'pending' || status === 'running'
  return inProgress && isLive ? 'streaming' : 'done'
}

/**
 * `undefined` while the call is still genuinely in progress (matching the
 * live path, which omits `ok` until a terminal status arrives); once the
 * part is in a `done` state, `success` and the older `ok` success alias
 * both count as success. `'ok'` is a reload-only legacy alias, not something
 * the live path ever produces or recognizes: `zAgentToolCallData.status` in
 * `agentApiSchema.ts` is `z.enum(['running', 'success', 'error'])`, and the
 * live resolver (`resolveToolCallState` in `agentEventTransport.ts`) only
 * checks `status === 'success'` — it only ever appears on rows persisted
 * before that alias was retired. Everything else, including a restored
 * `pending`/`running` call that had no live transport to finish it, reads as
 * failure rather than being rendered as if it succeeded.
 */
function toolCallOk(
  status: unknown,
  state: ToolPart['state']
): boolean | undefined {
  if (state === 'streaming') return undefined
  return status === 'success' || status === 'ok'
}

/** A parsed tool-call entry, carrying the raw persisted `status` alongside
 * the `ToolPart` it produced so the turn-wide dedupe in
 * `appendAssistantContent` can tell a clamped-but-still-non-terminal entry
 * apart from a genuinely terminal one — information the `ToolPart` itself no
 * longer carries once `pending`/`running` has been clamped to `done`. */
interface ParsedToolCall {
  part: ToolPart
  status: unknown
}

/** `true` when a live row's entry has no real `tool_call_id` to key on
 * (missing, null, or empty). A live row will still receive a live
 * `agent_tool_call` frame for this call, keyed by its real `tool_call_id`;
 * seeding a part here under the audit row's own `id` instead would leave a
 * duplicate chip behind that the later live frame can never reach, stuck
 * `streaming` forever — the caller drops the entry rather than seed it. */
function isLiveEntryMissingToolCallId(
  isLive: boolean,
  toolCallId: string | null | undefined
): boolean {
  return isLive && !toolCallId
}

/** `rawDuration` restricted to a finite, non-negative number; `undefined`
 * for anything else (negative, `NaN`, `Infinity`, `null`). */
function parseDurationMs(
  rawDuration: number | null | undefined
): number | undefined {
  return typeof rawDuration === 'number' &&
    Number.isFinite(rawDuration) &&
    rawDuration >= 0
    ? rawDuration
    : undefined
}

/** The optional `ToolPart` fields that only appear when they have a value:
 * `ok` once the call is done, `skill` when non-empty, `durationMs` once
 * resolved to a finite, non-negative number. */
function toolPartOptionalFields(
  ok: boolean | undefined,
  skill: string | null | undefined,
  durationMs: number | undefined
): Pick<Partial<ToolPart>, 'ok' | 'skill' | 'durationMs'> {
  return {
    ...(ok !== undefined ? { ok } : {}),
    ...(skill ? { skill } : {}),
    ...(durationMs !== undefined ? { durationMs } : {})
  }
}

/**
 * Validates one `content.tool_calls` entry against `zPersistedToolCallSummary`,
 * picking only the fields this function actually reads (`id`/`tool_call_id`,
 * `tool_name`, `status`, `duration_ms`, `skill`) so an unrelated field a real
 * historical row gets wrong or omits (e.g. `started_at`/`finished_at`,
 * which are never read) can't sink an otherwise-usable entry. Maps a valid
 * entry onto the same `ToolPart` the live WebSocket path builds from
 * `agent_tool_call` events, so a reloaded transcript renders through the
 * identical work-summary UI as a live turn. `undefined` for anything that
 * doesn't validate (missing `id`/`tool_name`, wrong types, ...) or for a live
 * row's id-only entry (see `isLiveEntryMissingToolCallId`).
 */
function parseToolCallEntry(
  entry: unknown,
  isLive: boolean
): ParsedToolCall | undefined {
  const parsed = zPersistedToolCallSummary
    .pick({
      id: true,
      tool_call_id: true,
      tool_name: true,
      status: true,
      duration_ms: true,
      skill: true
    })
    .safeParse(entry)
  if (!parsed.success) return undefined
  const {
    id,
    tool_call_id: toolCallId,
    tool_name: toolName,
    status,
    skill,
    duration_ms: rawDuration
  } = parsed.data
  if (isLiveEntryMissingToolCallId(isLive, toolCallId)) return undefined
  const state = toolCallPartState(status, isLive)
  const ok = toolCallOk(status, state)
  const durationMs = parseDurationMs(rawDuration)
  return {
    status,
    part: {
      type: 'tool',
      // A live `agent_tool_call` frame keys its update on `tool_call_id`, not
      // this row's own `id` — prefer it so a restored part matches a live
      // frame that arrives for it later. Falls back to `id` only for rows
      // recorded before `tool_call_id` existed; `||`, not `??`, so an empty
      // string (as genuinely id-less as a missing field) falls back too
      // instead of colliding every empty-`tool_call_id` entry on `''`.
      callId: toolCallId || id,
      name: toolName,
      state,
      ...toolPartOptionalFields(ok, skill, durationMs)
    }
  }
}

/**
 * A persisted assistant row's `tool_calls` entries are parsed through
 * `parseToolCallEntry`. A repeated `id` within the list is deduped, keeping
 * the last entry's data at the first entry's position, matching how the
 * live path updates a part in place rather than appending.
 */
function parseToolCalls(
  content: Record<string, unknown> | undefined,
  isLive: boolean
): ParsedToolCall[] | undefined {
  const raw = content?.tool_calls
  if (!Array.isArray(raw)) return undefined
  const parsedByCallId = new Map<string, ParsedToolCall>()
  for (const entry of raw as unknown[]) {
    const parsed = parseToolCallEntry(entry, isLive)
    if (parsed) parsedByCallId.set(parsed.part.callId, parsed)
  }
  return parsedByCallId.size > 0 ? [...parsedByCallId.values()] : undefined
}

/** A persisted tool-call `status` of `pending`/`running` is still in flight;
 * anything else (`success`/`error`/`ok`, or an unrecognized string) is
 * terminal — settled for good, independent of `isLive` clamping. This
 * includes `undefined`: a tool part that reached `message.parts` through a
 * path this module doesn't track in `toolCallStatusByMessage` has no known
 * status, and the conservative default is to treat it as already settled so
 * `appendAssistantContent`'s dedupe never overwrites it. */
function isTerminalStatus(status: unknown): boolean {
  return status !== 'pending' && status !== 'running'
}

/** Per-message memory of each tool call's last-applied raw `status`, keyed by
 * `callId`. `appendAssistantContent` consults and updates this across a
 * turn's rows (a turn can span several assistant rows) so a later row's
 * terminal status can overwrite an earlier row's still-non-terminal part for
 * the same call, instead of the position-preserving dedupe below always
 * keeping whichever row it saw first. */
const toolCallStatusByMessage = new WeakMap<
  AssistantMessage,
  Map<string, unknown>
>()

/**
 * Appends a persisted assistant row's tool-call and text parts onto its
 * running message. `isLive` is true when the row is the one that will be
 * handed a live `AgentEventTransport` — the row the server still reports as
 * `streaming` — so its still-in-flight tool parts may legitimately stay
 * `streaming`.
 *
 * `message.parts` is shared across every assistant row of one turn (via
 * `assistants.get(turnId)` in `recordAssistantRow`), but `parseToolCalls`
 * only dedupes within one row's own list — two rows of the same turn that
 * each carry the same `callId` would otherwise still produce two separate
 * `ToolPart`s. Dedupe is hoisted here to the message level: a parsed part
 * whose `callId` already appears in `message.parts` normally keeps the
 * earlier part's position and data (matching the live path's turn-wide
 * keying), *unless* the earlier part's status was still non-terminal
 * (`pending`/`running`) and this row's is terminal — e.g. a row recorded
 * while a call was paused on a run-approval ask, followed by a later row
 * that settled it — in which case the later, terminal entry replaces the
 * earlier one in place rather than losing to it.
 */
function appendAssistantContent(
  message: AssistantMessage,
  row: AgentMessages[number],
  text: string,
  isLive: boolean
): void {
  const toolCalls = parseToolCalls(row.content, isLive)
  if (toolCalls) {
    let statusByCallId = toolCallStatusByMessage.get(message)
    if (!statusByCallId) {
      statusByCallId = new Map()
      toolCallStatusByMessage.set(message, statusByCallId)
    }
    let parts = message.parts
    const appended: ToolPart[] = []
    for (const { part, status } of toolCalls) {
      const existingIndex = parts.findIndex(
        (existing) =>
          existing.type === 'tool' && existing.callId === part.callId
      )
      if (existingIndex === -1) {
        appended.push(part)
        statusByCallId.set(part.callId, status)
        continue
      }
      const existingStatus = statusByCallId.get(part.callId)
      if (!isTerminalStatus(existingStatus) && isTerminalStatus(status)) {
        parts = parts.map((existing, index) =>
          index === existingIndex ? part : existing
        )
        statusByCallId.set(part.callId, status)
      }
    }
    message.parts = appended.length > 0 ? [...parts, ...appended] : parts
  }
  if (text)
    message.parts = [...message.parts, { type: 'text', text, state: 'done' }]
}

function applyAssistantRow(
  row: AgentMessages[number],
  message: AssistantMessage,
  text: string
): NormalizedAgentTranscript['pending'] {
  const isLive = row.status === 'streaming'
  message.streaming = isLive
  appendAssistantContent(message, row, text, isLive)

  if (!isLive) return undefined

  if (row.pending_ask) message.parts.push(toAskOrNoticePart(row.pending_ask))
  return { messageId: toTurnId(row.id), message }
}

/**
 * A persisted user row's text/attachment/workflow-reference/workflow-target
 * fields, resolved from `row.content` and ready for the caller to record
 * onto its per-turn maps and `latestWorkflowId`.
 */
interface UserRowUpdate {
  text: string
  attachments?: UserAttachment[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReference
  workflowId?: string
}

function applyUserRow(row: AgentMessages[number], text: string): UserRowUpdate {
  const referenceUpdate = parseUserWorkflowReferences(
    text,
    row.content?.workflow_references
  )
  const prompt = parseSkillReferenceText(
    referenceUpdate?.text ?? text,
    referenceUpdate?.references
  )
  return {
    text: prompt.text,
    attachments: parseUserAttachments(row.content),
    workflowReferences: referenceUpdate ? prompt.workflowReferences : undefined,
    skillReference: prompt.skillReference,
    workflowId: row.workflow_id || undefined
  }
}

/** Adds `turnId` to the stable turn ordering the first time it is seen. */
function recordTurnOrder(
  turnId: TurnId,
  seenTurns: Set<TurnId>,
  turnOrder: TurnId[]
): void {
  if (seenTurns.has(turnId)) return
  seenTurns.add(turnId)
  turnOrder.push(turnId)
}

/**
 * Resolves a user row's update and records it onto the per-turn maps.
 * Returns the row's `workflow_id`, if any, for the caller to fold into
 * `latestWorkflowId`.
 */
function recordUserRow(
  row: AgentMessages[number],
  turnId: TurnId,
  text: string,
  userTexts: Map<TurnId, string>,
  userAttachments: Map<TurnId, UserAttachment[]>,
  userWorkflowReferences: Map<TurnId, WorkflowReference[]>,
  userSkillReferences: Map<TurnId, SkillReference>
): string | undefined {
  const update = applyUserRow(row, text)
  userTexts.set(turnId, update.text)
  if (update.attachments) userAttachments.set(turnId, update.attachments)
  if (update.workflowReferences)
    userWorkflowReferences.set(turnId, update.workflowReferences)
  if (update.skillReference)
    userSkillReferences.set(turnId, update.skillReference)
  else userSkillReferences.delete(turnId)
  return update.workflowId
}

function recordAssistantRow(
  row: AgentMessages[number],
  turnId: TurnId,
  text: string,
  assistants: Map<TurnId, AssistantMessage>
): NormalizedAgentTranscript['pending'] {
  const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
  const rowPending = applyAssistantRow(row, message, text)
  assistants.set(turnId, message)
  return rowPending
}

export function settleLiveMessage(message: AssistantMessage): void {
  message.streaming = false
  message.parts = message.parts.filter((part) => !isOpenAskPart(part))
  for (const part of message.parts) {
    if (part.type !== 'tool' || part.state !== 'streaming') continue
    part.state = 'done'
    part.ok ??= false
  }
}

/**
 * The live turn the transcript may restore: only the thread's newest turn can
 * still be running, and within that turn only its own newest assistant row
 * decides. A `streaming` row that any later row has moved past — a newer turn's
 * or its own turn's — is a stale write, and restoring it would hand the
 * composer a turn nothing will ever settle.
 */
function liveTranscriptTurn(
  pendingByTurn: Map<TurnId, NormalizedAgentTranscript['pending']>,
  assistants: Map<TurnId, AssistantMessage>
): NormalizedAgentTranscript['pending'] {
  const liveTurn = [...assistants.keys()].at(-1)
  return liveTurn === undefined ? undefined : pendingByTurn.get(liveTurn)
}

export function normalizeAgentTranscript(
  history: AgentMessages
): NormalizedAgentTranscript {
  const userTexts = new Map<TurnId, string>()
  const userAttachments = new Map<TurnId, UserAttachment[]>()
  const userWorkflowReferences = new Map<TurnId, WorkflowReference[]>()
  const userSkillReferences = new Map<TurnId, SkillReference>()
  const assistants = new Map<TurnId, AssistantMessage>()
  const turnOrder: TurnId[] = []
  const seenTurns = new Set<TurnId>()
  const rowIds = new Set<string>()
  const pendingByTurn = new Map<TurnId, NormalizedAgentTranscript['pending']>()
  let latestWorkflowId: string | undefined

  for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
    const turnId = row.turn_id as TurnId
    rowIds.add(row.id)
    recordTurnOrder(turnId, seenTurns, turnOrder)
    const text = typeof row.content?.text === 'string' ? row.content.text : ''
    if (row.role === 'user') {
      const workflowId = recordUserRow(
        row,
        turnId,
        text,
        userTexts,
        userAttachments,
        userWorkflowReferences,
        userSkillReferences
      )
      if (workflowId) latestWorkflowId = workflowId
    }
    if (row.role === 'assistant') {
      pendingByTurn.set(
        turnId,
        recordAssistantRow(row, turnId, text, assistants)
      )
    }
  }

  const live = liveTranscriptTurn(pendingByTurn, assistants)
  const messages = turnOrder.map((turnId) => {
    const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
    if (message === live?.message) message.streaming = true
    else settleLiveMessage(message)
    return message
  })

  return {
    messages,
    userTexts,
    userAttachments,
    userWorkflowReferences,
    userSkillReferences,
    latestWorkflowId,
    rowIds,
    assistantTurnIds: new Set(assistants.keys()),
    pending: live
  }
}
