import { z } from 'zod'
import { validate as isUuid } from 'uuid'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { api } from '@/scripts/api'

const savedFileSnapshotSchema = z.object({
  id: z.string().refine((id) => isUuid(id) && id === id.toLowerCase()),
  path: z
    .string()
    .refine(
      (path) =>
        path.startsWith('workflows/') &&
        path.endsWith('.json') &&
        path.split('/').at(-1) !== '.json' &&
        path.split('/').at(-1) !== '.index.json' &&
        !path.includes('\\') &&
        !Array.from(path).some(
          (character) => character < ' ' || character === '\u007f'
        ) &&
        !path
          .split('/')
          .some((part) => part === '' || part === '.' || part === '..')
    ),
  content: z.string(),
  modified: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  size: z.number().int().nonnegative()
})

export type SavedFileSnapshot = z.infer<typeof savedFileSnapshotSchema>

type SavedWorkflowRead =
  | ({ ok: true; workflow: ComfyWorkflowJSON } & SavedFileSnapshot)
  | {
      ok: false
      status: number | null
      reason: 'unavailable' | 'cancelled'
    }

function failure(
  status: number | null = null,
  cause?: unknown
): Extract<SavedWorkflowRead, { ok: false }> {
  const reason = 'unavailable'
  reportError(cause ?? new Error('Unable to load the private saved workflow'), {
    surface: 'graph',
    errorType: 'error_loading_saved_workflow_link',
    context: { reason, status }
  })
  return { ok: false, reason, status }
}

export async function fetchSavedWorkflow(
  id: string,
  signal?: AbortSignal
): Promise<SavedWorkflowRead> {
  try {
    signal?.throwIfAborted()
    const response = await api.fetchApi(
      `/userdata-files/${encodeURIComponent(id)}`,
      { signal }
    )
    signal?.throwIfAborted()
    if (!response.ok) return failure(response.status)
    const result = savedFileSnapshotSchema.safeParse(await response.json())
    if (!result.success || result.data.id !== id) return failure()
    const workflow = await validateComfyWorkflow(
      JSON.parse(result.data.content),
      () => {}
    )
    signal?.throwIfAborted()
    if (!workflow) return failure()
    return { ok: true, ...result.data, workflow }
  } catch (cause) {
    if (signal?.aborted) return { ok: false, reason: 'cancelled', status: null }
    return failure(null, cause)
  }
}
