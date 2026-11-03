import {
  zAgentAdmissionError,
  zAgentAnswerAccepted,
  zAgentAskFrame,
  zAgentAskKind,
  zAgentAskResolvedFrame,
  zAgentAttachmentRejected,
  zAgentCancelAccepted,
  zAgentError as zGeneratedAgentError,
  zAgentIdentity as zGeneratedAgentIdentity,
  zAgentMessage as zGeneratedAgentMessage,
  zAgentPendingAskBase,
  zAgentRunMode as zGeneratedAgentRunMode,
  zAgentThreadListResponse as zGeneratedAgentThreadListResponse,
  zAgentToolCallData as zGeneratedAgentToolCallData,
  zAgentThinkingEntry,
  zAgentTurnAccepted as zGeneratedAgentTurnAccepted,
  zAgentTurnUsage as zGeneratedAgentTurnUsage,
  zToolCallSummary,
  zWorkflowResponse,
  zWorkflowListResponse
} from '@comfyorg/ingest-types/zod'
import type {
  AgentAnswerAccepted,
  AgentAskKind,
  AgentCancelAccepted,
  AgentRunMode as AgentRunModePreference,
  AgentThreadSummary,
  AgentTurnAccepted as GeneratedAgentTurnAccepted
} from '@comfyorg/ingest-types'
import { z } from 'zod'

import { isNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

export { zAgentAdmissionError, zAgentCancelAccepted }
export type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentRunModePreference,
  AgentThreadSummary
}

export const zAgentAnswerReceipt = zAgentAnswerAccepted
export type AgentAnswerReceipt = z.infer<typeof zAgentAnswerReceipt>

const zTurnId = z.string().brand<'TurnId'>()
export type TurnId = z.infer<typeof zTurnId>
export const toTurnId = (value: string): TurnId => zTurnId.parse(value)

export const zAgentTurnAccepted = zGeneratedAgentTurnAccepted.extend({
  workflow_id: z.string().optional()
})
export type AgentTurnAccepted = GeneratedAgentTurnAccepted & {
  workflow_id?: string
}

export const RENDERED_ASK_KINDS = [
  'run_approval',
  'ask_user',
  'delete_approval',
  'paused'
] as const satisfies readonly AgentAskKind[]
export type RenderedAskKind = (typeof RENDERED_ASK_KINDS)[number]

const zTolerantPendingAsk = zAgentPendingAskBase.extend({
  kind: zAgentAskKind.or(z.literal('unknown')).catch('unknown'),
  context: z.unknown().optional()
})

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

const SKILL_NAME_MAX = 256

/**
 * Display-only, so an over-long name is clamped. Rejecting it would drop
 * the live frame or the whole persisted transcript.
 */
const zSkillName = z
  .string()
  .transform((skill) => Array.from(skill).slice(0, SKILL_NAME_MAX).join(''))
  .nullish()

export const zPersistedToolCallSummary = zToolCallSummary.extend({
  skill: zSkillName
})
export type PersistedToolCallSummary = z.infer<typeof zPersistedToolCallSummary>

export const zPersistedThinkingEntry = zAgentThinkingEntry
  .pick({ text: true })
  .extend({ tool_call_id: z.string().nullish() })

const zAgentMessageContent = zGeneratedAgentMessage.shape.content
  .unwrap()
  .extend({
    text: z.unknown().optional(),
    attachments: z.unknown().optional(),
    workflow_references: z.unknown().optional(),
    tool_calls: z.unknown().optional()
  })

export const zAgentMessage = zGeneratedAgentMessage.extend({
  content: zAgentMessageContent.optional(),
  pending_ask: zTolerantPendingAsk.optional()
})

export const zAgentMessages = z.array(zAgentMessage)
export type AgentMessages = z.infer<typeof zAgentMessages>

export const zAgentThreads = zGeneratedAgentThreadListResponse

export const zCloudWorkflowIndex = zWorkflowListResponse
  .pick({ pagination: true })
  .extend({
    data: z.array(zWorkflowResponse.pick({ id: true, name: true }))
  })
export type CloudWorkflowEntry = z.infer<
  typeof zCloudWorkflowIndex
>['data'][number]

export const zAgentError = z.union([zGeneratedAgentError, zAgentAdmissionError])

export const zAttachmentRejection = zAgentAttachmentRejected.pick({
  rejected: true,
  rejected_count: true,
  type: true
})

/**
 * The 403 body the agent service returns when it will not serve the turn's
 * `workflow_id` to the caller's workspace, whether the row is gone or belongs
 * elsewhere. The message is the only discriminator on the wire: a 403 refusing
 * the thread or the message carries the same shape with a different subject.
 */
export const zDisownedWorkflowError = z.object({
  error: z.literal('workflow not found or access denied')
})

/**
 * The 409 body the agent service returns when the thread already has a turn in
 * progress (`rejectTurnInProgress` in `services/agent/server/agent_handler.go`).
 * `type` is the discriminator — a 409 from the cancel or answer endpoints
 * carries no `type` at all — and the two ids name the turn that holds the
 * thread, so the client can re-attach to it instead of reporting a dead end.
 *
 * Both ids are optional on the wire: the server resolves them best-effort and
 * documents that a lookup failure "still yields the 409, just without the id".
 * A conflict with no ids is still a conflict, so the discriminator alone has to
 * be enough to recognise one.
 */
export const zTurnInProgressError = z
  .object({
    type: z.literal('TURN_IN_PROGRESS'),
    active_message_id: z.string().optional(),
    turn_id: z.string().optional()
  })
  .passthrough()

const zAgentThinkingData = z
  .object({
    delta: z.string(),
    message_id: z.string(),
    thread_id: z.string()
  })
  .passthrough()

const zAgentToolCallData = zGeneratedAgentToolCallData.extend({
  skill: zSkillName,
  args: z.never().optional(),
  workflow_id: zGeneratedAgentToolCallData.shape.workflow_id.catch(undefined),
  op_ids: zGeneratedAgentToolCallData.shape.op_ids.catch(undefined),
  doc_seq: zGeneratedAgentToolCallData.shape.doc_seq.catch(undefined),
  doc_lineage_seq:
    zGeneratedAgentToolCallData.shape.doc_lineage_seq.catch(undefined),
  job_id: z
    .string()
    .min(1)
    .max(128)
    .refine(
      (value) =>
        !value.includes('\u0000') &&
        !value.includes('\n') &&
        !value.includes('\r') &&
        !value.includes('\t')
    )
    .optional()
    .catch(undefined),
  job_workflow_id: z.string().min(1).optional().catch(undefined)
})

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
    cache_creation_input_tokens: z.number().nullish(),
    charge_micro_usd: zGeneratedAgentTurnUsage.shape.charge_micro_usd
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

const zAgentThinkingDraftEvent = z.object({
  type: z.literal('agent_thinking_draft'),
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

const zAgentAskEvent = zAgentAskFrame.extend({
  data: zTolerantPendingAsk.extend({ thread_id: z.string() })
})

export const zAgentWsEvent = z.discriminatedUnion('type', [
  zAgentThinkingEvent,
  zAgentToolCallEvent,
  zAgentMessageDeltaEvent,
  zAgentMessageDraftEvent,
  zAgentThinkingDraftEvent,
  zAgentMessageDoneEvent,
  zAgentActiveTabEvent,
  zAgentAskEvent,
  zAgentAskResolvedFrame
])
export type AgentWsEvent = z.infer<typeof zAgentWsEvent>

const AGENT_WS_EVENT_TYPES: ReadonlySet<AgentWsEvent['type']> = new Set(
  zAgentWsEvent.options.flatMap(({ shape: { type } }) =>
    'value' in type ? [type.value] : type.options
  )
)

export function isAgentEvent(type: string): type is AgentWsEvent['type'] {
  return AGENT_WS_EVENT_TYPES.has(type as AgentWsEvent['type'])
}

export function parseAgentWsEvent(
  value: unknown
): z.ZodSafeParseResult<AgentWsEvent> {
  return zAgentWsEvent.safeParse(pendingServerFact('BE-20403', value))
}

export const zAgentIdentity = zGeneratedAgentIdentity.extend({
  user_id: z.string().min(1)
})

/** The server's `agent` feature, pushed again on every change. */
export interface AgentServerFeature {
  state: 'starting' | 'ready' | 'failed'
  reason?: string | null
}
