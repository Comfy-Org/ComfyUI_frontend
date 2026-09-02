import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
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
const zRecordedWsEvent = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown())
})
export type RecordedWsEvent = z.infer<typeof zRecordedWsEvent>

// Payload shapes are the pinned applier's contract (it rejects a malformed
// op at replay time); the fixture only pins the vocabulary.
const zGraphOperation = z.custom<GraphOperation>(
  (value) =>
    isRecord(value) &&
    typeof value.op === 'string' &&
    (FROZEN_OPS as readonly string[]).includes(value.op)
)

const zWorkflowJson = z.custom<WorkflowJSON>(
  (value) =>
    isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.links)
)

const zWidgetCatalog = z.custom<WidgetCatalog>(
  (value) => isRecord(value) && isRecord(value.types)
)

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
const zAgentConversation = z.object({
  schema_version: z.literal('agent-conversation.v1'),
  source: z.object({
    repo: z.string(),
    suite: z.string(),
    case_id: z.string(),
    response_side: z.enum(['recorded', 'synthesized']),
    note: z.string().optional()
  }),
  workflow: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    catalog: zWidgetCatalog,
    seed: zWorkflowJson
  }),
  request: z.object({ content: z.string().min(1) }),
  response: z.array(zResponseEntry).min(1)
})
export type AgentConversation = z.infer<typeof zAgentConversation>

export function loadAgentConversation(caseId: string): AgentConversation {
  const file = fileURLToPath(
    new URL(`./conversations/${caseId}.json`, import.meta.url)
  )
  return zAgentConversation.parse(JSON.parse(readFileSync(file, 'utf-8')))
}
