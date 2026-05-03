import { groupBy } from 'es-toolkit'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type {
  MissingMediaCandidate,
  MissingMediaViewModel,
  MissingMediaGroup,
  MediaType
} from './types'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import {
  collectAllNodes,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { resolveComboValues } from '@/utils/litegraphUtil'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { AssetHashStatus } from '@/platform/assets/services/assetService'
import {
  assetService,
  isBlake3AssetHash
} from '@/platform/assets/services/assetService'

/** Map of node types to their media widget name and media type. */
const MEDIA_NODE_WIDGETS: Record<
  string,
  { widgetName: string; mediaType: MediaType }
> = {
  LoadImage: { widgetName: 'image', mediaType: 'image' },
  LoadVideo: { widgetName: 'file', mediaType: 'video' },
  LoadAudio: { widgetName: 'audio', mediaType: 'audio' }
}

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/**
 * Scan combo widgets on media nodes for file values that may be missing.
 *
 * OSS: `isMissing` resolved immediately via widget options.
 * Cloud: `isMissing` left `undefined` for async verification.
 */
export function scanAllMediaCandidates(
  rootGraph: LGraph,
  isCloud: boolean
): MissingMediaCandidate[] {
  if (!rootGraph) return []

  const allNodes = collectAllNodes(rootGraph)
  const candidates: MissingMediaCandidate[] = []

  for (const node of allNodes) {
    if (!node.widgets?.length) continue
    if (node.isSubgraphNode?.()) continue
    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    )
      continue

    candidates.push(...scanNodeMediaCandidates(rootGraph, node, isCloud))
  }

  return candidates
}

/** Scan a single node for missing media candidates (OSS immediate resolution). */
export function scanNodeMediaCandidates(
  rootGraph: LGraph,
  node: LGraphNode,
  isCloud: boolean
): MissingMediaCandidate[] {
  if (!node.widgets?.length) return []

  const mediaInfo = MEDIA_NODE_WIDGETS[node.type]
  if (!mediaInfo) return []

  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) return []

  const candidates: MissingMediaCandidate[] = []
  for (const widget of node.widgets) {
    if (!isComboWidget(widget)) continue
    if (widget.name !== mediaInfo.widgetName) continue

    const value = widget.value
    if (typeof value !== 'string' || !value.trim()) continue

    let isMissing: boolean | undefined
    if (isCloud) {
      isMissing = undefined
    } else {
      const options = resolveComboValues(widget)
      isMissing = !options.includes(value)
    }

    candidates.push({
      nodeId: executionId as NodeId,
      nodeType: node.type,
      widgetName: widget.name,
      mediaType: mediaInfo.mediaType,
      name: value,
      isMissing
    })
  }

  return candidates
}

type AssetHashVerifier = (
  assetHash: string,
  signal?: AbortSignal
) => Promise<AssetHashStatus>

type InputAssetFetcher = (signal?: AbortSignal) => Promise<AssetItem[]>

/**
 * Verify cloud media candidates by probing the asset hash endpoint first.
 * Invalid hash values fall back to the legacy input asset list check.
 */
export async function verifyCloudMediaCandidates(
  candidates: MissingMediaCandidate[],
  signal?: AbortSignal,
  checkAssetHash: AssetHashVerifier = assetService.checkAssetHash,
  fetchInputAssets: InputAssetFetcher = fetchMissingInputAssets
): Promise<void> {
  if (signal?.aborted) return

  const pending = candidates.filter((c) => c.isMissing === undefined)
  if (pending.length === 0) return

  const candidatesByHash = new Map<string, MissingMediaCandidate[]>()
  const legacyCandidates: MissingMediaCandidate[] = []
  for (const candidate of pending) {
    if (!isBlake3AssetHash(candidate.name)) {
      legacyCandidates.push(candidate)
      continue
    }

    const hashCandidates = candidatesByHash.get(candidate.name)
    if (hashCandidates) hashCandidates.push(candidate)
    else candidatesByHash.set(candidate.name, [candidate])
  }

  await Promise.all(
    Array.from(candidatesByHash, async ([assetHash, hashCandidates]) => {
      if (signal?.aborted) return

      let status: AssetHashStatus
      try {
        status = await checkAssetHash(assetHash, signal)
        if (signal?.aborted) return
      } catch (err) {
        if (signal?.aborted || isAbortError(err)) return
        console.warn(
          '[Missing Media Pipeline] Failed to verify asset hash:',
          err
        )
        legacyCandidates.push(...hashCandidates)
        return
      }

      if (status === 'invalid') {
        legacyCandidates.push(...hashCandidates)
        return
      }

      for (const candidate of hashCandidates) {
        candidate.isMissing = status === 'missing'
      }
    })
  )

  if (signal?.aborted || legacyCandidates.length === 0) return

  let inputAssets: AssetItem[]
  try {
    inputAssets = await fetchInputAssets(signal)
  } catch (err) {
    if (signal?.aborted || isAbortError(err)) return
    throw err
  }

  if (signal?.aborted) return

  const assetHashes = new Set(
    inputAssets.map((a) => a.asset_hash).filter((h): h is string => !!h)
  )

  for (const candidate of legacyCandidates) {
    candidate.isMissing = !assetHashes.has(candidate.name)
  }
}

async function fetchMissingInputAssets(
  signal?: AbortSignal
): Promise<AssetItem[]> {
  const store = (await import('@/stores/assetsStore')).useAssetsStore()
  return await store.getInputAssetsIncludingPublic(signal)
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    err.name === 'AbortError'
  )
}

/** Group confirmed-missing candidates by file name into view models. */
export function groupCandidatesByName(
  candidates: MissingMediaCandidate[]
): MissingMediaViewModel[] {
  const map = new Map<string, MissingMediaViewModel>()
  for (const c of candidates) {
    const existing = map.get(c.name)
    if (existing) {
      existing.referencingNodes.push({
        nodeId: c.nodeId,
        widgetName: c.widgetName
      })
    } else {
      map.set(c.name, {
        name: c.name,
        mediaType: c.mediaType,
        referencingNodes: [{ nodeId: c.nodeId, widgetName: c.widgetName }]
      })
    }
  }
  return Array.from(map.values())
}

/** Group confirmed-missing candidates by media type. */
export function groupCandidatesByMediaType(
  candidates: MissingMediaCandidate[]
): MissingMediaGroup[] {
  const grouped = groupBy(candidates, (c) => c.mediaType)
  const order: MediaType[] = ['image', 'video', 'audio']
  return order
    .filter((t) => t in grouped)
    .map((mediaType) => ({
      mediaType,
      items: groupCandidatesByName(grouped[mediaType])
    }))
}
