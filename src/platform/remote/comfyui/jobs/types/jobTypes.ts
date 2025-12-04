/**
 * @fileoverview Jobs API types - Backend job API format
 * @module platform/remote/comfyui/jobs/types/jobTypes
 *
 * These types represent the jobs API format returned by the backend.
 * Jobs API provides a memory-optimized alternative to history API.
 */

import { z } from 'zod'

import { resultItemType, zTaskOutput } from '@/schemas/apiSchema'

// ============================================================================
// Zod Schemas
// ============================================================================

const zJobStatus = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
])

const zPreviewOutput = z
  .object({
    filename: z.string(),
    subfolder: z.string(),
    type: resultItemType
  })
  .passthrough() // Allow extra fields like nodeId, mediaType

/**
 * Raw job from API - uses passthrough to allow extra fields
 */
const zRawJobListItem = z
  .object({
    id: z.string(),
    status: zJobStatus,
    create_time: z.number(),
    preview_output: zPreviewOutput.nullable().optional(),
    outputs_count: z.number().optional(),
    error_message: z.string().nullable().optional(),
    priority: z.number().optional()
  })
  .passthrough() // Allow extra fields like execution_time, workflow_id, update_time

/**
 * Job list item with priority always set (either from server or synthetic)
 */
const zJobListItem = zRawJobListItem.extend({
  priority: z.number() // Always set: server-provided or synthetic (total - offset - index)
})

/**
 * Extra data structure containing workflow
 * Note: workflow is z.unknown() because it goes through validateComfyWorkflow separately
 */
const zExtraData = z
  .object({
    extra_pnginfo: z
      .object({
        workflow: z.unknown()
      })
      .optional()
  })
  .passthrough()

/**
 * Execution error details for failed jobs.
 * Contains the same structure as ExecutionErrorWsMessage from WebSocket.
 */
const zExecutionError = z.object({
  node_id: z.string(),
  node_type: z.string(),
  executed: z.array(z.string()),
  exception_message: z.string(),
  exception_type: z.string(),
  traceback: z.array(z.string()),
  current_inputs: z.unknown(),
  current_outputs: z.unknown()
})

/**
 * Job detail - returned by GET /api/jobs/{job_id} (detail endpoint)
 * Includes full workflow and outputs for re-execution and downloads
 *
 * Note: workflow is at extra_data.extra_pnginfo.workflow (not in a separate workflow object)
 */
export const zJobDetail = zRawJobListItem
  .extend({
    extra_data: zExtraData.optional(),
    prompt: z.record(z.string(), z.unknown()).optional(),
    outputs: zTaskOutput.optional(),
    execution_time: z.number().optional(),
    workflow_id: z.string().nullable().optional(),
    execution_error: zExecutionError.nullable().optional()
  })
  .passthrough()

/**
 * Jobs list response structure - raw from API (before synthetic priority)
 */
export const zJobsListResponse = z
  .object({
    jobs: z.array(zRawJobListItem),
    total: z.number()
  })
  .passthrough() // Allow extra fields like has_more, offset, limit

// ============================================================================
// TypeScript Types (derived from Zod schemas)
// ============================================================================

export type JobStatus = z.infer<typeof zJobStatus>
export type RawJobListItem = z.infer<typeof zRawJobListItem>
export type JobListItem = z.infer<typeof zJobListItem>
export type JobDetail = z.infer<typeof zJobDetail>
