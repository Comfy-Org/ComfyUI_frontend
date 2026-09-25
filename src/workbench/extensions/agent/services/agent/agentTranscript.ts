import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import type { WorkflowReference } from '../../types/workflowReference'
import { parseWorkflowReferences } from '../../utils/workflowReferenceText'
import type { AssistantMessage } from './agentMessageParts'
import {
  createAssistantMessage,
  isAskPart,
  toAskOrNoticePart
} from './agentMessageParts'

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
    if (!seenTurns.has(turnId)) {
      seenTurns.add(turnId)
      turnOrder.push(turnId)
    }
    const text = typeof row.content?.text === 'string' ? row.content.text : ''
    if (row.role === 'user') {
      userTexts.set(turnId, text)
      const attachments = parseUserAttachments(row.content)
      if (attachments) userAttachments.set(turnId, attachments)
      if (row.workflow_id) latestWorkflowId = row.workflow_id
      const referenceUpdate = parseUserWorkflowReferences(
        text,
        row.content?.workflow_references
      )
      if (referenceUpdate) {
        userTexts.set(turnId, referenceUpdate.text)
        userWorkflowReferences.set(turnId, referenceUpdate.references)
      }
    }
    if (row.role === 'assistant') {
      const message = assistants.get(turnId) ?? createAssistantMessage(turnId)
      message.streaming = false
      if (text)
        message.parts = [
          ...message.parts,
          { type: 'text', text, state: 'done' }
        ]
      // A pending ask of any kind the contract allows comes back as its card
      // and keeps the turn live; anything else comes back as a notice.
      const pendingAsk =
        row.status === 'streaming' && row.pending_ask
          ? toAskOrNoticePart(row.pending_ask)
          : undefined
      if (pendingAsk) message.parts.push(pendingAsk)
      if (pendingAsk && isAskPart(pendingAsk)) {
        message.streaming = true
        pending = {
          messageId: row.id as TurnId,
          message
        }
      }
      assistants.set(turnId, message)
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
