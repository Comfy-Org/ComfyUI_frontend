import { z } from 'zod'

import type { components } from '@comfyorg/registry-types'

export const DEFAULT_REGISTRY_BASE_URL = 'https://api.comfy.org'
const DEFAULT_TIMEOUT_MS = 5_000
const BATCH_SIZE = 50
const COMFY_NODES_PAGE_SIZE = 500

export type RegistryPack = components['schemas']['Node']
export type RegistryComfyNode = components['schemas']['ComfyNode']

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

const RegistryComfyNodeSchema = z
  .object({
    comfy_node_name: optionalString,
    category: optionalString,
    description: optionalString,
    deprecated: z
      .boolean()
      .nullish()
      .transform((v) => v ?? undefined),
    experimental: z
      .boolean()
      .nullish()
      .transform((v) => v ?? undefined)
  })
  .passthrough()

const RegistryComfyNodesResponseSchema = z
  .object({
    comfy_nodes: z.array(RegistryComfyNodeSchema).nullish(),
    totalNumberOfPages: z.number().nullish()
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

export interface RegistryPackWithNodes {
  pack: RegistryPack
  nodes: RegistryComfyNode[]
}

export async function fetchRegistryPacksWithNodes(
  packIds: readonly string[],
  options: FetchRegistryOptions = {}
): Promise<Map<string, RegistryPackWithNodes | null>> {
  const packs = await fetchRegistryPacks(packIds, options)

  const baseUrl = options.baseUrl ?? DEFAULT_REGISTRY_BASE_URL
  const timeoutMs = clampTimeoutMs(options.timeoutMs)
  const fetchImpl = options.fetchImpl ?? fetch

  const entries = await Promise.all(
    [...packs.entries()].map(
      async ([packId, pack]): Promise<
        [string, RegistryPackWithNodes | null]
      > => {
        if (!pack?.latest_version?.version) {
          return [packId, null]
        }

        const nodes = await fetchComfyNodesForPack(
          fetchImpl,
          baseUrl,
          packId,
          pack.latest_version.version,
          timeoutMs
        )

        return [packId, { pack, nodes }]
      }
    )
  )

  return new Map(entries)
}

async function fetchComfyNodesForPack(
  fetchImpl: typeof fetch,
  baseUrl: string,
  packId: string,
  version: string,
  timeoutMs: number
): Promise<RegistryComfyNode[]> {
  const allNodes: RegistryComfyNode[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = await fetchComfyNodesPageWithRetry(
      fetchImpl,
      baseUrl,
      packId,
      version,
      page,
      timeoutMs
    )

    if (!result) break

    allNodes.push(...result.nodes)
    totalPages = result.totalPages
    page++
  }

  return allNodes
}

async function fetchComfyNodesPageWithRetry(
  fetchImpl: typeof fetch,
  baseUrl: string,
  packId: string,
  version: string,
  page: number,
  timeoutMs: number
): Promise<{ nodes: RegistryComfyNode[]; totalPages: number } | null> {
  const firstAttempt = await fetchComfyNodesPage(
    fetchImpl,
    baseUrl,
    packId,
    version,
    page,
    timeoutMs
  )
  if (firstAttempt) return firstAttempt

  // Retry once on failure
  return fetchComfyNodesPage(
    fetchImpl,
    baseUrl,
    packId,
    version,
    page,
    timeoutMs
  )
}

async function fetchComfyNodesPage(
  fetchImpl: typeof fetch,
  baseUrl: string,
  packId: string,
  version: string,
  page: number,
  timeoutMs: number
): Promise<{ nodes: RegistryComfyNode[]; totalPages: number } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `${baseUrl}/nodes/${encodeURIComponent(packId)}/versions/${encodeURIComponent(version)}/comfy-nodes?limit=${COMFY_NODES_PAGE_SIZE}&page=${page}`
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })

    if (!res.ok) return null

    const rawBody: unknown = await res.json()
    const parsed = RegistryComfyNodesResponseSchema.safeParse(rawBody)
    if (!parsed.success) return null

    return {
      nodes: (parsed.data.comfy_nodes ?? []) as RegistryComfyNode[],
      totalPages: parsed.data.totalNumberOfPages ?? 1
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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
