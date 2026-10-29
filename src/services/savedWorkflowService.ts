import type { GetWorkflowResponse } from '@comfyorg/ingest-types'
import {
  zGetWorkflowContentResponse,
  zGetWorkflowResponse
} from '@comfyorg/ingest-types/zod'
import { isEqual } from 'es-toolkit'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { api } from '@/scripts/api'

type SavedWorkflowRead =
  | {
      ok: true
      metadata: GetWorkflowResponse
      workflow: ComfyWorkflowJSON
      path: string
    }
  | {
      ok: false
      status: number | null
      reason: 'unavailable' | 'file_unavailable' | 'file_mismatch' | 'cancelled'
    }

function failure(
  reason: Exclude<
    Extract<SavedWorkflowRead, { ok: false }>['reason'],
    'cancelled'
  >,
  status: number | null = null,
  cause?: unknown
): Extract<SavedWorkflowRead, { ok: false }> {
  reportError(cause ?? new Error('Unable to load the private saved workflow'), {
    surface: 'graph',
    errorType: 'error_loading_saved_workflow_link',
    context: { reason, status }
  })
  return { ok: false, reason, status }
}

export async function fetchSavedWorkflow(
  workflowId: string,
  signal?: AbortSignal
): Promise<SavedWorkflowRead> {
  try {
    signal?.throwIfAborted()
    const path = `/workflows/${encodeURIComponent(workflowId)}`
    const metadataResponse = await api.fetchApi(path, { signal })
    if (!metadataResponse.ok)
      return failure('unavailable', metadataResponse.status)
    const metadataResult = zGetWorkflowResponse.safeParse(
      await metadataResponse.json()
    )
    if (!metadataResult.success || metadataResult.data.id !== workflowId)
      return failure('unavailable')
    const metadata = metadataResult.data
    signal?.throwIfAborted()

    const contentResponse = await api.fetchApi(`${path}/content`, { signal })
    if (!contentResponse.ok)
      return failure('unavailable', contentResponse.status)
    const contentResult = zGetWorkflowContentResponse.safeParse(
      await contentResponse.json()
    )
    if (!contentResult.success) return failure('unavailable')
    const content = contentResult.data
    const workflow = await validateComfyWorkflow(
      content.workflow_json,
      () => {}
    )
    if (!workflow) return failure('unavailable')
    const name = metadata.name
    if (
      !name ||
      name.includes('\\') ||
      Array.from(name).some(
        (character) => character < ' ' || character === '\u007f'
      ) ||
      name
        .split('/')
        .some((part) => part === '' || part === '.' || part === '..')
    )
      return failure('file_unavailable')
    const filePath = `workflows/${name}.json`
    signal?.throwIfAborted()
    const fileResponse = await api.getUserData(filePath, { signal })
    if (!fileResponse.ok)
      return failure(
        fileResponse.status === 404 ? 'file_unavailable' : 'unavailable',
        fileResponse.status
      )
    if (!isEqual(await fileResponse.json(), content.workflow_json))
      return failure('file_mismatch')
    return { ok: true, metadata, workflow, path: filePath }
  } catch (cause) {
    if (signal?.aborted) return { ok: false, reason: 'cancelled', status: null }
    return failure('unavailable', null, cause)
  }
}
