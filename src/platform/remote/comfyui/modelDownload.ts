import { api } from '@/scripts/api'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import { zMissingModelDownloadResponse } from '@/platform/remote/comfyui/execution/types'
import type { MissingModelDownloadResponse } from '@/platform/remote/comfyui/execution/types'
import type { TaskResult } from '@/platform/tasks/services/taskService'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import { toError } from '@/utils/errorUtil'

async function postDownloadRequest(
  path: string,
  payload: object
): Promise<TaskResult<Response>> {
  try {
    const response = await api.fetchApi(
      `/experiment/models/download_missing${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    if (!response.ok) {
      const error = await parseErrorResponse(response)
      return {
        ok: false,
        error: new Error(`HTTP ${response.status}: ${error.message}`)
      }
    }
    return { ok: true, value: response }
  } catch (error: unknown) {
    return { ok: false, error: toError(error) }
  }
}

export async function downloadMissingModels(
  models: ModelWithUrl[],
  clientId: string,
  batchId: string
): Promise<TaskResult<MissingModelDownloadResponse>> {
  const response = await postDownloadRequest('', {
    models,
    client_id: clientId,
    batch_id: batchId
  })
  if (!response.ok) return response
  try {
    return {
      ok: true,
      value: zMissingModelDownloadResponse.parse(await response.value.json())
    }
  } catch (error: unknown) {
    return { ok: false, error: toError(error) }
  }
}

export async function cancelMissingModelDownload(
  taskId: string,
  clientId: string,
  batchId: string
): Promise<TaskResult<boolean>> {
  const result = await postDownloadRequest('/cancel', {
    task_id: taskId,
    client_id: clientId,
    batch_id: batchId
  })
  return result.ok ? { ok: true, value: true } : result
}
