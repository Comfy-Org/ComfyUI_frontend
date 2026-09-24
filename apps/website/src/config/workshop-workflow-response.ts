import { z } from 'astro/zod'

import type { components } from '@comfyorg/registry-types'

import type { RunOutput } from './workshop-run'

type Schemas = components['schemas']
export type WorkflowRun = Schemas['WorkshopWorkflowRun']
export type WorkflowRunSummary = Schemas['WorkshopWorkflowRunSummary']
export type WorkflowRunRequest = Schemas['WorkshopWorkflowRunRequest']
export type WorkflowAccess = Schemas['WorkshopMediaAccess']
export type WorkflowErrorCode = Schemas['WorkshopErrorCode']

export const WORKFLOW_CONTROL_BYTES = 256 * 1024
export const WORKFLOW_FILE_BYTES = 25 * 1024 * 1024
export const WORKFLOW_INPUT_BYTES = 50 * 1024 * 1024
export const workflowIdSchema = z
  .string()
  .regex(/^workflows\/[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const workflowRunIdSchema = z.uuid()
export const workflowInputsSchema = z
  .record(
    z.string().min(1).max(256),
    z.union([
      z.string().max(WORKFLOW_CONTROL_BYTES),
      z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
      z.boolean()
    ])
  )
  .refine((inputs) => Object.keys(inputs).length <= 128)
export const workflowRequestSchema: z.ZodType<WorkflowRunRequest> = z
  .object({
    workflowId: workflowIdSchema,
    definitionVersion: z.string().min(1).max(64),
    appInputs: workflowInputsSchema
  })
  .strict()
  .refine(
    (request) =>
      new TextEncoder().encode(JSON.stringify(request)).byteLength <=
      WORKFLOW_CONTROL_BYTES
  )
const timestamp = z.iso.datetime({ offset: true })
const apiPath = z
  .string()
  .max(2048)
  .regex(/^\/(v1\/workshop\/|customers\/storage\/)[a-zA-Z0-9/_-]+$/)
export const workflowHttpsUrl = z
  .url()
  .max(8192)
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && !url.username && !url.password && !url.hash
    )
  })

const errorCode = z.enum([
  'invalid_request',
  'invalid_input',
  'payload_too_large',
  'unsupported_media_type',
  'not_authenticated',
  'access_denied',
  'workflow_not_found',
  'run_not_found',
  'definition_changed',
  'definition_incompatible',
  'idempotency_conflict',
  'plan_required',
  'insufficient_credits',
  'rate_limited',
  'admission_disabled',
  'upload_pending',
  'media_unavailable',
  'run_not_complete',
  'execution_failed',
  'delivery_failed',
  'temporarily_unavailable',
  'internal_error'
])
const errorDetail = z
  .object({
    code: errorCode,
    message: z.string().max(1024),
    fieldId: z.string().min(1).max(256).optional()
  })
  .strict()
export const workflowErrorSchema: z.ZodType<Schemas['WorkshopErrorResponse']> =
  z
    .object({
      error: errorDetail,
      supportId: z.uuid().optional()
    })
    .strict()

export const workflowSummarySchema: z.ZodType<WorkflowRunSummary> = z
  .object({
    id: workflowRunIdSchema,
    workflowId: workflowIdSchema,
    definitionVersion: z.string().min(1).max(64),
    state: z.enum([
      'submitting',
      'submission_unknown',
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled'
    ]),
    outputState: z.enum(['pending', 'ready', 'partial', 'failed', 'expired']),
    statusUrl: apiPath,
    createdAt: timestamp,
    updatedAt: timestamp,
    observedAt: timestamp.optional(),
    startedAt: timestamp.optional(),
    completedAt: timestamp.optional(),
    cancelRequestedAt: timestamp.optional(),
    error: errorDetail.optional()
  })
  .strict()
  .refine((run) => run.statusUrl === workflowRunPath(run.id))

export const workflowAccessSchema: z.ZodType<WorkflowAccess> = z
  .object({
    url: workflowHttpsUrl,
    expiresAt: timestamp,
    refreshUrl: apiPath,
    mimeType: z
      .string()
      .max(127)
      .regex(/^(image|video|audio)\/[a-zA-Z0-9.+-]+$/),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(64 * 1024 * 1024),
    assetExpiresAt: timestamp.optional()
  })
  .strict()

export const workflowRuntimeSchema: z.ZodType<
  Schemas['WorkshopRuntimeObservation']
> = z.union([
  z
    .object({ state: z.literal('unknown'), observedAt: timestamp.optional() })
    .strict(),
  z
    .object({
      state: z.enum(['ready', 'starting', 'idle', 'unavailable']),
      observedAt: timestamp
    })
    .strict()
])

const outputSchema: z.ZodType<Schemas['WorkshopWorkflowOutput']> = z
  .object({
    id: workflowRunIdSchema,
    bindingId: z.string().min(1).max(256),
    fileIndex: z.number().int().min(0).max(15),
    kind: z.enum(['image', 'video', 'audio']),
    accessUrl: apiPath,
    delivery: z.discriminatedUnion('state', [
      z
        .object({ state: z.literal('ready'), access: workflowAccessSchema })
        .strict(),
      z
        .object({
          state: z.enum(['pending', 'failed', 'expired']),
          error: errorDetail.optional()
        })
        .strict()
    ])
  })
  .strict()
  .refine(
    (output) =>
      output.delivery.state !== 'ready' ||
      (output.delivery.access.refreshUrl === output.accessUrl &&
        output.delivery.access.mimeType.startsWith(`${output.kind}/`))
  )

export const workflowRunSchema: z.ZodType<WorkflowRun> = z
  .object({
    run: workflowSummarySchema,
    runtime: workflowRuntimeSchema,
    outputs: z.array(outputSchema).max(16),
    retryOutputDeliveryUrl: apiPath
  })
  .strict()
  .refine((result) => {
    const path = workflowRunPath(result.run.id)
    const ids = new Set<string>()
    const positions = new Set<string>()
    let bytes = 0
    for (const output of result.outputs) {
      const position = JSON.stringify([output.bindingId, output.fileIndex])
      if (
        ids.has(output.id) ||
        positions.has(position) ||
        output.accessUrl !== `${path}/outputs/${output.id}/access`
      )
        return false
      ids.add(output.id)
      positions.add(position)
      if (output.delivery.state === 'ready') {
        if (result.run.state !== 'succeeded') return false
        bytes += output.delivery.access.sizeBytes
      }
    }
    return (
      bytes <= 128 * 1024 * 1024 &&
      result.retryOutputDeliveryUrl === `${path}/outputs/retry`
    )
  })

export const workflowHistorySchema: z.ZodType<
  Schemas['WorkshopWorkflowRunPage']
> = z
  .object({
    items: z.array(workflowSummarySchema).max(100),
    nextCursor: z.string().min(1).max(2048).optional()
  })
  .strict()

export const workflowUploadSchema = z
  .object({
    upload_url: workflowHttpsUrl,
    workflow_upload: z
      .object({
        id: workflowRunIdSchema,
        inputUrl: workflowHttpsUrl,
        uploadHeaders: z.record(z.string(), z.string().max(2048)),
        uploadExpiresAt: timestamp,
        assetExpiresAt: timestamp,
        accessUrl: apiPath
      })
      .strict() satisfies z.ZodType<Schemas['WorkshopUploadGrant']>
  })
  .strict() satisfies z.ZodType<Schemas['CustomerStorageResourceResponse']>

export function workflowRunPath(id: string): string {
  return `/v1/workshop/workflow-runs/${workflowRunIdSchema.parse(id)}`
}

export function workflowOutputs(result: WorkflowRun): RunOutput[] {
  return result.outputs.flatMap((output) =>
    output.delivery.state === 'ready'
      ? [
          {
            id: output.id,
            kind: output.kind,
            url: output.delivery.access.url,
            download: {
              url: output.delivery.access.url,
              expiresAt: Date.parse(output.delivery.access.expiresAt)
            },
            ...(output.delivery.access.assetExpiresAt
              ? { expiresAt: Date.parse(output.delivery.access.assetExpiresAt) }
              : {}),
            byteLength: output.delivery.access.sizeBytes,
            fileName: `${result.run.id}-${output.id}`
          }
        ]
      : []
  )
}

export function workflowSettled(result: WorkflowRun): boolean {
  return (
    result.run.state === 'failed' ||
    result.run.state === 'cancelled' ||
    (result.run.state === 'succeeded' && result.run.outputState !== 'pending')
  )
}

export function workflowOutputState(
  outputs: WorkflowRun['outputs']
): WorkflowRun['run']['outputState'] {
  const ready = outputs.filter(
    (output) => output.delivery.state === 'ready'
  ).length
  if (ready === outputs.length && ready > 0) return 'ready'
  if (ready > 0) return 'partial'
  if (
    outputs.length > 0 &&
    outputs.every((output) => output.delivery.state === 'expired')
  )
    return 'expired'
  return outputs.some((output) => output.delivery.state === 'failed')
    ? 'failed'
    : 'pending'
}
