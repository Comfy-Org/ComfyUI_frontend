import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const zRecordedWsEvent = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  at_ms: z.number().int().nonnegative().optional()
})
export type RecordedWsEvent = z.infer<typeof zRecordedWsEvent>

// The applier validates op payloads at replay time; only the vocabulary is pinned here.
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

export const zAgentConversationWorkflow = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  catalog: zWidgetCatalog,
  seed: zWorkflowJson
})

export const zAgentConversationRequest = z.object({
  content: z.string().min(1)
})

// Offset from the turn's first frame, so replays can reproduce real gaps.
const zAtMs = z.number().int().nonnegative().optional()

const zResponseEntry = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('event'), event: zRecordedWsEvent, at_ms: zAtMs }),
  z.object({
    kind: z.literal('graph_ops'),
    ops: z.array(zGraphOperation).min(1),
    at_ms: zAtMs
  })
])

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

export function listRecordedConversations(): string[] {
  const dir = fileURLToPath(new URL('./conversations/', import.meta.url))
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .filter(
      (caseId) =>
        loadAgentConversation(caseId).source.response_side === 'recorded'
    )
    .sort()
}

export function loadAgentConversation(caseId: string): AgentConversation {
  const file = fileURLToPath(
    new URL(`./conversations/${caseId}.json`, import.meta.url)
  )
  return zAgentConversation.parse(JSON.parse(readFileSync(file, 'utf-8')))
}
