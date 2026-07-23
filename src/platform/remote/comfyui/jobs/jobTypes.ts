/**
 * @fileoverview Jobs API types - Backend job API format
 * @module platform/remote/comfyui/jobs/jobTypes
 *
 * These types represent the jobs API format returned by the backend.
 * Jobs API provides a memory-optimized alternative to history API.
 */

import { z } from 'zod'

import { resultItemType, zTaskOutput } from '@/schemas/apiSchema'

const zJobStatus = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
])

const zPreviewOutput = z
  .object({
    filename: z.string().optional(),
    subfolder: z.string().optional(),
    type: resultItemType.optional(),
    nodeId: z.string(),
    mediaType: z.string(),
    display_name: z.string().optional()
  })
  .passthrough()

/**
 * Execution error from Jobs API.
 * Similar to ExecutionErrorWsMessage but with optional prompt_id/timestamp/executed
 * since these may not be present in stored errors or infrastructure-generated errors.
 */
const zExecutionError = z
  .object({
    prompt_id: z.string().optional(),
    timestamp: z.number().optional(),
    node_id: z.string(),
    node_type: z.string(),
    executed: z.array(z.string()).optional(),
    exception_message: z.string(),
    exception_type: z.string(),
    traceback: z.array(z.string()),
    current_inputs: z.unknown(),
    current_outputs: z.unknown()
  })
  .passthrough()

export type ExecutionError = z.infer<typeof zExecutionError>

/**
 * Raw job from API - uses passthrough to allow extra fields
 */
const zRawJobListItem = z
  .object({
    id: z.string(),
    status: zJobStatus,
    create_time: z.number(),
    execution_start_time: z.number().nullable().optional(),
    execution_end_time: z.number().nullable().optional(),
    preview_output: zPreviewOutput.nullable().optional(),
    outputs_count: z.number().nullable().optional(),
    execution_error: zExecutionError.nullable().optional(),
    workflow_id: z.string().nullable().optional(),
    priority: z.number().optional()
  })
  .passthrough()

/**
 * Job detail - returned by GET /api/jobs/{job_id} (detail endpoint)
 * Includes full workflow and outputs for re-execution and downloads
 */
export const zJobDetail = zRawJobListItem
  .extend({
    workflow: z.unknown().optional(),
    outputs: zTaskOutput.optional(),
    update_time: z.number().optional(),
    execution_status: z.unknown().optional(),
    execution_meta: z.unknown().optional()
  })
  .passthrough()

const zPaginationInfo = z.object({
  offset: z.number(),
  limit: z.number(),
  total: z.number(),
  has_more: z.boolean()
})

export const zJobsListResponse = z.object({
  jobs: z.array(zRawJobListItem),
  pagination: zPaginationInfo
})

/**
 * A single output asset produced by a job, enriched with per-output node
 * context (`node_id`, `output_key`, `output_index`) correlated from the job's
 * execution outputs by content hash. Node-context fields are null when the
 * asset cannot be matched to an output entry.
 * Returned by GET /api/jobs/{job_id}/assets.
 */
const zJobOutputAsset = z
  .object({
    id: z.string(),
    name: z.string(),
    hash: z.string().nullable().optional(),
    preview_url: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
    node_id: z.string().nullable().optional(),
    output_key: z.string().nullable().optional(),
    output_index: z.number().nullable().optional(),
    created_at: z.string()
  })
  .passthrough()

/**
 * Paginated list of a single job's output assets. The envelope is lenient
 * where `zJobsListResponse` is strict: the cloud serialiser drops null fields
 * (`exclude_none=True`) and this endpoint's pagination convention is
 * unconfirmed, so a missing bookkeeping field must degrade to "no more pages"
 * rather than reject the payload and silently disable enrichment.
 */
export const zJobAssetsResponse = z.object({
  job_id: z.string().optional(),
  assets: z.array(zJobOutputAsset),
  pagination: z
    .object({
      offset: z.number().nullable().optional(),
      limit: z.number().nullable().optional(),
      total: z.number().nullable().optional(),
      has_more: z.boolean().nullable().optional()
    })
    .optional()
})

/** Schema for workflow container structure in job detail responses */
export const zWorkflowContainer = z.object({
  extra_data: z
    .object({
      extra_pnginfo: z
        .object({
          workflow: z.unknown()
        })
        .optional()
    })
    .optional()
})

export type JobStatus = z.infer<typeof zJobStatus>
export type RawJobListItem = z.infer<typeof zRawJobListItem>
/** Job list item with priority always set (server-provided or synthetic) */
export type JobListItem = RawJobListItem & { priority: number }
export type JobDetail = z.infer<typeof zJobDetail>
export type JobOutputAsset = z.infer<typeof zJobOutputAsset>

/** Task type used in the API (queue vs history endpoints) */
export type APITaskType = 'queue' | 'history'

/** Internal task type derived from job status for UI display */
export type TaskType = 'Running' | 'Pending' | 'History'
