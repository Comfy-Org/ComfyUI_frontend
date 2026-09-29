/**
 * CAVEAT: The `payload` and `result` schemas below are specific to
 * `task:download_file` tasks. Other task types may have different
 * payload/result structures. We are not generalizing this until
 * additional use cases arise.
 */
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

const zTaskResponse = zGeneratedTaskResponse.extend({
  // Cloud commit 13d6f5f9 adds cancellation before generated types can sync.
  status: zTaskStatus,
  result: zDownloadFileResult.optional()
})

export type TaskResponse = z.infer<typeof zTaskResponse>
export type TaskStatus = TaskResponse['status']
export type TaskResult<T> = { ok: true; value: T } | { ok: false; error: Error }

/**
 * Identifier for a background task tracked by the `/tasks` API.
 *
 * Backed by `TaskResponse.id` which is `z.string().uuid()`. This alias names
 * that primitive at use sites without changing structural typing.
 */
export type TaskId = string

function createTaskService() {
  async function getTask(taskId: TaskId): Promise<TaskResult<TaskResponse>> {
    try {
      const res = await api.fetchApi(
        `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`
      )

      if (!res.ok) {
        const message =
          res.status === 404
            ? `Task not found: ${taskId}`
            : `Failed to get task ${taskId}: ${res.status}`
        return { ok: false, error: new Error(message) }
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

  async function cancelTask(taskId: TaskId): Promise<TaskResult<boolean>> {
    try {
      const res = await api.fetchApi(
        `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`,
        { method: 'DELETE' }
      )
      if (res.status === 404 || res.status === 409) {
        return { ok: true, value: false }
      }
      if (!res.ok) {
        const detail = await res.text()
        return {
          ok: false,
          error: new Error(
            `Failed to cancel task ${taskId}: ${res.status}${detail ? ` ${detail}` : ''}`
          )
        }
      }
      return { ok: true, value: true }
    } catch (error) {
      return { ok: false, error: toError(error) }
    }
  }

  return { getTask, cancelTask }
}

export const taskService = createTaskService()
