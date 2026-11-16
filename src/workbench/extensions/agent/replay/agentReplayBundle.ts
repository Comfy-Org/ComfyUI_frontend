import { z } from 'zod'

const zJsonObject = z.record(z.string(), z.unknown())
const zIsoDate = z.string().datetime({ offset: true })

export const AGENT_REPLAY_BUNDLE_VERSION = 'agent-replay-bundle.v1' as const

const zAgentReplayFidelity = z
  .object({
    complete: z.boolean(),
    level: z.enum(['full', 'degraded']),
    reasons: z.array(z.string().min(1)).default([])
  })
  .superRefine((value, ctx) => {
    if (value.complete !== (value.level === 'full'))
      ctx.addIssue({
        code: 'custom',
        path: ['complete'],
        message: 'complete must be true exactly when fidelity level is full'
      })
    if ((value.level === 'degraded') !== value.reasons.length > 0)
      ctx.addIssue({
        code: 'custom',
        path: ['reasons'],
        message:
          'reasons must be non-empty exactly when fidelity level is degraded'
      })
  })

const zWorkflowSnapshot = z.object({
  workflow_id: z.string().min(1),
  workflow: zJsonObject,
  initial_doc_seq: z.number().int().nonnegative()
})

const zReplayEntry = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('visible_event'),
    at_ms: z.number().int().nonnegative(),
    event: zJsonObject
  }),
  z.object({
    kind: z.literal('doc_frame'),
    at_ms: z.number().int().nonnegative(),
    workflow_id: z.string().min(1),
    seq: z.number().int().nonnegative(),
    frame: zJsonObject
  }),
  z.object({
    kind: z.literal('tool_outcome'),
    at_ms: z.number().int().nonnegative(),
    tool_call_id: z.string().min(1),
    tool_name: z.string().min(1),
    status: z.enum(['succeeded', 'failed', 'cancelled']),
    summary: z.string().optional()
  })
])

const zAgentReplayBundleShape = z.object({
  schema_version: z.literal(AGENT_REPLAY_BUNDLE_VERSION),
  replay_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  target: z.enum(['cloud', 'local']),
  environment: z.enum(['local', 'test', 'staging', 'production']),
  captured_at: zIsoDate,
  expires_at: zIsoDate,
  builds: z.object({
    cloud: z.string().min(1).optional(),
    frontend: z.string().min(1),
    comfyui: z.string().min(1).optional()
  }),
  workflows: z.array(zWorkflowSnapshot).min(1),
  node_definitions: z.record(z.string(), zJsonObject),
  entries: z.array(zReplayEntry).min(1),
  final_graph_digests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  fidelity: zAgentReplayFidelity
})

type AgentReplayBundleV1 = z.infer<typeof zAgentReplayBundleShape>

function validateReplayBundle(
  bundle: AgentReplayBundleV1,
  ctx: z.RefinementCtx
) {
  validateReplayExpiry(bundle, ctx)
  const workflows = validateWorkflows(bundle, ctx)
  validateEntries(bundle, workflows, ctx)
  validateDigests(bundle, workflows, ctx)
}

function validateReplayExpiry(
  bundle: AgentReplayBundleV1,
  ctx: z.RefinementCtx
) {
  if (Date.parse(bundle.expires_at) <= Date.parse(bundle.captured_at))
    ctx.addIssue({
      code: 'custom',
      path: ['expires_at'],
      message: 'expires_at must be after captured_at'
    })
}

function validateWorkflows(bundle: AgentReplayBundleV1, ctx: z.RefinementCtx) {
  const initialSequences = new Map<string, number>()
  for (const [
    index,
    { workflow_id: workflowId, initial_doc_seq: initialSequence }
  ] of bundle.workflows.entries()) {
    if (initialSequences.has(workflowId))
      ctx.addIssue({
        code: 'custom',
        path: ['workflows', index, 'workflow_id'],
        message: 'workflow snapshots must have unique workflow_id values'
      })
    initialSequences.set(workflowId, initialSequence)
  }
  return initialSequences
}

function validateEntries(
  bundle: AgentReplayBundleV1,
  workflows: Map<string, number>,
  ctx: z.RefinementCtx
) {
  const lastDocumentSequence = new Map(workflows)
  for (const [index, entry] of bundle.entries.entries()) {
    if (entry.kind === 'doc_frame') {
      if (!workflows.has(entry.workflow_id))
        ctx.addIssue({
          code: 'custom',
          path: ['entries', index, 'workflow_id'],
          message: 'doc frame references an unknown workflow'
        })
      const lastSequence = lastDocumentSequence.get(entry.workflow_id)
      if (lastSequence !== undefined && entry.seq <= lastSequence)
        ctx.addIssue({
          code: 'custom',
          path: ['entries', index, 'seq'],
          message:
            'document frame sequences must increase per workflow, starting after initial_doc_seq'
        })
      lastDocumentSequence.set(entry.workflow_id, entry.seq)
    }

    if (index === 0) continue
    if (bundle.entries[index].at_ms < bundle.entries[index - 1].at_ms)
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'at_ms'],
        message: 'replay entries must be ordered by at_ms'
      })
  }
}

function validateDigests(
  bundle: AgentReplayBundleV1,
  workflows: Map<string, number>,
  ctx: z.RefinementCtx
) {
  for (const workflowId of Object.keys(bundle.final_graph_digests))
    if (!workflows.has(workflowId))
      ctx.addIssue({
        code: 'custom',
        path: ['final_graph_digests', workflowId],
        message: 'digest references an unknown workflow'
      })
  if (bundle.fidelity.level !== 'full') return
  for (const workflowId of workflows.keys())
    if (!Object.hasOwn(bundle.final_graph_digests, workflowId))
      ctx.addIssue({
        code: 'custom',
        path: ['final_graph_digests', workflowId],
        message: 'full fidelity requires a final digest for every workflow'
      })
}

const zAgentReplayBundleV1 =
  zAgentReplayBundleShape.superRefine(validateReplayBundle)

export type AgentReplayBundleResult =
  | { ok: true; bundle: AgentReplayBundleV1 }
  | {
      ok: false
      reason: 'invalid_bundle' | 'unsupported_version'
      detail: string
    }

export function parseAgentReplayBundle(
  value: unknown
): AgentReplayBundleResult {
  if (
    typeof value === 'object' &&
    value !== null &&
    'schema_version' in value &&
    typeof value.schema_version === 'string' &&
    value.schema_version !== AGENT_REPLAY_BUNDLE_VERSION
  )
    return {
      ok: false,
      reason: 'unsupported_version',
      detail: `unsupported replay bundle version: ${value.schema_version}`
    }

  const parsed = zAgentReplayBundleV1.safeParse(value)
  if (parsed.success) return { ok: true, bundle: parsed.data }
  return {
    ok: false,
    reason: 'invalid_bundle',
    detail: parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
  }
}
