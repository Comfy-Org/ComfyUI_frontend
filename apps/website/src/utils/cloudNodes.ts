import { readFile } from 'node:fs/promises'

import {
  groupNodesByPack,
  sanitizeUserContent,
  validateComfyNodeDef
} from '@comfyorg/object-info-parser'

import type {
  RegistryComfyNode,
  RegistryPackWithNodes
} from './cloudNodes.registry'
import type { NodesSnapshot, Pack, PackNode } from '../data/cloudNodes'

import bundledSnapshot from '../data/cloud-nodes.snapshot.json' with { type: 'json' }
import { isNodesSnapshot } from '../data/cloudNodes'
import { fetchRegistryPacksWithNodes } from './cloudNodes.registry'
import { CloudNodesEnvelopeSchema } from './cloudNodes.schema'

const DEFAULT_BASE_URL = 'https://cloud.comfy.org'
const DEFAULT_TIMEOUT_MS = 10_000
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]

interface DroppedNode {
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

  // Use object_info to determine which packs are cloud-supported
  const grouped = groupNodesByPack(sanitizedDefs)
  const packIds = grouped.map((pack) => pack.id)

  // Fetch full pack metadata and node list from registry
  let registryMap = new Map<string, RegistryPackWithNodes | null>()
  try {
    registryMap = await fetchRegistryPacksWithNodes(packIds, {
      fetchImpl: options.fetchImpl
    })
  } catch {
    registryMap = new Map()
  }

  const packs = grouped
    .map((pack) => {
      const registryData = registryMap.get(pack.id)
      // Use registry nodes if available, otherwise fall back to object_info nodes
      return toDomainPack(pack.id, pack.displayName, pack.nodes, registryData)
    })
    .filter((pack) => pack.nodes.length > 0)

  return { kind: 'ok', packs, droppedNodes }
}

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

function toDomainPack(
  packId: string,
  fallbackDisplayName: string,
  objectInfoNodes: Array<{
    className: string
    def: {
      display_name: string
      category: string
      description: string
      deprecated?: boolean
      experimental?: boolean
    }
  }>,
  registryData: RegistryPackWithNodes | null | undefined
): Pack {
  const registryPack = registryData?.pack

  // Prefer registry nodes if available, fall back to object_info nodes
  const nodes =
    registryData?.nodes && registryData.nodes.length > 0
      ? registryData.nodes
          .map((node) => toDomainNodeFromRegistry(node))
          .filter((n): n is PackNode => n !== null)
      : objectInfoNodes.map((node) => toDomainNode(node.className, node.def))

  return {
    id: packId,
    registryId: registryPack?.id,
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
    nodes: nodes.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
}

function toDomainNodeFromRegistry(node: RegistryComfyNode): PackNode | null {
  if (!node.comfy_node_name) return null

  return {
    name: node.comfy_node_name,
    displayName: node.comfy_node_name,
    category: node.category || '',
    description: node.description || undefined,
    deprecated: node.deprecated,
    experimental: node.experimental
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

async function readSnapshot(
  snapshotUrl: URL | undefined
): Promise<NodesSnapshot | null> {
  if (!snapshotUrl) {
    return isNodesSnapshot(bundledSnapshot) ? bundledSnapshot : null
  }
  try {
    const text = await readFile(snapshotUrl, 'utf8')
    const parsed: unknown = JSON.parse(text)
    if (isNodesSnapshot(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
