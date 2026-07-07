import { z } from 'zod'

/**
 * Wire contract for the In-App Agent REST + WebSocket backend. Derived from
 * services/ingest/openapi.yaml (agent section) of Comfy-Org/cloud PR #4432, then
 * validated field-by-field against live frames recorded from
 * pr-4432.testenvs.comfy.org on 2026-07-06 into __fixtures__/agent/. This schema
 * is the single source of truth shared by the transport and every fixture, so a
 * wire change surfaces as a parse error rather than silent drift.
 *
 * Two contract facts corrected here against earlier docs, both re-verified live:
 * - the draft_patch version anchor is `base_version`, not `prev_version`.
 * - agent_message_done.usage is null on a cancelled turn (no tokens accounted).
 */

// The TurnId brand holds the server-minted assistant message_id and is applied at
// the session seam, not on the wire. Wire fields stay plain z.string() so a raw
// frame parses without a branding cast; the session layer brands as it adopts ids.
export const zTurnId = z.string().brand<'TurnId'>()
export type TurnId = z.infer<typeof zTurnId>

/* ---------------------------------- REST ---------------------------------- */

export const zAgentThreadCreated = z.object({
  thread_id: z.string()
})
export type AgentThreadCreated = z.infer<typeof zAgentThreadCreated>

// The captured 202 carries workflow_id beyond the openapi-required pair; passthrough
// tolerates that and any further additive keys.
export const zAgentTurnAccepted = z
  .object({
    thread_id: z.string(),
    message_id: z.string()
  })
  .passthrough()
export type AgentTurnAccepted = z.infer<typeof zAgentTurnAccepted>

// content is a free object (user={text, attachments?}, assistant={text}); it is
// omitted while a message is still streaming, so it stays optional and tolerant.
export const zAgentMessage = z.object({
  id: z.string(),
  thread_id: z.string(),
  seq: z.number().int(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  status: z.enum(['streaming', 'complete', 'error', 'interrupted']),
  turn_id: z.string(),
  content: z.record(z.string(), z.unknown()).optional()
})
export type AgentMessage = z.infer<typeof zAgentMessage>

export const zAgentMessages = z.array(zAgentMessage)
export type AgentMessages = z.infer<typeof zAgentMessages>

export const zAgentCancelAccepted = z.object({
  status: z.literal('cancelling')
})
export type AgentCancelAccepted = z.infer<typeof zAgentCancelAccepted>

export const zAgentDraftSnapshot = z.object({
  content: z.record(z.string(), z.unknown()),
  version: z.number().int()
})
export type AgentDraftSnapshot = z.infer<typeof zAgentDraftSnapshot>

// The plain-string error shape. Ingest-raised errors use a different, richer shape
// (e.g. {error: {message, type}}); callers fall back tolerantly and do not model it.
export const zAgentError = z.object({
  error: z.string()
})
export type AgentError = z.infer<typeof zAgentError>

export const zUploadImageResult = z.object({
  name: z.string(),
  subfolder: z.string(),
  type: z.string()
})
export type UploadImageResult = z.infer<typeof zUploadImageResult>

/* ------------------------------ WebSocket events ------------------------------ */

// Each event rides the standard ComfyUI envelope {type, data}. data objects use
// passthrough to tolerate additive server fields but require every captured field.

const zAgentThinkingData = z
  .object({
    delta: z.string(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()
export type AgentThinkingData = z.infer<typeof zAgentThinkingData>

const zAgentToolCallData = z
  .object({
    tool_name: z.string(),
    status: z.string(),
    args: z.array(z.string()),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()
export type AgentToolCallData = z.infer<typeof zAgentToolCallData>

// content is the full UI-format graph object (not a diff); base_version anchors it.
const zDraftPatchData = z
  .object({
    base_version: z.number().int(),
    version: z.number().int(),
    content: z.record(z.string(), z.unknown()),
    message_id: z.string().optional(),
    thread_id: z.string().optional(),
    workflow_id: z.string()
  })
  .passthrough()
export type DraftPatchData = z.infer<typeof zDraftPatchData>

const zAgentMessageDeltaData = z
  .object({
    delta: z.string(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()
export type AgentMessageDeltaData = z.infer<typeof zAgentMessageDeltaData>

// The five token counts are required numbers; the object itself tolerates additive
// fields. usage is null on a cancelled turn (no token accounting).
const zTokenUsage = z
  .object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    cache_creation_input_tokens: z.number()
  })
  .passthrough()
export type TokenUsage = z.infer<typeof zTokenUsage>

const zAgentMessageDoneData = z
  .object({
    message_id: z.string(),
    thread_id: z.string(),
    usage: zTokenUsage.nullable()
  })
  .passthrough()
export type AgentMessageDoneData = z.infer<typeof zAgentMessageDoneData>

// Heartbeat; carries no message_id/thread_id.
const zDraftVersionData = z
  .object({
    version: z.number().int(),
    workflow_id: z.string()
  })
  .passthrough()
export type DraftVersionData = z.infer<typeof zDraftVersionData>

const zAgentThinkingEvent = z.object({
  type: z.literal('agent_thinking'),
  data: zAgentThinkingData
})

const zAgentToolCallEvent = z.object({
  type: z.literal('agent_tool_call'),
  data: zAgentToolCallData
})

const zDraftPatchEvent = z.object({
  type: z.literal('draft_patch'),
  data: zDraftPatchData
})

const zAgentMessageDeltaEvent = z.object({
  type: z.literal('agent_message_delta'),
  data: zAgentMessageDeltaData
})

const zAgentMessageDoneEvent = z.object({
  type: z.literal('agent_message_done'),
  data: zAgentMessageDoneData
})

const zDraftVersionEvent = z.object({
  type: z.literal('draft_version'),
  data: zDraftVersionData
})

export const zAgentWsEvent = z.discriminatedUnion('type', [
  zAgentThinkingEvent,
  zAgentToolCallEvent,
  zDraftPatchEvent,
  zAgentMessageDeltaEvent,
  zAgentMessageDoneEvent,
  zDraftVersionEvent
])
export type AgentWsEvent = z.infer<typeof zAgentWsEvent>

// Host frames (e.g. {type:"status"}) ride the same /ws. isAgentEvent cheaply sorts
// agent events from foreign frames on the type string, without zod-parsing them.
export const AGENT_WS_EVENT_TYPES: ReadonlySet<string> = new Set([
  'agent_thinking',
  'agent_tool_call',
  'draft_patch',
  'agent_message_delta',
  'agent_message_done',
  'draft_version'
])

export function isAgentEvent(type: string): boolean {
  return AGENT_WS_EVENT_TYPES.has(type)
}

// Thin: returns the safeParse result typed to AgentWsEvent on success. No logging;
// callers decide how to surface a failure.
export function parseAgentWsEvent(
  value: unknown
): z.SafeParseReturnType<unknown, AgentWsEvent> {
  return zAgentWsEvent.safeParse(value)
}
