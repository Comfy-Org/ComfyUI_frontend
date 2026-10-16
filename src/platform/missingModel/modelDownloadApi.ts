import { z } from 'zod'

import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import { api } from '@/scripts/api'

const modelDownloadSchema = z.object({
  name: z.string(),
  directory: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  bytes_downloaded: z.number(),
  bytes_total: z.number().nullable(),
  error: z.string().nullable()
})

const batchSchema = z.object({ models: z.array(modelDownloadSchema) })
const startedBatchSchema = batchSchema.extend({ batch_id: z.string() })

export type ModelDownloadStatus = z.infer<typeof modelDownloadSchema>

export async function startModelDownloadBatch(models: ModelWithUrl[]) {
  const response = await api.fetchApi('/models/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ models })
  })
  if (response.status === 404) return { status: 'unavailable' as const }
  if (!response.ok) return { status: 'failed' as const }
  return {
    status: 'accepted' as const,
    batch: startedBatchSchema.parse(await response.json())
  }
}

export async function getModelDownloadBatch(batchId: string) {
  const response = await api.fetchApi(`/models/download/${batchId}`)
  if (!response.ok) return null
  return batchSchema.parse(await response.json())
}
