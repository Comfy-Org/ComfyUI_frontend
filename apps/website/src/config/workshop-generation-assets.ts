import { z } from 'zod'

import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

const outputSchema = z.object({
  index: z.number().int().nonnegative(),
  asset_id: z.string().uuid(),
  kind: z.enum(['image', 'video', 'audio']),
  status: z.enum(['pending', 'saving', 'saved', 'failed', 'unavailable']),
  error_code: z.string().optional()
})

const savedRequestSchema = z.object({
  request_id: z.string().uuid(),
  provider: z.string(),
  model: z.string(),
  created_at: z.string().datetime(),
  status: z.enum(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED']),
  error_type: z.string().optional(),
  asset_save_status: z.enum([
    'pending',
    'saving',
    'saved',
    'partial',
    'failed',
    'not_applicable'
  ]),
  asset_save_error: z.string().optional(),
  asset_outputs: z.array(outputSchema).max(16)
})

const historySchema = z.object({
  requests: z.array(savedRequestSchema).max(100),
  next_cursor: z.string().optional()
})

// This endpoint is additive to the deployed ingest-types snapshot. Keep this
// small boundary validator until that package's next generated contract sync.
const accessSchema = z.object({
  content_url: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:'),
  expires_at: z.string().datetime()
})

export type SavedGeneration = z.infer<typeof savedRequestSchema>
export type SavedGenerationOutput = z.infer<typeof outputSchema>

export class GenerationAccessError extends Error {
  constructor(readonly status: number) {
    super('Generation unavailable')
  }
}

async function authenticatedFetch(
  url: string,
  token: string,
  signal: AbortSignal,
  method = 'GET'
) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  })
  if (!response.ok) throw new GenerationAccessError(response.status)
  return response
}

export async function listWorkshopGenerations(
  token: string,
  signal: AbortSignal,
  modelId?: string,
  cursor?: string
) {
  const query = new URLSearchParams({
    usage_source: 'comfy-models',
    limit: '20'
  })
  if (modelId) {
    const separator = modelId.indexOf('/')
    query.set('provider', modelId.slice(0, separator))
    query.set('model', modelId.slice(separator + 1))
  }
  if (cursor) query.set('cursor', cursor)
  const response = await authenticatedFetch(
    `${WORKSHOP_ROUTER_BASE_URL}/v2/models/requests?${query}`,
    token,
    signal
  )
  return historySchema.parse(await response.json())
}

export async function accessWorkshopAsset(
  assetId: string,
  token: string,
  signal: AbortSignal
) {
  const response = await authenticatedFetch(
    `${WORKSHOP_CLOUD_BASE_URL}/api/assets/${encodeURIComponent(assetId)}/access`,
    token,
    signal,
    'POST'
  )
  return accessSchema.parse(await response.json())
}

export async function cancelWorkshopGeneration(
  generation: SavedGeneration,
  token: string,
  signal: AbortSignal
) {
  const model = `${encodeURIComponent(generation.provider)}/${encodeURIComponent(generation.model)}`
  await authenticatedFetch(
    `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${model}/requests/${generation.request_id}/cancel`,
    token,
    signal,
    'PUT'
  )
}

export function generationPending(generation: SavedGeneration): boolean {
  return (
    generation.status !== 'COMPLETED' ||
    generation.asset_save_status === 'pending' ||
    generation.asset_save_status === 'saving'
  )
}

export async function getWorkshopGeneration(
  modelId: string,
  requestId: string,
  token: string,
  signal: AbortSignal
): Promise<SavedGeneration | undefined> {
  if (!z.string().uuid().safeParse(requestId).success) return
  const separator = modelId.indexOf('/')
  const provider = modelId.slice(0, separator)
  const model = modelId.slice(separator + 1)
  try {
    const response = await authenticatedFetch(
      `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${encodeURIComponent(provider)}/${encodeURIComponent(model)}/requests/${requestId}/status`,
      token,
      signal
    )
    const status = savedRequestSchema
      .omit({ provider: true, model: true })
      .parse(await response.json())
    return { ...status, provider, model }
  } catch (error) {
    if (error instanceof GenerationAccessError && error.status === 404) return
    throw error
  }
}
