/**
 * Task Service for reading and cancelling background tasks.
 *
 * CAVEAT: The `payload` and `result` schemas below are specific to
 * `task:download_file` tasks. Other task types may have different
 * payload/result structures. We are not generalizing this until
 * additional use cases arise.
 */
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { zTaskResponse as zGeneratedTaskResponse } from '@comfyorg/ingest-types/zod'

import { api } from '@/scripts/api'

const TASKS_ENDPOINT = '/tasks'

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
  result: zDownloadFileResult.optional()
})

export type TaskResponse = z.infer<typeof zTaskResponse>

/**
 * Identifier for a background task tracked by the `/tasks` API.
 *
 * Backed by `TaskResponse.id` which is `z.string().uuid()`. This alias names
 * that primitive at use sites without changing structural typing.
 */
export type TaskId = string

class TaskServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskServiceError'
  }
}

function createTaskService() {
  async function getTask(taskId: TaskId): Promise<TaskResponse> {
    const res = await api.fetchApi(
      `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`
    )

    if (!res.ok) {
      if (res.status === 404) {
        throw new TaskServiceError(`Task not found: ${taskId}`)
      }
      throw new TaskServiceError(`Failed to get task ${taskId}: ${res.status}`)
    }

    const data = await res.json()
    const result = zTaskResponse.safeParse(data)

    if (!result.success) {
      throw new TaskServiceError(fromZodError(result.error).message)
    }

    return result.data
  }

  async function cancelTask(taskId: TaskId): Promise<boolean> {
    const res = await api.fetchApi(
      `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`,
      { method: 'DELETE' }
    )
    if (res.status === 404 || res.status === 409) return false
    if (!res.ok) {
      const detail = await res.text()
      throw new TaskServiceError(
        `Failed to cancel task ${taskId}: ${res.status}${detail ? ` ${detail}` : ''}`
      )
    }
    return true
  }

  return { getTask, cancelTask }
}

export const taskService = createTaskService()
