/**
 * In-App Agent protocol (prototype — ADR-0011).
 *
 * The cross-repo contract between the frontend (TS) and the server-side agent
 * (Go, `Comfy-Org/cloud`). Inbound requests go to ingest `/api/agent/*`;
 * outbound events arrive over the existing Redis-PubSub -> WebSocket bridge on
 * `channel:ws:{workspaceId}:u:{userId}`.
 *
 * This is the single TS definition of that contract; it should be kept in sync
 * with the Go side (open question: where the schema lives + how drift is caught).
 */

export type WorkflowId = string
export type ThreadId = string
export type MessageId = string
export type NodeId = string

/** Full save-format graph. Opaque here; validated by the workflow schema layer. */
export type WorkflowGraph = Record<string, unknown>

// ---------------------------------------------------------------------------
// Inbound: browser -> agent
// ---------------------------------------------------------------------------

/** Where an agent write lands (ADR-0001). */
export type AgentWriteTarget = 'active' | 'new_tab'

export interface AgentTurnRequest {
  content: string
  /** Selected node ids — the awareness input (ADR-0003). */
  selection?: NodeId[]
  /** Uploaded asset ids referenced by the turn. */
  attachments?: string[]
  target?: AgentWriteTarget
  /** The tab's current draft version when `target === 'active'` (ADR-0005). */
  baseVersion?: number
}

// ---------------------------------------------------------------------------
// Outbound: agent -> browser
// ---------------------------------------------------------------------------

export type AgentToolCallStatus = 'running' | 'success' | 'error'

interface AgentEventBase {
  threadId: ThreadId
  messageId: MessageId
}

export interface AgentMessageDeltaEvent extends AgentEventBase {
  type: 'agent_message_delta'
  delta: string
}

export interface AgentToolCallEvent extends AgentEventBase {
  type: 'agent_tool_call'
  toolCallId: string
  toolName: string
  status: AgentToolCallStatus
  durationMs?: number
  errorCode?: string
}

/** A graph write: full-document replace guarded by `version` (ADR-0004). */
export interface DraftPatchEvent extends AgentEventBase {
  type: 'draft_patch'
  workflowId: WorkflowId
  content: WorkflowGraph
  /** The new authoritative version after the agent's CAS commit. */
  version: number
  /** The version the agent started from; compared against the tab (ADR-0005). */
  baseVersion: number
}

export interface AgentMessageDoneEvent extends AgentEventBase {
  type: 'agent_message_done'
  tokenUsage?: { input: number; output: number }
}

export type AgentEvent =
  | AgentMessageDeltaEvent
  | AgentToolCallEvent
  | DraftPatchEvent
  | AgentMessageDoneEvent

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type WithBase = Record<string, unknown> & {
  threadId: string
  messageId: string
}

function hasBase(value: Record<string, unknown>): value is WithBase {
  return (
    typeof value.threadId === 'string' && typeof value.messageId === 'string'
  )
}

function isToolCallStatus(value: unknown): value is AgentToolCallStatus {
  return value === 'running' || value === 'success' || value === 'error'
}

function parseToolCall(raw: WithBase): AgentToolCallEvent | null {
  if (
    typeof raw.toolCallId !== 'string' ||
    typeof raw.toolName !== 'string' ||
    !isToolCallStatus(raw.status)
  ) {
    return null
  }
  return {
    type: 'agent_tool_call',
    threadId: raw.threadId,
    messageId: raw.messageId,
    toolCallId: raw.toolCallId,
    toolName: raw.toolName,
    status: raw.status,
    ...(typeof raw.durationMs === 'number' ? { durationMs: raw.durationMs } : {}),
    ...(typeof raw.errorCode === 'string' ? { errorCode: raw.errorCode } : {})
  }
}

function parseDraftPatch(raw: WithBase): DraftPatchEvent | null {
  if (
    typeof raw.workflowId !== 'string' ||
    !isRecord(raw.content) ||
    typeof raw.version !== 'number' ||
    typeof raw.baseVersion !== 'number'
  ) {
    return null
  }
  return {
    type: 'draft_patch',
    threadId: raw.threadId,
    messageId: raw.messageId,
    workflowId: raw.workflowId,
    content: raw.content,
    version: raw.version,
    baseVersion: raw.baseVersion
  }
}

/**
 * Decode an untrusted WebSocket payload into a typed `AgentEvent`, or `null` if
 * it is not a well-formed agent event. Keeps the transport boundary type-safe.
 */
export function parseAgentEvent(raw: unknown): AgentEvent | null {
  if (!isRecord(raw) || !hasBase(raw)) return null

  switch (raw.type) {
    case 'agent_message_delta':
      return typeof raw.delta === 'string'
        ? {
            type: 'agent_message_delta',
            threadId: raw.threadId,
            messageId: raw.messageId,
            delta: raw.delta
          }
        : null
    case 'agent_tool_call':
      return parseToolCall(raw)
    case 'draft_patch':
      return parseDraftPatch(raw)
    case 'agent_message_done':
      return {
        type: 'agent_message_done',
        threadId: raw.threadId,
        messageId: raw.messageId
      }
    default:
      return null
  }
}
