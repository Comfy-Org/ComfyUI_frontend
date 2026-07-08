import { z } from 'zod'

// Wire contract for the In-App Agent REST + WebSocket backend, validated
// field-by-field against live frames in __fixtures__/agent/.

// Wire fields stay plain z.string(); the session layer brands ids as it adopts them,
// so a raw frame parses without a branding cast.
const zTurnId = z.string().brand<'TurnId'>()
export type TurnId = z.infer<typeof zTurnId>

export const zAgentThreadCreated = z.object({
  thread_id: z.string()
})
export type AgentThreadCreated = z.infer<typeof zAgentThreadCreated>

// workflow_id is optional only because the openapi marks it so; every observed ack
// carries it.
export const zAgentTurnAccepted = z
  .object({
    thread_id: z.string(),
    message_id: z.string(),
    workflow_id: z.string().optional()
  })
  .passthrough()
export type AgentTurnAccepted = z.infer<typeof zAgentTurnAccepted>

// content is omitted while a message is still streaming, so it stays optional.
export const zAgentMessage = z
  .object({
    id: z.string(),
    thread_id: z.string(),
    seq: z.number().int(),
    role: z.enum(['user', 'assistant', 'tool', 'system']),
    status: z.enum(['streaming', 'complete', 'error', 'interrupted']),
    turn_id: z.string(),
    content: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()

export const zAgentMessages = z.array(zAgentMessage)
export type AgentMessages = z.infer<typeof zAgentMessages>

// title is "" until the server names the thread; preview carries the first prompt.
const zAgentThreadSummary = z
  .object({
    id: z.string(),
    title: z.string(),
    preview: z.string().optional(),
    last_message_at: z.string().optional(),
    updated_at: z.string().optional(),
    created_at: z.string().optional()
  })
  .passthrough()
export type AgentThreadSummary = z.infer<typeof zAgentThreadSummary>

export const zAgentThreads = z
  .object({ threads: z.array(zAgentThreadSummary) })
  .passthrough()

export const zAgentCancelAccepted = z.object({
  status: z.literal('cancelling')
})
export type AgentCancelAccepted = z.infer<typeof zAgentCancelAccepted>

export const zAgentDraftSnapshot = z.object({
  content: z.record(z.string(), z.unknown()),
  version: z.number().int()
})
export type AgentDraftSnapshot = z.infer<typeof zAgentDraftSnapshot>

// Plain-string error shape only; ingest-raised errors use a richer {error:{message,type}}
// shape that callers tolerate but do not model.
export const zAgentError = z.object({
  error: z.string()
})

export const zUploadImageResult = z.object({
  name: z.string(),
  subfolder: z.string(),
  type: z.string()
})
export type UploadImageResult = z.infer<typeof zUploadImageResult>

// Each event rides the standard ComfyUI envelope {type, data}.

const zAgentThinkingData = z
  .object({
    delta: z.string(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()

const zAgentToolCallData = z
  .object({
    tool_name: z.string(),
    status: z.string(),
    args: z.array(z.string()),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()

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

// usage is null on a cancelled turn (no token accounting).
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

// Host frames (e.g. {type:"status"}) ride the same /ws; isAgentEvent sorts agent events
// from foreign frames on the type string without zod-parsing them.
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

export function parseAgentWsEvent(
  value: unknown
): z.SafeParseReturnType<unknown, AgentWsEvent> {
  return zAgentWsEvent.safeParse(value)
}
