import { zWorkflowListResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

const zTurnId = z.string().brand<'TurnId'>()
export type TurnId = z.infer<typeof zTurnId>

export const zAgentTurnAccepted = z
  .object({
    thread_id: z.string(),
    message_id: z.string(),
    workflow_id: z.string().optional()
  })
  .passthrough()
export type AgentTurnAccepted = z.infer<typeof zAgentTurnAccepted>

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

export const zCloudWorkflowIndex = zWorkflowListResponse
  .pick({ pagination: true })
  .extend({
    data: z.array(
      z.object({ id: z.string(), name: z.string().optional() }).passthrough()
    )
  })
export type CloudWorkflowEntry = z.infer<
  typeof zCloudWorkflowIndex
>['data'][number]

export const zAgentCancelAccepted = z.object({
  status: z.literal('cancelling')
})
export type AgentCancelAccepted = z.infer<typeof zAgentCancelAccepted>

export const zAgentDraftSnapshot = z.object({
  content: z.record(z.string(), z.unknown()),
  version: z.number().int()
})
export type AgentDraftSnapshot = z.infer<typeof zAgentDraftSnapshot>

export const zAgentError = z.object({
  error: z.string()
})

export const zUploadImageResult = z.object({
  name: z.string(),
  subfolder: z.string(),
  type: z.string()
})
export type UploadImageResult = z.infer<typeof zUploadImageResult>

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
    duration_ms: z.number().optional(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()

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

const zAgentMessageDoneData = z
  .object({
    message_id: z.string(),
    thread_id: z.string(),
    usage: z.unknown().nullish()
  })
  .passthrough()

const zDraftVersionData = z
  .object({
    version: z.number().int(),
    workflow_id: z.string()
  })
  .passthrough()
export type DraftVersionData = z.infer<typeof zDraftVersionData>

const zAgentActiveTabData = z
  .object({
    workflow_id: z.string(),
    name: z.string().optional(),
    thread_id: z.string().optional(),
    message_id: z.string().optional()
  })
  .passthrough()
export type AgentActiveTabData = z.infer<typeof zAgentActiveTabData>

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

const zAgentActiveTabEvent = z.object({
  type: z.literal('agent_active_tab'),
  data: zAgentActiveTabData
})

export const zAgentWsEvent = z.discriminatedUnion('type', [
  zAgentThinkingEvent,
  zAgentToolCallEvent,
  zDraftPatchEvent,
  zAgentMessageDeltaEvent,
  zAgentMessageDoneEvent,
  zDraftVersionEvent,
  zAgentActiveTabEvent
])
export type AgentWsEvent = z.infer<typeof zAgentWsEvent>

export const AGENT_WS_EVENT_TYPES: ReadonlySet<string> = new Set([
  'agent_thinking',
  'agent_tool_call',
  'draft_patch',
  'agent_message_delta',
  'agent_message_done',
  'draft_version',
  'agent_active_tab'
])

export function isAgentEvent(type: string): boolean {
  return AGENT_WS_EVENT_TYPES.has(type)
}

export function parseAgentWsEvent(
  value: unknown
): z.SafeParseReturnType<unknown, AgentWsEvent> {
  return zAgentWsEvent.safeParse(value)
}
