import { z } from 'zod'

const zJsonObject = z.record(z.string(), z.unknown())
const zIsoDate = z.string().datetime({ offset: true })

export const AGENT_REPLAY_BUNDLE_VERSION = 'agent-replay-bundle.v1' as const

export const zAgentReplayFidelity = z
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
    if (value.level === 'degraded' && value.reasons.length === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['reasons'],
        message: 'degraded fidelity requires at least one reason'
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

export const zAgentReplayBundleV1 = z
  .object({
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
    final_graph_digests: z.record(
      z.string(),
      z.string().regex(/^[a-f0-9]{64}$/)
    ),
    fidelity: zAgentReplayFidelity
  })
  .superRefine((bundle, ctx) => {
    if (Date.parse(bundle.expires_at) <= Date.parse(bundle.captured_at))
      ctx.addIssue({
        code: 'custom',
        path: ['expires_at'],
        message: 'expires_at must be after captured_at'
      })

    const workflows = new Set(
      bundle.workflows.map(({ workflow_id }) => workflow_id)
    )
    for (const [index, entry] of bundle.entries.entries())
      if (entry.kind === 'doc_frame' && !workflows.has(entry.workflow_id))
        ctx.addIssue({
          code: 'custom',
          path: ['entries', index, 'workflow_id'],
          message: 'doc frame references an unknown workflow'
        })

    for (let index = 1; index < bundle.entries.length; index++)
      if (bundle.entries[index].at_ms < bundle.entries[index - 1].at_ms)
        ctx.addIssue({
          code: 'custom',
          path: ['entries', index, 'at_ms'],
          message: 'replay entries must be ordered by at_ms'
        })

    for (const workflowId of Object.keys(bundle.final_graph_digests))
      if (!workflows.has(workflowId))
        ctx.addIssue({
          code: 'custom',
          path: ['final_graph_digests', workflowId],
          message: 'digest references an unknown workflow'
        })
  })

export type AgentReplayBundleV1 = z.infer<typeof zAgentReplayBundleV1>

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
    value.schema_version !== AGENT_REPLAY_BUNDLE_VERSION
  )
    return {
      ok: false,
      reason: 'unsupported_version',
      detail: `unsupported replay bundle version: ${String(value.schema_version)}`
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
