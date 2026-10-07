import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { zTaskResponse as zGeneratedTaskResponse } from '@comfyorg/ingest-types/zod'

import { api } from '@/scripts/api'
import { toError } from '@/utils/errorUtil'

const TASKS_ENDPOINT = '/tasks'

const zTaskStatus = z.union([
  zGeneratedTaskResponse.shape.status,
  z.literal('cancelled')
])

const zTaskResponse = zGeneratedTaskResponse.extend({
  // Cloud commit 13d6f5f9 adds cancellation before generated types can sync.
  status: zTaskStatus
})

/**
 * Result payload of a `task:download_file` task.
 *
 * `/tasks` is shared by every task type, so `TaskResponse.result` stays the
 * generated opaque record and each caller parses the shape its own task type
 * produces. Narrowing `result` on the shared response instead makes `getTask`
 * reject every other task type's result, which silently disables
 * reconciliation for those callers.
 */
const zDownloadFileResult = z.object({
  success: z.boolean(),
  file_path: z.string().optional(),
  bytes_downloaded: z.number().optional(),
  content_type: z.string().optional(),
  hash: z.string().optional(),
  filename: z.string().optional(),
  asset_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  error: z.string().optional()
})

export type TaskResponse = z.infer<typeof zTaskResponse>
export type TaskStatus = TaskResponse['status']
export type TaskResult<T> = { ok: true; value: T } | { ok: false; error: Error }
export type DownloadFileResult = z.infer<typeof zDownloadFileResult>

/** Returns the download-file result, or `undefined` if it is absent or malformed. */
export function parseDownloadFileResult(
  result: unknown
): DownloadFileResult | undefined {
  const parsed = zDownloadFileResult.safeParse(result)
  return parsed.success ? parsed.data : undefined
}

/**
 * Outcome of a cancellation request. Callers need these apart because each one
 * implies a different next step: wait for a terminal status, settle locally
 * because none is coming, or re-read the task's real status.
 */
export type CancelTaskOutcome =
  /** The backend accepted it and will report a terminal status. */
  | 'cancelling'
  /** The task row is gone, so no terminal status will ever arrive. */
  | 'missing'
  /** The backend refused to cancel from the task's current state. */
  | 'not-cancellable'

/**
 * Identifier for a background task tracked by the `/tasks` API.
 *
 * Backed by `TaskResponse.id` which is `z.string().uuid()`. This alias names
 * that primitive at use sites without changing structural typing.
 */
export type TaskId = string

/**
 * A `getTask` failure that proves the task row no longer exists, as opposed to
 * a transient failure worth retrying. Callers tracking a task that can never
 * reach a terminal status need to tell those apart to stop polling it.
 */
export class TaskNotFoundError extends Error {
  constructor(taskId: TaskId) {
    super(`Task not found: ${taskId}`)
    this.name = 'TaskNotFoundError'
  }
}

function createTaskService() {
  async function getTask(taskId: TaskId): Promise<TaskResult<TaskResponse>> {
    try {
      const res = await api.fetchApi(
        `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`
      )

      if (!res.ok) {
        return {
          ok: false,
          error:
            res.status === 404
              ? new TaskNotFoundError(taskId)
              : new Error(`Failed to get task ${taskId}: ${res.status}`)
        }
      }

      const data: unknown = await res.json()
      const result = zTaskResponse.safeParse(data)

      if (!result.success) {
        return {
          ok: false,
          error: new Error(fromZodError(result.error).message)
        }
      }

      return { ok: true, value: result.data }
    } catch (error) {
      return { ok: false, error: toError(error) }
    }
  }

  async function cancelTask(
    taskId: TaskId
  ): Promise<TaskResult<CancelTaskOutcome>> {
    try {
      const res = await api.fetchApi(
        `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`,
        { method: 'DELETE' }
      )
      if (res.status === 404) return { ok: true, value: 'missing' }
      if (res.status === 409) return { ok: true, value: 'not-cancellable' }
      if (!res.ok) {
        // This message reaches a user-facing toast and telemetry, so the
        // response body stays out of it: a 5xx from a gateway or reverse proxy
        // is usually an HTML error page or a stack trace.
        return {
          ok: false,
          error: new Error(`Failed to cancel task ${taskId}: ${res.status}`)
        }
      }
      return { ok: true, value: 'cancelling' }
    } catch (error) {
      return { ok: false, error: toError(error) }
    }
  }

  return { getTask, cancelTask }
}

export const taskService = createTaskService()
