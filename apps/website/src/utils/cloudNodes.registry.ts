import { z } from 'zod'

import type { components } from '@comfyorg/registry-types'

export const DEFAULT_REGISTRY_BASE_URL = 'https://api.comfy.org'
const DEFAULT_TIMEOUT_MS = 5_000
const BATCH_SIZE = 50

export type RegistryPack = components['schemas']['Node']

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

const optionalString = z.string().nullish().transform(nullToUndefined)
const optionalNumber = z.number().nullish().transform(nullToUndefined)
const optionalStringArray = z
  .array(z.string())
  .nullish()
  .transform(nullToUndefined)

const RegistryPackSchema = z
  .object({
    id: optionalString,
    name: optionalString,
    description: optionalString,
    icon: optionalString,
    banner_url: optionalString,
    repository: optionalString,
    license: optionalString,
    downloads: optionalNumber,
    github_stars: optionalNumber,
    created_at: optionalString,
    supported_os: optionalStringArray,
    supported_accelerators: optionalStringArray,
    publisher: z
      .object({
        id: optionalString,
        name: optionalString
      })
      .passthrough()
      .nullish()
      .transform(nullToUndefined),
    latest_version: z
      .object({
        version: optionalString,
        createdAt: optionalString
      })
      .passthrough()
      .nullish()
      .transform(nullToUndefined)
  })
  .passthrough()

const RegistryListResponseSchema = z
  .object({
    nodes: z.array(RegistryPackSchema)
  })
  .passthrough()

interface FetchRegistryOptions {
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export async function fetchRegistryPacks(
  packIds: readonly string[],
  options: FetchRegistryOptions = {}
): Promise<Map<string, RegistryPack | null>> {
  const uniquePackIds = [...new Set(packIds.filter((id) => id.length > 0))]
  if (uniquePackIds.length === 0) {
    return new Map()
  }

  const baseUrl = options.baseUrl ?? DEFAULT_REGISTRY_BASE_URL
  const timeoutMs = clampTimeoutMs(options.timeoutMs)
  const fetchImpl = options.fetchImpl ?? fetch

  const batches = chunk(uniquePackIds, BATCH_SIZE)
  const resolved = new Map<string, RegistryPack | null>()
  let successCount = 0
  let failureCount = 0

  for (const batch of batches) {
    const nodes = await fetchBatchWithRetry(
      fetchImpl,
      baseUrl,
      batch,
      timeoutMs
    )
    if (!nodes) {
      failureCount += 1
      for (const packId of batch) {
        resolved.set(packId, null)
      }
      continue
    }

    successCount += 1
    const nodesById = new Map(
      nodes
        .map((node) => [node.id, node] as const)
        .filter(([id]) => typeof id === 'string' && id.length > 0)
    )

    for (const packId of batch) {
      resolved.set(packId, nodesById.get(packId) ?? null)
    }
  }

  if (failureCount > 0) {
    console.warn(
      `[cloud-nodes] registry enrichment: ${successCount}/${batches.length} batches succeeded, ${failureCount} failed`
    )
  }

  if (successCount === 0) {
    return new Map()
  }

  return resolved
}

async function fetchBatchWithRetry(
  fetchImpl: typeof fetch,
  baseUrl: string,
  packIds: readonly string[],
  timeoutMs: number
): Promise<RegistryPack[] | null> {
  const firstAttempt = await fetchBatch(fetchImpl, baseUrl, packIds, timeoutMs)
  if (firstAttempt.kind === 'ok') {
    return firstAttempt.nodes
  }
  if (!firstAttempt.retryable) {
    return null
  }

  const secondAttempt = await fetchBatch(fetchImpl, baseUrl, packIds, timeoutMs)
  if (secondAttempt.kind === 'ok') {
    return secondAttempt.nodes
  }
  return null
}

type BatchResponse =
  | { kind: 'ok'; nodes: RegistryPack[] }
  | { kind: 'err'; retryable: boolean }

async function fetchBatch(
  fetchImpl: typeof fetch,
  baseUrl: string,
  packIds: readonly string[],
  timeoutMs: number
): Promise<BatchResponse> {
  const params = new URLSearchParams()
  params.set('limit', String(packIds.length))
  for (const packId of packIds) {
    params.append('node_id', packId)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchImpl(`${baseUrl}/nodes?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    })

    if (!res.ok) {
      return {
        kind: 'err',
        retryable: res.status === 429 || (res.status >= 500 && res.status < 600)
      }
    }

    const rawBody: unknown = await res.json()
    const parsed = RegistryListResponseSchema.safeParse(rawBody)
    if (!parsed.success) {
      return { kind: 'err', retryable: false }
    }
    return { kind: 'ok', nodes: parsed.data.nodes as RegistryPack[] }
  } catch {
    return { kind: 'err', retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size))
  }
  return chunks
}

function clampTimeoutMs(candidate: number | undefined): number {
  if (
    typeof candidate !== 'number' ||
    !Number.isFinite(candidate) ||
    candidate <= 0
  ) {
    return DEFAULT_TIMEOUT_MS
  }
  return Math.floor(candidate)
}
