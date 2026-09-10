import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { FROZEN_OPS } from '@comfyorg/comfy-multi-player'
import type { OpBase } from '@comfyorg/comfy-multi-player'
import { z } from 'zod'

import { zAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'

// A recording keeps every production field except the two ids the replay
// mints per run (agentConversationFixture stampTurn).
export const mintedIds: { thread_id: true; message_id: true } = {
  thread_id: true,
  message_id: true
}
// Every member gets the same transform, so the slot order only names them.
const [
  thinking,
  toolCall,
  messageDelta,
  messageDone,
  activeTab,
  ask,
  askResolved
] = zAgentWsEvent.options

export const zRecordedWsEvent = z.discriminatedUnion('type', [
  thinking.extend({ data: thinking.shape.data.omit(mintedIds) }),
  toolCall.extend({ data: toolCall.shape.data.omit(mintedIds) }),
  messageDelta.extend({ data: messageDelta.shape.data.omit(mintedIds) }),
  messageDone.extend({ data: messageDone.shape.data.omit(mintedIds) }),
  activeTab.extend({ data: activeTab.shape.data.omit(mintedIds) }),
  ask.extend({ data: ask.shape.data.omit(mintedIds) }),
  askResolved.extend({ data: askResolved.shape.data.omit(mintedIds) })
])
export type RecordedWsEvent = z.infer<typeof zRecordedWsEvent>

// GraphOperation is the wire op minus this envelope, which the replay remints
// through mintWireOps. Exhaustive by construction: a new OpBase field fails to
// typecheck here rather than slipping into a recording.
const OP_ENVELOPE: Record<keyof OpBase, true> = {
  op_id: true,
  actor: true,
  base_version: true,
  stamp: true
}
export const OP_ENVELOPE_KEYS = Object.keys(OP_ENVELOPE)

// Only the vocabulary and the absence of the envelope are checked here; a
// recorded op stays structural. Nothing in this fixture parses the semantic
// operation contract, which the package owns; assertOpsApply below applies
// the ops to a document and reports what that application shows.
const zGraphOperation = z
  .object({ op: z.enum(FROZEN_OPS) })
  .passthrough()
  .refine(
    (op) => OP_ENVELOPE_KEYS.every((key) => !(key in op)),
    'a recorded op carries the semantic operation only; the wire envelope is minted at replay'
  )
export type RecordedGraphOperation = z.infer<typeof zGraphOperation>

// WorkflowJSON and WorkflowNode declare an index signature, so the schema
// validates the guaranteed fields and keeps the rest.
const zWorkflowJson = z
  .object({
    nodes: z.array(
      z
        .object({ id: z.union([z.string(), z.number()]), type: z.string() })
        .passthrough()
    ),
    links: z.array(z.unknown())
  })
  .passthrough()

const zWidgetCatalogEntry = z
  .object({
    widget_order: z.array(z.string()),
    autogrow_templates: z
      .record(
        z.string(),
        z
          .object({
            prefix: z.string().optional(),
            names: z.array(z.string()).optional()
          })
          .passthrough()
      )
      .optional()
  })
  .strict()

// WidgetCatalog and WidgetCatalogEntry declare no index signature.
const zWidgetCatalog = z
  .object({
    comment: z.string().optional(),
    types: z.record(z.string(), zWidgetCatalogEntry)
  })
  .strict()

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

const zTurn = z
  .object({
    message_id: z.string().min(1).optional(),
    request: zAgentConversationRequest,
    // Response entry the recorded cancel followed; the replay stops there too.
    cancel_after: z.number().int().nonnegative().optional(),
    response: z.array(zResponseEntry).min(1)
  })
  .superRefine((turn, ctx) => {
    const dones = turn.response.flatMap((entry, index) =>
      entry.kind === 'event' && entry.event.type === 'agent_message_done'
        ? [index]
        : []
    )
    if (dones.length !== 1 || dones[0] !== turn.response.length - 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['response'],
        message:
          'a turn carries exactly one agent_message_done event, as its last entry'
      })
    if (
      turn.cancel_after !== undefined &&
      turn.cancel_after >= turn.response.length - 1
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cancel_after'],
        message:
          'cancel_after must precede the final agent_message_done entry; the replay stops a turn that is still running'
      })
  })
export type AgentConversationTurn = z.infer<typeof zTurn>

export const zAgentConversation = z
  .object({
    schema_version: z.literal('agent-conversation.v2'),
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
          exported_at: z.string().datetime()
        })
        .optional()
    }),
    workflow: zAgentConversationWorkflow,
    // One thread; each turn lands on the graph the previous turn left.
    turns: z.array(zTurn).min(1)
  })
  .superRefine((conversation, ctx) => {
    if (conversation.source.response_side !== 'recorded') return
    if (conversation.source.capture === undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['source', 'capture'],
        message: 'recorded responses require backend capture provenance'
      })
    for (const [index, turn] of conversation.turns.entries())
      if (turn.message_id === undefined)
        ctx.addIssue({
          code: 'custom',
          path: ['turns', index, 'message_id'],
          message: 'recorded turns carry the message id they were captured from'
        })
  })
export type AgentConversation = z.infer<typeof zAgentConversation>

export function listRecordedConversations(): string[] {
  const dir = fileURLToPath(new URL('./conversations/', import.meta.url))
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .map((caseId) => {
      if (loadAgentConversation(caseId).source.response_side !== 'recorded')
        throw new Error(
          `${caseId} is not marked response_side: recorded; the replay suite only carries recordings`
        )
      return caseId
    })
    .sort()
}

// The first place the projection holds no value, if any. The persisted draft
// is this projection as JSON, so a value JSON cannot carry never reached the
// document, whatever the applier said about the op that wrote it.
function missingValue(value: unknown, path: string): string | null {
  if (value === undefined) return path
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const hit = missingValue(item, `${path}[${index}]`)
      if (hit !== null) return hit
    }
    return null
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const hit = missingValue(item, `${path}.${key}`)
      if (hit !== null) return hit
    }
  }
  return null
}

// Applies every recorded op through the fixture's own host, minted from the
// recording's seed and catalog. This is application, not parsing: it shows
// the applier accepts each op against that document and that the projection
// it leaves carries a value everywhere. The returned host holds the applied
// document for whoever needs to compare against it.
export function assertOpsApply(conversation: AgentConversation): HostDoc {
  const { workflow } = conversation
  const host = new HostDoc(workflow.id, workflow.seed, workflow.catalog)
  for (const [turnIndex, turn] of conversation.turns.entries())
    for (const [entryIndex, entry] of turn.response.entries()) {
      if (entry.kind !== 'graph_ops') continue
      const label = `turn ${turnIndex} entry ${entryIndex}`
      let projection: unknown
      try {
        host.apply(entry.ops)
        projection = host.projection()
      } catch (error) {
        throw new Error(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        )
      }
      const hole = missingValue(projection, 'projection')
      if (hole !== null)
        throw new Error(`${label}: the projection carries no value at ${hole}`)
    }
  return host
}

export function loadAgentConversation(caseId: string): AgentConversation {
  const file = fileURLToPath(
    new URL(`./conversations/${caseId}.json`, import.meta.url)
  )
  const conversation = zAgentConversation.parse(
    JSON.parse(readFileSync(file, 'utf-8'))
  )
  assertOpsApply(conversation)
  return conversation
}
