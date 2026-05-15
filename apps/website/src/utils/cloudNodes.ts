import { readFile } from 'node:fs/promises'

import {
  groupNodesByPack,
  sanitizeUserContent,
  slugifyPackId,
  validateComfyNodeDef
} from '@comfyorg/object-info-parser'

import type { RegistryPack } from './cloudNodes.registry'
import type { NodesSnapshot, Pack, PackNode } from '../data/cloudNodes'

import bundledSnapshot from '../data/cloud-nodes.snapshot.json' with { type: 'json' }
import { isNodesSnapshot } from '../data/cloudNodes'
import { fetchRegistryPacks } from './cloudNodes.registry'
import { CloudNodesEnvelopeSchema } from './cloudNodes.schema'

const DEFAULT_BASE_URL = 'https://cloud.comfy.org'
const DEFAULT_TIMEOUT_MS = 10_000
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]

export interface DroppedNode {
  name: string
  reason: string
}

export type FetchOutcome =
  | {
      status: 'fresh'
      snapshot: NodesSnapshot
      droppedCount: number
      droppedNodes: DroppedNode[]
    }
  | { status: 'stale'; snapshot: NodesSnapshot; reason: string }
  | { status: 'failed'; reason: string }

interface FetchCloudNodesOptions {
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  retryDelaysMs?: readonly number[]
  fetchImpl?: typeof fetch
  snapshotUrl?: URL
  sleep?: (ms: number) => Promise<void>
}

let inflight: Promise<FetchOutcome> | undefined
let inflightOptions: FetchCloudNodesOptions | undefined

export function resetCloudNodesFetcherForTests(): void {
  inflight = undefined
  inflightOptions = undefined
}

function optionsDifferMaterially(
  a: FetchCloudNodesOptions,
  b: FetchCloudNodesOptions
): boolean {
  return (
    a.apiKey !== b.apiKey ||
    a.baseUrl !== b.baseUrl ||
    a.timeoutMs !== b.timeoutMs ||
    a.snapshotUrl?.href !== b.snapshotUrl?.href
  )
}

export function fetchCloudNodesForBuild(
  options: FetchCloudNodesOptions = {}
): Promise<FetchOutcome> {
  if (inflight && inflightOptions) {
    if (optionsDifferMaterially(inflightOptions, options)) {
      throw new Error(
        'fetchCloudNodesForBuild called twice with different options; call resetCloudNodesFetcherForTests() between distinct configurations'
      )
    }
    return inflight
  }
  inflightOptions = options
  inflight = doFetchCloudNodesForBuild(options)
  return inflight
}

async function doFetchCloudNodesForBuild(
  options: FetchCloudNodesOptions
): Promise<FetchOutcome> {
  const apiKey = options.apiKey ?? process.env.WEBSITE_CLOUD_API_KEY

  if (!apiKey) {
    return fallback('missing WEBSITE_CLOUD_API_KEY', options.snapshotUrl)
  }

  const result = await tryFetchAndParse(apiKey, options)
  if (result.kind === 'ok') {
    return {
      status: 'fresh',
      snapshot: {
        fetchedAt: new Date().toISOString(),
        packs: result.packs
      },
      droppedCount: result.droppedNodes.length,
      droppedNodes: result.droppedNodes
    }
  }

  return fallback(result.reason, options.snapshotUrl)
}

async function fallback(
  reason: string,
  snapshotUrl: URL | undefined
): Promise<FetchOutcome> {
  const snapshot = await readSnapshot(snapshotUrl)
  if (snapshot) return { status: 'stale', snapshot, reason }
  return { status: 'failed', reason }
}

interface FetchOk {
  kind: 'ok'
  packs: Pack[]
  droppedNodes: DroppedNode[]
}

interface FetchErr {
  kind: 'err'
  reason: string
}

async function tryFetchAndParse(
  apiKey: string,
  options: FetchCloudNodesOptions
): Promise<FetchOk | FetchErr> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? defaultSleep

  const url = `${baseUrl}/api/object_info`

  let lastReason = 'unknown error'
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) await sleep(retryDelaysMs[attempt - 1])

    const response = await callOnce(fetchImpl, url, apiKey, timeoutMs)
    if (response.kind === 'err') {
      lastReason = response.reason
      if (!response.retryable) return response
      continue
    }

    const envelope = CloudNodesEnvelopeSchema.safeParse(response.body)
    if (!envelope.success) {
      return {
        kind: 'err',
        reason: `envelope schema validation failed: ${envelope.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; ')}`
      }
    }

    if (Object.keys(envelope.data).length === 0) {
      return {
        kind: 'err',
        reason:
          'envelope schema validation failed: <root>: expected non-empty object'
      }
    }

    return parseCloudNodes(envelope.data, options)
  }

  return { kind: 'err', reason: lastReason }
}

type CallResponse =
  | { kind: 'ok'; body: unknown }
  | { kind: 'err'; reason: string; retryable: boolean }

async function callOnce(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  timeoutMs: number
): Promise<CallResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey
      },
      signal: controller.signal
    })
    if (res.ok) {
      return { kind: 'ok', body: await res.json() }
    }
    const retryable =
      res.status === 429 || (res.status >= 500 && res.status < 600)
    return {
      kind: 'err',
      reason: `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      retryable
    }
  } catch (error) {
    const reason =
      error instanceof Error
        ? `network error: ${error.message}`
        : 'network error'
    return { kind: 'err', reason, retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Parses and validates a raw cloud nodes envelope into domain packs, enriches packs with registry metadata when available, and collects validation failures.
 *
 * @param envelope - Raw payload object from the cloud API keyed by node class name containing node definitions to validate and parse.
 * @param options - Fetch and behavior options used when resolving registry pack metadata (for example, `fetchImpl`).
 * @returns The `'ok'` outcome containing `packs` (an array of domain `Pack` objects) and `droppedNodes` (an array of `{ name, reason }` entries for definitions that failed validation).
 */
async function parseCloudNodes(
  envelope: Record<string, unknown>,
  options: FetchCloudNodesOptions
): Promise<FetchOk> {
  const validDefs: Record<string, ReturnType<typeof validateComfyNodeDef>> = {}
  const droppedNodes: DroppedNode[] = []

  for (const [name, rawDef] of Object.entries(envelope)) {
    let validationError = 'unknown validation error'
    const parsed = validateComfyNodeDef(rawDef, (error) => {
      validationError = error
    })
    if (!parsed) {
      droppedNodes.push({ name, reason: validationError })
      continue
    }
    validDefs[name] = parsed
  }

  const sanitizedDefs = sanitizeUserContent(
    validDefs as Record<string, NonNullable<(typeof validDefs)[string]>>
  )
  const grouped = groupNodesByPack(sanitizedDefs)

  const allAliases = grouped.flatMap((pack) => pack.rawIds)
  let registryMap = new Map<string, RegistryPack | null>()
  try {
    registryMap = await fetchRegistryPacks(allAliases, {
      fetchImpl: options.fetchImpl
    })
  } catch {
    registryMap = new Map()
  }

  const packs = grouped.map((pack) =>
    toDomainPack(
      pack.id,
      pack.rawIds[0],
      pack.displayName,
      pack.nodes,
      pickRegistryPack(registryMap, pack.rawIds)
    )
  )

  return { kind: 'ok', packs, droppedNodes }
}

/**
 * Selects the most appropriate registry pack for a pack using its ordered aliases.
 *
 * @param registryMap - Map from alias to `RegistryPack` or explicit `null` indicating a known-but-empty entry
 * @param aliases - Ordered aliases to probe; earlier aliases have higher priority
 * @returns A `RegistryPack` if any alias maps to a non-null value; `null` if no alias had a non-null value but the first alias exists in the map with value `null`; `undefined` if the first alias is absent from the map
 */
function pickRegistryPack(
  registryMap: Map<string, RegistryPack | null>,
  aliases: readonly string[]
): RegistryPack | null | undefined {
  for (const alias of aliases) {
    const hit = registryMap.get(alias)
    if (hit) return hit
  }
  return registryMap.get(aliases[0])
}

/**
 * Validate and normalize an external URL string.
 *
 * @param value - The input URL string to validate; may be `undefined`.
 * @returns The canonical `http` or `https` URL string if `value` is a valid absolute URL with a host, `undefined` otherwise.
 */
function safeExternalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (!url.host) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

/**
 * Convert parsed pack data and optional registry metadata into a domain `Pack`.
 *
 * @param packId - The canonical identifier to use for the pack
 * @param fallbackRegistryId - Registry id to use when `registryPack` does not provide one
 * @param fallbackDisplayName - Display name to use when `registryPack` does not provide a name
 * @param nodes - Array of node entries containing the class name and validated node definition
 * @param registryPack - Optional registry metadata for enriching pack fields; may be `null` or `undefined`
 * @returns A `Pack` with normalized fields, safe external URLs, optional publisher info, registry-derived metadata when available, and nodes converted to `PackNode` objects sorted by display name
 */
function toDomainPack(
  packId: string,
  fallbackRegistryId: string | undefined,
  fallbackDisplayName: string,
  nodes: Array<{
    className: string
    def: {
      display_name: string
      category: string
      description: string
      deprecated?: boolean
      experimental?: boolean
    }
  }>,
  registryPack: RegistryPack | null | undefined
): Pack {
  return {
    id: packId,
    registryId: registryPack?.id ?? fallbackRegistryId,
    displayName: registryPack?.name?.trim() || fallbackDisplayName || packId,
    description: registryPack?.description?.trim() || undefined,
    bannerUrl: safeExternalUrl(registryPack?.banner_url),
    iconUrl: safeExternalUrl(registryPack?.icon),
    repoUrl: safeExternalUrl(registryPack?.repository),
    publisher: registryPack?.publisher?.id
      ? {
          id: registryPack.publisher.id,
          name: registryPack.publisher.name
        }
      : undefined,
    downloads: registryPack?.downloads,
    githubStars: registryPack?.github_stars,
    latestVersion: registryPack?.latest_version?.version,
    license: registryPack?.license,
    lastUpdated:
      registryPack?.latest_version?.createdAt ?? registryPack?.created_at,
    supportedOs: registryPack?.supported_os,
    supportedAccelerators: registryPack?.supported_accelerators,
    nodes: nodes
      .map((node) => toDomainNode(node.className, node.def))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
}

function toDomainNode(
  className: string,
  def: {
    display_name: string
    category: string
    description: string
    deprecated?: boolean
    experimental?: boolean
  }
): PackNode {
  return {
    name: className,
    displayName: def.display_name,
    category: def.category,
    description: def.description || undefined,
    deprecated: def.deprecated,
    experimental: def.experimental
  }
}

/**
 * Load and validate a nodes snapshot from a provided file URL or from the bundled snapshot, normalizing pack IDs.
 *
 * If `snapshotUrl` is provided, reads the file, parses JSON, and returns the snapshot after `isNodesSnapshot` validation and `normalizeSnapshotIds` normalization.
 * If `snapshotUrl` is omitted, validates and returns the bundled snapshot after normalization.
 * Returns `null` if reading, parsing, or validation fails.
 *
 * @param snapshotUrl - Optional file `URL` pointing to a snapshot JSON; when omitted the bundled snapshot is used
 * @returns The normalized `NodesSnapshot` if available and valid, `null` otherwise
 */
async function readSnapshot(
  snapshotUrl: URL | undefined
): Promise<NodesSnapshot | null> {
  if (!snapshotUrl) {
    return isNodesSnapshot(bundledSnapshot)
      ? normalizeSnapshotIds(bundledSnapshot)
      : null
  }
  try {
    const text = await readFile(snapshotUrl, 'utf8')
    const parsed: unknown = JSON.parse(text)
    if (isNodesSnapshot(parsed)) return normalizeSnapshotIds(parsed)
    return null
  } catch {
    return null
  }
}

/**
 * Normalize pack IDs by slugifying each pack's `id`, omitting packs with empty slugs, and merging packs that produce the same slug.
 *
 * The returned snapshot preserves the original snapshot fields but replaces `packs` with a list whose `id` values are the slugified IDs. When multiple packs map to the same slug, their nodes and non-nullish metadata are merged into a single pack.
 *
 * @param snapshot - The snapshot whose pack IDs should be normalized and deduplicated
 * @returns A new `NodesSnapshot` with pack IDs replaced by slugs, colliding packs merged, and packs with falsy slugs removed
 */
function normalizeSnapshotIds(snapshot: NodesSnapshot): NodesSnapshot {
  const bySlug = new Map<string, Pack>()
  for (const pack of snapshot.packs) {
    const slug = slugifyPackId(pack.id)
    if (!slug) continue
    const existing = bySlug.get(slug)
    if (existing) {
      bySlug.set(slug, mergeCollidedPacks(existing, pack))
      continue
    }
    bySlug.set(slug, { ...pack, id: slug })
  }
  return { ...snapshot, packs: [...bySlug.values()] }
}

/**
 * Merge two packs that represent the same logical pack by concatenating their nodes and filling any missing metadata from the later pack.
 *
 * @param first - The base pack whose values take precedence.
 * @param next - The colliding pack whose `nodes` are appended and whose non-null, non-`id` fields supply values only when `first` has them missing.
 * @returns A new `Pack` whose `nodes` are `first.nodes` followed by `next.nodes`, with other fields taken from `first` unless absent, in which case the corresponding value from `next` is used.
 */
function mergeCollidedPacks(first: Pack, next: Pack): Pack {
  const merged: Pack = { ...first, nodes: [...first.nodes, ...next.nodes] }
  for (const [key, value] of Object.entries(next) as [keyof Pack, unknown][]) {
    if (key === 'id' || key === 'nodes') continue
    if (value === undefined || value === null) continue
    if (merged[key] === undefined || merged[key] === null) {
      ;(merged as Record<keyof Pack, unknown>)[key] = value
    }
  }
  return merged
}

/**
 * Pause execution for the specified duration.
 *
 * @param ms - Duration to wait in milliseconds
 * @returns A promise that resolves with no value when the delay has elapsed
 */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
