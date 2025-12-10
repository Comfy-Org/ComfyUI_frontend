import { z } from 'zod'

import { resultItemType, zTaskOutput } from '@/schemas/apiSchema'

const zJobStatus = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
])

const zPreviewOutput = z.object({
  filename: z.string(),
  subfolder: z.string(),
  type: resultItemType
})

/**
 * Execution error details for failed jobs.
 * Contains the same structure as ExecutionErrorWsMessage from WebSocket.
 */
const zExecutionError = z.object({
  prompt_id: z.string().optional(),
  timestamp: z.number().optional(),
  node_id: z.string(),
  node_type: z.string(),
  executed: z.array(z.string()).optional(),
  exception_message: z.string(),
  exception_type: z.string(),
  traceback: z.array(z.string()),
  current_inputs: z.record(z.string(), z.unknown()),
  current_outputs: z.record(z.string(), z.unknown())
})

export type ExecutionError = z.infer<typeof zExecutionError>

/** Raw job from API list endpoint */
const zRawJobListItem = z.object({
  id: z.string(),
  status: zJobStatus,
  create_time: z.number(),
  execution_start_time: z.number().optional(),
  execution_end_time: z.number().optional(),
  preview_output: zPreviewOutput.optional(),
  outputs_count: z.number().optional(),
  execution_error: zExecutionError.optional(),
  workflow_id: z.string().optional(),
  priority: z.number().optional()
})

/**
 * Job detail - returned by GET /api/jobs/{job_id} (detail endpoint)
 * Includes full workflow and outputs for re-execution and downloads
 */
export const zJobDetail = zRawJobListItem.extend({
  workflow: z.unknown().optional(),
  outputs: zTaskOutput.optional(),
  update_time: z.number().optional(),
  execution_status: z.unknown().optional(),
  execution_meta: z.unknown().optional()
})

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

export type JobStatus = z.infer<typeof zJobStatus>
export type RawJobListItem = z.infer<typeof zRawJobListItem>
/** Job list item with priority always set (server-provided or synthetic) */
export type JobListItem = RawJobListItem & { priority: number }
export type JobDetail = z.infer<typeof zJobDetail>
