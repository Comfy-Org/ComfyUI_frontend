import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A realtime agent frame as recorded, minus the turn identity
 * (`message_id` / `thread_id`): the replay stamps those from the ack it
 * minted, then validates the result against `zAgentWsEvent` before sending.
 */
export const zRecordedWsEvent = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown())
})
export type RecordedWsEvent = z.infer<typeof zRecordedWsEvent>

function isNodeId(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number'
}

function isNodeIdList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isNodeId)
}

/** A grown destination slot (`grow`) and a concrete `to_slot` are exclusive. */
function isConnectPayload(op: Record<string, unknown>): boolean {
  const destination =
    op.grow === undefined || op.grow === null
      ? typeof op.to_slot === 'number'
      : isRecord(op.grow) &&
        typeof op.grow.name === 'string' &&
        typeof op.grow.type === 'string' &&
        (op.to_slot === undefined || op.to_slot === null)
  return (
    destination &&
    isNodeId(op.link_id) &&
    isNodeId(op.from_node) &&
    typeof op.from_slot === 'number' &&
    isNodeId(op.to_node) &&
    typeof op.link_type === 'string'
  )
}

/** A non-empty `path` is an interior write and needs its `inner_widget`. */
function isSetWidgetPayload(op: Record<string, unknown>): boolean {
  const address =
    op.path === undefined || op.path === null
      ? op.inner_widget === undefined || op.inner_widget === null
      : Array.isArray(op.path) &&
        op.path.length > 0 &&
        op.path.every((segment) => typeof segment === 'string') &&
        typeof op.inner_widget === 'string'
  return (
    address &&
    isNodeId(op.node_id) &&
    typeof op.widget === 'string' &&
    'value' in op
  )
}

/**
 * The frozen vocabulary's payload contract, per kind. A schema that claims
 * `GraphOperation` has to verify the member it narrows to: an `add_node`
 * without its node payload loads fine under a vocabulary-only check and then
 * fails deep inside `applyOps`, far from the fixture that carried it.
 */
export function isGraphOperation(value: unknown): value is GraphOperation {
  if (!isRecord(value)) return false
  switch (value.op) {
    case 'add_node':
      return (
        isNodeId(value.node_id) &&
        typeof value.class_type === 'string' &&
        Array.isArray(value.pos) &&
        value.pos.every((coordinate) => typeof coordinate === 'number') &&
        isRecord(value.node)
      )
    case 'connect':
      return isConnectPayload(value)
    case 'set_widget':
      return isSetWidgetPayload(value)
    case 'delete_node':
      return isNodeId(value.node_id) && isNodeIdList(value.removed_links)
    case 'clear':
      return isNodeIdList(value.removed_nodes)
    default:
      return false
  }
}

const zGraphOperation = z.custom<GraphOperation>(isGraphOperation)

const zWorkflowJson = z.custom<WorkflowJSON>(
  (value) =>
    isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.links)
)

const zWidgetCatalog = z.custom<WidgetCatalog>(
  (value) => isRecord(value) && isRecord(value.types)
)

export const zAgentConversationWorkflow = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  catalog: zWidgetCatalog,
  seed: zWorkflowJson
})

export const zAgentConversationRequest = z.object({
  content: z.string().min(1)
})

const zResponseEntry = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('event'), event: zRecordedWsEvent }),
  z.object({
    kind: z.literal('graph_ops'),
    ops: z.array(zGraphOperation).min(1)
  })
])

/**
 * One user prompt and the ordered agent response it produced: chat frames
 * (`event`) interleaved with the semantic graph operations (`graph_ops`) the
 * doc host folds into the workflow document.
 */
export const zAgentConversation = z
  .object({
    schema_version: z.literal('agent-conversation.v1'),
    source: z.object({
      repo: z.string(),
      suite: z.string(),
      case_id: z.string(),
      response_side: z.enum(['recorded', 'synthesized']),
      note: z.string().optional(),
      capture: z
        .object({
          backend: z.literal('Comfy-Org/cloud'),
          thread_id: z.string().min(1),
          message_id: z.string().min(1),
          exported_at: z.string().datetime()
        })
        .optional()
    }),
    workflow: zAgentConversationWorkflow,
    request: zAgentConversationRequest,
    response: z.array(zResponseEntry).min(1)
  })
  .superRefine((conversation, ctx) => {
    if (
      conversation.source.response_side === 'recorded' &&
      conversation.source.capture === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['source', 'capture'],
        message: 'recorded responses require backend capture provenance'
      })
    }
  })
export type AgentConversation = z.infer<typeof zAgentConversation>

export function loadAgentConversation(caseId: string): AgentConversation {
  const file = fileURLToPath(
    new URL(`./conversations/${caseId}.json`, import.meta.url)
  )
  return zAgentConversation.parse(JSON.parse(readFileSync(file, 'utf-8')))
}
