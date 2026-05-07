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
import { assetService } from '@/platform/assets/services/assetService'
import { isAbortError } from '@/utils/typeGuardUtil'
import { useAssetsStore } from '@/stores/assetsStore'
import {
  getAnnotatedMediaPathTypeForDetection,
  getMediaPathDetectionNames
} from './annotatedMediaPath'

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
      const detectionNames = getMediaPathDetectionNames(value)
      isMissing = !detectionNames.some((name) => options.includes(name))
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

interface MediaAssetFetcherOptions {
  includeOutputAssets?: boolean
}

type MediaAssetFetcher = (
  signal?: AbortSignal,
  options?: MediaAssetFetcherOptions
) => Promise<AssetItem[]>

/**
 * Verify cloud media candidates against input assets available to the user,
 * including public assets returned by the asset list API.
 *
 * A candidate's `name` may be either a filename or an opaque asset hash.
 * Cloud-side `asset_hash` is not guaranteed to follow a single shape, so we
 * match against the union of `asset.name` and `asset.asset_hash`. When a
 * candidate references output/temp media, generated history assets are also
 * included because Cloud stores those widget values as hash filenames.
 * Cloud also accepts compact annotated media paths, so verification compares
 * both the raw candidate name and its detection-normalized form.
 */
export async function verifyCloudMediaCandidates(
  candidates: MissingMediaCandidate[],
  signal?: AbortSignal,
  fetchMediaAssets: MediaAssetFetcher = fetchMissingMediaAssets
): Promise<void> {
  if (signal?.aborted) return

  const pending = candidates.filter((c) => c.isMissing === undefined)
  if (pending.length === 0) return
  const includeOutputAssets = pending.some((candidate) => {
    const type = getAnnotatedMediaPathTypeForDetection(candidate.name, {
      allowCompactSuffix: true
    })
    return type === 'output' || type === 'temp'
  })

  let mediaAssets: AssetItem[]
  try {
    mediaAssets = await fetchMediaAssets(signal, { includeOutputAssets })
  } catch (err) {
    if (signal?.aborted || isAbortError(err)) return
    throw err
  }

  if (signal?.aborted) return

  const assetIdentifiers = new Set<string>()
  const addAssetIdentifier = (value?: string | null) => {
    if (!value) return
    for (const name of getMediaPathDetectionNames(value, {
      allowCompactSuffix: true
    })) {
      assetIdentifiers.add(name)
    }
  }
  for (const asset of mediaAssets) {
    addAssetIdentifier(asset.asset_hash)
    addAssetIdentifier(asset.name)
  }

  for (const candidate of pending) {
    const detectionNames = getMediaPathDetectionNames(candidate.name, {
      allowCompactSuffix: true
    })
    candidate.isMissing = !detectionNames.some((name) =>
      assetIdentifiers.has(name)
    )
  }
}

async function fetchMissingMediaAssets(
  signal?: AbortSignal,
  { includeOutputAssets = false }: MediaAssetFetcherOptions = {}
): Promise<AssetItem[]> {
  const inputAssets = await assetService.getInputAssetsIncludingPublic(signal)
  if (!includeOutputAssets) return inputAssets

  const assetsStore = useAssetsStore()
  await assetsStore.updateHistory()
  return [...inputAssets, ...assetsStore.historyAssets]
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
