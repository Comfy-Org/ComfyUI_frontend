import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import { zPersistedToolCallSummary } from '../../schemas/agentApiSchema'
import type { WorkflowReference } from '../../types/workflowReference'
import { parseWorkflowReferences } from '../../utils/workflowReferenceText'
import type { AssistantMessage, ToolPart } from './agentMessageParts'
import { createAssistantMessage } from './agentMessageParts'

/**
 * A file attached to a user turn. `ref` is the uploaded input-namespace
 * filename that resolves the preview; on a persisted row this is the only
 * name the server ever saw, so `name` and `ref` are the same string.
 */
export interface UserAttachment {
  name: string
  previewUrl?: string
  ref?: string
}

export interface NormalizedAgentTranscript {
  /** Includes placeholders for turns without assistant text. */
  messages: AssistantMessage[]
  userTexts: Map<TurnId, string>
  userAttachments: Map<TurnId, UserAttachment[]>
  userWorkflowReferences: Map<TurnId, WorkflowReference[]>
  latestWorkflowId?: string
  rowIds: Set<string>
  /** Tracks turns with assistant rows, including rows that produce no parts. */
  assistantTurnIds: Set<TurnId>
  pending?: {
    messageId: TurnId
    message: AssistantMessage
  }
}

function attachmentRefNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || !('name' in entry))
      return []
    const { name } = entry
    return typeof name === 'string' ? [name] : []
  })
}

/**
 * A persisted user row carries `attachments` (the uploaded input filenames
 * from the original request) and `attachment_refs` (the server's own
 * resolution of those same filenames, as `{name, id?, kind?}`). Either one
 * names the same input-namespace filenames the live send path uses as
 * `SentAttachment.ref`, so either is enough to rebuild the preview grid.
 */
function parseUserAttachments(
  content: Record<string, unknown> | undefined
): UserAttachment[] | undefined {
  const names = Array.isArray(content?.attachments)
    ? content.attachments.filter(
        (name): name is string => typeof name === 'string'
      )
    : attachmentRefNames(content?.attachment_refs)
  return names.length > 0
    ? names.map((name) => ({ name, ref: name }))
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
 * flight when the turn ended, and some terminal string otherwise (`ok`,
 * `success`, `error`, `failed`, `cancelled`, `timeout`, ...) — the exact
 * terminal vocabulary is not yet settled between the backend's persisted and
 * live wire formats, so anything other than `pending`/`running` is treated as
 * terminal here.
 *
 * A restored (non-live) row has no transport left to ever settle its tool
 * parts, so a `pending`/`running` status there would otherwise spin forever;
 * only `isLive` (the row is backed by a live transport or recovery polling)
 * keeps it in `streaming` state.
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
 * part is in a `done` state, only `ok`/`success` counts as success — every
 * other terminal string, including a restored `pending`/`running` call that
 * had no live transport to finish it, reads as failure rather than being
 * rendered as if it succeeded.
 */
function toolCallOk(
  status: unknown,
  state: ToolPart['state']
): boolean | undefined {
  if (state === 'streaming') return undefined
  return status === 'ok' || status === 'success'
}

/**
 * Validates one `content.tool_calls` entry against `zPersistedToolCallSummary`
 * and maps it onto the same `ToolPart` the live WebSocket path builds from
 * `agent_tool_call` events, so a reloaded transcript renders through the
 * identical work-summary UI as a live turn. `undefined` for anything that
 * doesn't validate (missing `id`/`tool_name`, wrong types, ...).
 */
function parseToolCallEntry(
  entry: unknown,
  isLive: boolean
): ToolPart | undefined {
  const parsed = zPersistedToolCallSummary.safeParse(entry)
  if (!parsed.success) return undefined
  const {
    id,
    tool_call_id: toolCallId,
    tool_name: toolName,
    status,
    duration_ms: rawDuration
  } = parsed.data
  const state = toolCallPartState(status, isLive)
  const ok = toolCallOk(status, state)
  const durationMs =
    typeof rawDuration === 'number' &&
    Number.isFinite(rawDuration) &&
    rawDuration >= 0
      ? rawDuration
      : undefined
  return {
    type: 'tool',
    // A live `agent_tool_call` frame keys its update on `tool_call_id`, not
    // this row's own `id` — prefer it so a restored part matches a live
    // frame that arrives for it later. Falls back to `id` only for rows
    // recorded before `tool_call_id` existed.
    callId: toolCallId ?? id,
    name: toolName,
    state,
    ...(ok !== undefined ? { ok } : {}),
    ...(durationMs !== undefined ? { durationMs } : {})
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
): ToolPart[] | undefined {
  const raw = content?.tool_calls
  if (!Array.isArray(raw)) return undefined
  const parts = new Map<string, ToolPart>()
  for (const entry of raw as unknown[]) {
    const part = parseToolCallEntry(entry, isLive)
    if (part) parts.set(part.callId, part)
  }
  return parts.size > 0 ? [...parts.values()] : undefined
}

/**
 * Appends a persisted assistant row's tool-call and text parts onto its
 * running message. `isLive` is true when this row will be handed a live
 * `AgentEventTransport` or recovery polling, so
 * its still-in-flight tool parts may legitimately stay `streaming`.
 *
 * `message.parts` is shared across every assistant row of one turn (via
 * `assistants.get(turnId)` in `recordAssistantRow`), but `parseToolCalls`
 * only dedupes within one row's own list — two rows of the same turn that
 * each carry the same `callId` would otherwise still produce two separate
 * `ToolPart`s. Dedupe is hoisted here to the message level — a parsed part
 * whose `callId` already appears in `message.parts` is dropped — matching
 * the live path's turn-wide keying.
 */
function appendAssistantContent(
  message: AssistantMessage,
  row: AgentMessages[number],
  text: string,
  isLive: boolean
): void {
  const toolCalls = parseToolCalls(row.content, isLive)
  if (toolCalls) {
    const existingCallIds = new Set(
      message.parts.flatMap((part) =>
        part.type === 'tool' ? [part.callId] : []
      )
    )
    const newToolCalls = toolCalls.filter(
      (part) => !existingCallIds.has(part.callId)
    )
    message.parts = [...message.parts, ...newToolCalls]
  }
  if (text)
    message.parts = [...message.parts, { type: 'text', text, state: 'done' }]
}

/**
 * A row's `pending_ask` carries a `run_approval` context only while that row
 * is still mid-ask; this reads it into the flat shape the `runApproval` part
 * renders, or `undefined` once the ask is resolved or absent.
 */
function pendingRunApproval(
  row: AgentMessages[number]
): { askId: string; workflowId?: string; workflowName?: string } | undefined {
  const ask = row.pending_ask
  if (ask?.kind !== 'run_approval') return undefined
  return {
    askId: ask.ask_id,
    workflowId: ask.context?.workflow_id || undefined,
    workflowName: ask.context?.workflow_name || undefined
  }
}

/**
 * Applies one persisted assistant row onto its running message: appends any
 * parsed tool-call parts and text part, then, when the row is mid-ask,
 * attaches a `runApproval` part. Streaming rows remain pending recovery.
 * Returns the `pending` entry to record when the row is streaming, or
 * `undefined` otherwise.
 */
function applyAssistantRow(
  row: AgentMessages[number],
  message: AssistantMessage,
  text: string
): NormalizedAgentTranscript['pending'] {
  message.streaming = row.status === 'streaming'
  const runApproval =
    row.status === 'streaming' ? pendingRunApproval(row) : undefined
  appendAssistantContent(message, row, text, message.streaming)

  if (!message.streaming) return undefined

  if (runApproval) message.parts.push({ type: 'runApproval', ...runApproval })
  return { messageId: row.id as TurnId, message }
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
  workflowId?: string
}

function applyUserRow(row: AgentMessages[number], text: string): UserRowUpdate {
  const referenceUpdate = parseUserWorkflowReferences(
    text,
    row.content?.workflow_references
  )
  return {
    text: referenceUpdate?.text ?? text,
    attachments: parseUserAttachments(row.content),
    workflowReferences: referenceUpdate?.references,
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
  userWorkflowReferences: Map<TurnId, WorkflowReference[]>
): string | undefined {
  const update = applyUserRow(row, text)
  userTexts.set(turnId, update.text)
  if (update.attachments) userAttachments.set(turnId, update.attachments)
  if (update.workflowReferences)
    userWorkflowReferences.set(turnId, update.workflowReferences)
  return update.workflowId
}

/**
 * Applies an assistant row onto its turn's running message and records it
 * onto `assistants`. Returns the row's `pending` entry, if it is streaming.
 */
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

export function normalizeAgentTranscript(
  history: AgentMessages
): NormalizedAgentTranscript {
  const userTexts = new Map<TurnId, string>()
  const userAttachments = new Map<TurnId, UserAttachment[]>()
  const userWorkflowReferences = new Map<TurnId, WorkflowReference[]>()
  const assistants = new Map<TurnId, AssistantMessage>()
  const turnOrder: TurnId[] = []
  const seenTurns = new Set<TurnId>()
  const rowIds = new Set<string>()
  let pending: NormalizedAgentTranscript['pending']
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
        userWorkflowReferences
      )
      if (workflowId) latestWorkflowId = workflowId
    }
    if (row.role === 'assistant') {
      const rowPending = recordAssistantRow(row, turnId, text, assistants)
      if (rowPending) pending = rowPending
    }
  }

  const messages = turnOrder.map((turnId) => {
    const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
    message.streaming = message === pending?.message
    return message
  })

  return {
    messages,
    userTexts,
    userAttachments,
    userWorkflowReferences,
    latestWorkflowId,
    rowIds,
    assistantTurnIds: new Set(assistants.keys()),
    pending
  }
}
