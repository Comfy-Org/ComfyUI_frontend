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

/** Wire body the backend `/api/agent/*` endpoints accept (snake_case). */
export interface AgentTurnRequestBody {
  content: string
  selection?: NodeId[]
  attachments?: string[]
  target?: AgentWriteTarget
  base_version?: number
}

/** Serialize a turn request to the snake_case body the backend expects. */
export function serializeAgentTurnRequest(
  request: AgentTurnRequest
): AgentTurnRequestBody {
  return {
    content: request.content,
    ...(request.selection !== undefined
      ? { selection: request.selection }
      : {}),
    ...(request.attachments !== undefined
      ? { attachments: request.attachments }
      : {}),
    ...(request.target !== undefined ? { target: request.target } : {}),
    ...(request.baseVersion !== undefined
      ? { base_version: request.baseVersion }
      : {})
  }
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
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A finite number — rejects `NaN`/`Infinity`, which would wedge CAS version compares. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** The base identifiers, read from the snake_case envelope body. */
function parseBase(data: Record<string, unknown>): AgentEventBase | null {
  return typeof data.thread_id === 'string' &&
    typeof data.message_id === 'string'
    ? { threadId: data.thread_id, messageId: data.message_id }
    : null
}

function isToolCallStatus(value: unknown): value is AgentToolCallStatus {
  return value === 'running' || value === 'success' || value === 'error'
}

function parseToolCall(
  data: Record<string, unknown>,
  base: AgentEventBase
): AgentToolCallEvent | null {
  if (
    typeof data.tool_call_id !== 'string' ||
    typeof data.tool_name !== 'string' ||
    !isToolCallStatus(data.status)
  ) {
    return null
  }
  return {
    type: 'agent_tool_call',
    ...base,
    toolCallId: data.tool_call_id,
    toolName: data.tool_name,
    status: data.status,
    ...(isFiniteNumber(data.duration_ms)
      ? { durationMs: data.duration_ms }
      : {}),
    ...(typeof data.error_code === 'string'
      ? { errorCode: data.error_code }
      : {})
  }
}

function parseDraftPatch(
  data: Record<string, unknown>,
  base: AgentEventBase
): DraftPatchEvent | null {
  if (
    typeof data.workflow_id !== 'string' ||
    !isRecord(data.content) ||
    !isFiniteNumber(data.version) ||
    !isFiniteNumber(data.base_version)
  ) {
    return null
  }
  return {
    type: 'draft_patch',
    ...base,
    workflowId: data.workflow_id,
    content: data.content,
    version: data.version,
    baseVersion: data.base_version
  }
}

function parseTokenUsage(
  usage: unknown
): { input: number; output: number } | undefined {
  return isRecord(usage) &&
    isFiniteNumber(usage.input) &&
    isFiniteNumber(usage.output)
    ? { input: usage.input, output: usage.output }
    : undefined
}

/**
 * Decode an untrusted WebSocket payload into a typed `AgentEvent`, or `null` if
 * it is not a well-formed agent event. The wire format is the canonical backend
 * envelope `{ type, data: { …snake_case… } }`; the event body lives under
 * `data`. Keeps the transport boundary type-safe.
 */
export function parseAgentEvent(raw: unknown): AgentEvent | null {
  if (!isRecord(raw) || !isRecord(raw.data)) return null

  const { data } = raw
  const base = parseBase(data)
  if (!base) return null

  switch (raw.type) {
    case 'agent_message_delta':
      return typeof data.delta === 'string'
        ? { type: 'agent_message_delta', ...base, delta: data.delta }
        : null
    case 'agent_tool_call':
      return parseToolCall(data, base)
    case 'draft_patch':
      return parseDraftPatch(data, base)
    case 'agent_message_done': {
      const tokenUsage = parseTokenUsage(data.usage)
      return {
        type: 'agent_message_done',
        ...base,
        ...(tokenUsage ? { tokenUsage } : {})
      }
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Draft snapshot: GET /api/agent/draft?workflow_id=... -> { content, version }
// ---------------------------------------------------------------------------

/**
 * The authoritative server draft for a workflow (ADR-0011). Fetched on WS
 * (re)connect and whenever a gap is suspected, to seed/reconcile the tab's base
 * `version` without waiting for the agent to emit a new `draft_patch`.
 */
export interface DraftSnapshot {
  content: WorkflowGraph
  version: number
}

/** Decode an untrusted `GET /api/agent/draft` body, or `null` if malformed. */
export function parseDraftSnapshot(raw: unknown): DraftSnapshot | null {
  if (
    !isRecord(raw) ||
    !isRecord(raw.content) ||
    !isFiniteNumber(raw.version)
  ) {
    return null
  }
  return { content: raw.content, version: raw.version }
}
