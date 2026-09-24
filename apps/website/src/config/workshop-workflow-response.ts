import { z } from 'astro/zod'
import { zJobDetailResponse } from '@comfyorg/ingest-types/zod'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import type { WorkshopWorkflowDefinition } from './workshop-workflow-definition'
import type { RunOutput } from './workshop-run'

export const WORKFLOW_CONTROL_BYTES = 256 * 1024
export const WORKFLOW_FILE_BYTES = 25 * 1024 * 1024
export const WORKFLOW_INPUT_BYTES = 50 * 1024 * 1024
export const workflowIdSchema = z.string().regex(/^workflows\/[a-z0-9-]+$/)
export const workflowRunIdSchema = z.uuid()
export const workflowInputsSchema = z.record(
  z.string().min(1).max(256),
  z.union([
    z.string().max(WORKFLOW_CONTROL_BYTES),
    z.number().finite(),
    z.boolean()
  ])
)
export const workflowRequestSchema = z
  .object({
    workflowId: workflowIdSchema,
    definitionVersion: z.string().min(1).max(64),
    appInputs: workflowInputsSchema
  })
  .strict()
export type WorkflowRunRequest = z.infer<typeof workflowRequestSchema>
export const workflowHttpsUrl = z
  .url()
  .max(8192)
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && !url.username && !url.password && !url.hash
    )
  })

export type WorkflowErrorCode =
  | 'invalid_request'
  | 'invalid_input'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'not_authenticated'
  | 'access_denied'
  | 'workflow_not_found'
  | 'run_not_found'
  | 'definition_changed'
  | 'definition_incompatible'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'media_unavailable'
  | 'execution_failed'
  | 'delivery_failed'
  | 'submission_unknown'

export interface WorkflowAccess {
  readonly url: string
  readonly mimeType: string
}
export interface WorkflowRunSummary {
  readonly id: string
  readonly workflowId: string
  readonly definitionVersion: string
  readonly state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly outputState: 'pending' | 'ready' | 'partial' | 'failed'
  readonly createdAt: string
  readonly updatedAt: string
  readonly startedAt?: string
  readonly completedAt?: string
}
export interface WorkflowRun {
  readonly run: WorkflowRunSummary
  readonly outputs: readonly {
    readonly id: string
    readonly bindingId: string
    readonly fileIndex: number
    readonly kind: 'image' | 'video' | 'audio'
    readonly fileName: string
    readonly delivery:
      | { readonly state: 'ready'; readonly access: WorkflowAccess }
      | { readonly state: 'failed' }
  }[]
}

const cloudOutput = z.object({
  filename: z.string().min(1).max(512),
  short_url: z.string().max(8192)
})

function outputAccess(value: unknown): z.infer<typeof cloudOutput> | undefined {
  const parsed = cloudOutput.safeParse(value)
  if (!parsed.success) return
  const url = new URL(parsed.data.short_url, WORKSHOP_CLOUD_BASE_URL)
  if (
    url.origin !== WORKSHOP_CLOUD_BASE_URL ||
    !/^\/api\/s\/[a-zA-Z0-9_-]+$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    return
  return { ...parsed.data, short_url: url.href }
}

function timestamp(value: bigint): string {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new Error('Invalid Cloud timestamp')
  return new Date(number).toISOString()
}

export function cloudWorkflowResult(
  value: unknown,
  definition: WorkshopWorkflowDefinition,
  runId: string
): WorkflowRun {
  const job = zJobDetailResponse.parse(value)
  if (job.id !== runId) throw new Error('Unexpected Cloud job')
  const outputs: WorkflowRun['outputs'] =
    job.status === 'completed'
      ? (definition.outputs ?? []).flatMap<WorkflowRun['outputs'][number]>(
          (binding) => {
            const node = z
              .record(z.string(), z.unknown())
              .safeParse(job.outputs?.[binding.nodeId])
            const items = node.success ? node.data[binding.key] : undefined
            if (!Array.isArray(items) || !items.length)
              return [
                {
                  id: binding.id,
                  bindingId: binding.id,
                  fileIndex: 0,
                  kind: binding.kind,
                  fileName: binding.id,
                  delivery: { state: 'failed' as const }
                }
              ]
            if (items.length > 16) throw new Error('Too many Cloud outputs')
            return items.map((item: unknown, fileIndex) => {
              const selected = outputAccess(item)
              return {
                id: binding.id + ':' + fileIndex,
                bindingId: binding.id,
                fileIndex,
                kind: binding.kind,
                fileName: selected?.filename ?? binding.id,
                delivery: selected
                  ? {
                      state: 'ready' as const,
                      access: {
                        url: selected.short_url,
                        mimeType: binding.kind + '/*'
                      }
                    }
                  : { state: 'failed' as const }
              }
            })
          }
        )
      : []
  if (outputs.length > 16) throw new Error('Too many Cloud outputs')
  const states = {
    pending: 'queued',
    in_progress: 'running',
    completed: 'succeeded',
    failed: 'failed',
    cancelled: 'cancelled'
  } as const
  return {
    run: {
      id: job.id,
      workflowId: definition.id,
      definitionVersion: definition.definitionVersion,
      state: states[job.status],
      outputState:
        job.status === 'completed' ? workflowOutputState(outputs) : 'pending',
      createdAt: timestamp(job.create_time),
      updatedAt: timestamp(job.update_time),
      ...(job.execution_start_time === undefined
        ? {}
        : { startedAt: timestamp(job.execution_start_time) }),
      ...(job.execution_end_time === undefined
        ? {}
        : { completedAt: timestamp(job.execution_end_time) })
    },
    outputs
  }
}

export function workflowOutputs(result: WorkflowRun): RunOutput[] {
  return result.outputs.flatMap((output) =>
    output.delivery.state === 'ready'
      ? [
          {
            id: output.id,
            kind: output.kind,
            url: output.delivery.access.url,
            fileName: output.fileName
          }
        ]
      : []
  )
}

export function workflowSettled(result: WorkflowRun): boolean {
  return ['failed', 'cancelled', 'succeeded'].includes(result.run.state)
}

export function workflowOutputState(
  outputs: WorkflowRun['outputs']
): WorkflowRunSummary['outputState'] {
  const ready = outputs.filter(
    (output) => output.delivery.state === 'ready'
  ).length
  return ready === outputs.length && ready > 0
    ? 'ready'
    : ready > 0
      ? 'partial'
      : 'failed'
}
