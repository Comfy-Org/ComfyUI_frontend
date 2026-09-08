import {
  zAgentAnswerAccepted,
  zAgentCancelAccepted,
  zAgentError,
  zAgentMessage as zGeneratedAgentMessage,
  zAgentRunMode as zGeneratedAgentRunMode,
  zAgentThreadListResponse as zGeneratedAgentThreadListResponse,
  zAgentTurnAccepted as zGeneratedAgentTurnAccepted,
  zWorkflowListResponse
} from '@comfyorg/ingest-types/zod'
import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentRunMode as AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted as GeneratedAgentTurnAccepted
} from '@comfyorg/ingest-types'
import { z } from 'zod'

import { isNodeLocatorId } from '@/types/nodeIdentification'

export { zAgentAnswerAccepted, zAgentCancelAccepted, zAgentError }
export type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentRunModePreference,
  AgentThreadSummary
}

const zTurnId = z.string().brand<'TurnId'>()
export type TurnId = z.infer<typeof zTurnId>
export const toTurnId = (value: string): TurnId => zTurnId.parse(value)

export const zAgentTurnAccepted = zGeneratedAgentTurnAccepted
  .extend({
    workflow_id: z.string().optional()
  })
  .passthrough()
export type AgentTurnAccepted = GeneratedAgentTurnAccepted & {
  workflow_id?: string
}

const zAgentAskOption = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional()
  })
  .passthrough()

const zAgentPendingAsk = z
  .object({
    message_id: z.string(),
    ask_id: z.string(),
    kind: z.string().optional(),
    context: z
      .object({
        workflow_id: z.string().optional(),
        workflow_name: z.string().optional()
      })
      .passthrough()
      .optional(),
    prompt: z.string(),
    options: z.array(zAgentAskOption),
    min_selections: z.number().int(),
    max_selections: z.number().int(),
    allow_other: z.boolean()
  })
  .passthrough()

export const zAgentRunMode = zGeneratedAgentRunMode.superRefine(
  ({ mode, credit_limit }, ctx) => {
    if (
      mode === 'auto_limited' &&
      (credit_limit === null ||
        !Number.isInteger(credit_limit) ||
        credit_limit <= 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['credit_limit'],
        message: 'auto_limited requires a positive credit limit'
      })
    }
    if (mode !== 'auto_limited' && credit_limit !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['credit_limit'],
        message: 'credit limit is only valid for auto_limited'
      })
    }
  }
)
export type AgentRunModeValue = AgentRunModePreference['mode']

export const zAgentMessage = zGeneratedAgentMessage
  .extend({
    pending_ask: zAgentPendingAsk.optional()
  })
  .passthrough()

export const zAgentMessages = z.array(zAgentMessage)
export type AgentMessages = z.infer<typeof zAgentMessages>

export const zAgentThreads = zGeneratedAgentThreadListResponse.passthrough()

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
    tool_call_id: z.string(),
    tool_name: z.string(),
    status: z.enum(['running', 'success', 'error']),
    args: z.never().optional(),
    duration_ms: z.number().optional(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()

const zAgentMessageDeltaData = z
  .object({
    delta: z.string(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()

const zAgentUsage = z
  .object({
    input_tokens: z.number().nullish(),
    output_tokens: z.number().nullish(),
    total_tokens: z.number().nullish(),
    cache_read_input_tokens: z.number().nullish(),
    cache_creation_input_tokens: z.number().nullish()
  })
  .passthrough()

const zAgentMessageDoneData = z
  .object({
    message_id: z.string(),
    thread_id: z.string(),
    usage: zAgentUsage.nullish().catch(undefined)
  })
  .passthrough()

const zAgentActiveTabData = z
  .object({
    workflow_id: z.string(),
    node_locator_id: z
      .string()
      .max(256)
      .refine((value): boolean => isNodeLocatorId(value))
      .optional(),
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

const zAgentMessageDeltaEvent = z.object({
  type: z.literal('agent_message_delta'),
  data: zAgentMessageDeltaData
})

const zAgentMessageDoneEvent = z.object({
  type: z.literal('agent_message_done'),
  data: zAgentMessageDoneData
})

const zAgentActiveTabEvent = z.object({
  type: z.literal('agent_active_tab'),
  data: zAgentActiveTabData
})

const zAgentAskEvent = z.object({
  type: z.literal('agent_ask'),
  data: zAgentPendingAsk.extend({ thread_id: z.string() })
})

const zAgentAskResolvedEvent = z.object({
  type: z.literal('agent_ask_resolved'),
  data: z
    .object({
      thread_id: z.string(),
      message_id: z.string(),
      ask_id: z.string(),
      status: z.enum(['answered', 'cancelled', 'expired']),
      selected: z.array(z.string()).nullable()
    })
    .passthrough()
})

export const zAgentWsEvent = z.discriminatedUnion('type', [
  zAgentThinkingEvent,
  zAgentToolCallEvent,
  zAgentMessageDeltaEvent,
  zAgentMessageDoneEvent,
  zAgentActiveTabEvent,
  zAgentAskEvent,
  zAgentAskResolvedEvent
])
export type AgentWsEvent = z.infer<typeof zAgentWsEvent>

export const AGENT_WS_EVENT_TYPES: ReadonlySet<AgentWsEvent['type']> = new Set(
  zAgentWsEvent.options.map((option) => option.shape.type.value)
)

export function isAgentEvent(type: string): type is AgentWsEvent['type'] {
  return AGENT_WS_EVENT_TYPES.has(type as AgentWsEvent['type'])
}

export function parseAgentWsEvent(
  value: unknown
): z.SafeParseReturnType<unknown, AgentWsEvent> {
  return zAgentWsEvent.safeParse(value)
}
