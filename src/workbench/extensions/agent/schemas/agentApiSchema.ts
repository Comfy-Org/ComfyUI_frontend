import {
  zAgentAdmissionError,
  zAgentAnswerAccepted,
  zAgentCancelAccepted,
  zAgentError as zGeneratedAgentError,
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

export { zAgentAdmissionError, zAgentAnswerAccepted, zAgentCancelAccepted }
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

/**
 * One entry of a persisted assistant row's `content.tool_calls` (see
 * `agentTranscript.ts`'s `parseToolCallEntry`), the reload-path counterpart
 * to the live WebSocket's `zAgentToolCallData` above. `status` is
 * deliberately `z.string()` rather than a closed enum: an unrecognized value
 * must still surface as a failed `ToolPart` (`toolCallOk` treats anything
 * other than `pending`/`running`/`ok`/`success` as failure), so schema
 * validation should reject a malformed *entry* (missing `id`/`tool_name`),
 * not an unfamiliar *status* string or a bad `duration_ms` — `duration_ms` is
 * `z.unknown().optional()` so a NaN/Infinity/negative value there doesn't
 * sink the whole entry; `parseToolCallEntry` narrows it separately and just
 * omits it. `status` is likewise `.optional()`: an entry that omits it
 * entirely must still survive validation (`toolCallPartState`/`toolCallOk`
 * already treat `undefined` as terminal-and-failed, matching the old
 * parser's behavior for a status-less call).
 */
export const zPersistedToolCallSummary = z
  .object({
    id: z.string(),
    // The provider tool-use id a LIVE `agent_tool_call` frame carries as
    // `tool_call_id` (see `zAgentToolCallData` above). `parseToolCallEntry`
    // prefers this over `id` when building `callId` so a restored `ToolPart`
    // is keyed the same way a live frame for the same call will be, and can
    // be updated in place rather than rendered as an unmatched duplicate.
    // Optional: rows recorded before `tool_call_id` existed have none.
    tool_call_id: z.string().optional(),
    tool_name: z.string(),
    status: z.string().optional(),
    duration_ms: z.unknown().optional()
  })
  .passthrough()

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

export const zAgentError = z.union([zGeneratedAgentError, zAgentAdmissionError])

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

// The whole answer so far while the model is still writing it: each draft
// replaces the last, and an empty text withdraws it.
const zAgentMessageDraftData = z
  .object({
    text: z.string(),
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

const zAgentMessageDraftEvent = z.object({
  type: z.literal('agent_message_draft'),
  data: zAgentMessageDraftData
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
  zAgentMessageDraftEvent,
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
