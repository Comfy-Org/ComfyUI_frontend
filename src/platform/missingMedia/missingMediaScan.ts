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
import { api } from '@/scripts/api'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  getAnnotatedMediaPathTypeForDetection,
  getMediaPathDetectionNames
} from './mediaPathDetectionUtil'

const HISTORY_MEDIA_ASSETS_PAGE_SIZE = 200

/** Map of node types to their media widget name and media type. */
const MEDIA_NODE_WIDGETS: Record<
  string,
  { widgetName: string; mediaType: MediaType }
> = {
  LoadImage: { widgetName: 'image', mediaType: 'image' },
  LoadImageMask: { widgetName: 'image', mediaType: 'image' },
  LoadVideo: { widgetName: 'file', mediaType: 'video' },
  LoadAudio: { widgetName: 'audio', mediaType: 'audio' }
}

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/**
 * Scan combo widgets on media nodes for file values that may be missing.
 *
 * OSS: `isMissing` is resolved immediately via widget options unless an
 * output/temp annotation needs generated-history verification.
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
      const type = getAnnotatedMediaPathTypeForDetection(value)
      if (type === 'output' || type === 'temp') {
        isMissing = undefined
      } else {
        const options = resolveComboValues(widget)
        const detectionNames = getMediaPathDetectionNames(value)
        const existsInOptions = detectionNames.some((name) =>
          options.includes(name)
        )
        isMissing = !existsInOptions
      }
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
  includeCloudAssets?: boolean
}

type MediaAssetFetcher = (
  signal?: AbortSignal,
  options?: MediaAssetFetcherOptions
) => Promise<AssetItem[]>

interface MediaVerificationOptions {
  isCloud: boolean
  signal?: AbortSignal
  fetchMediaAssets?: MediaAssetFetcher
}

/**
 * Verify media candidates against assets available to the current runtime.
 *
 * A candidate's `name` may be either a filename or an opaque asset hash.
 * Cloud-side `asset_hash` is not guaranteed to follow a single shape, so we
 * match against the union of `asset.name` and `asset.asset_hash`. Output/temp
 * candidates are matched only against generated history assets because Core
 * resolves those annotations against output/temp folders, not input files.
 * Cloud accepts compact annotated media paths, so only Cloud verification
 * normalizes compact suffixes.
 */
export async function verifyMediaCandidates(
  candidates: MissingMediaCandidate[],
  {
    isCloud,
    signal,
    fetchMediaAssets = fetchMissingMediaAssets
  }: MediaVerificationOptions
): Promise<void> {
  if (signal?.aborted) return

  const pending = candidates.filter((c) => c.isMissing === undefined)
  if (pending.length === 0) return
  const pathOptions = { allowCompactSuffix: isCloud }
  const includeOutputAssets = pending.some((candidate) => {
    const type = getAnnotatedMediaPathTypeForDetection(
      candidate.name,
      pathOptions
    )
    return type === 'output' || type === 'temp'
  })

  let mediaAssets: AssetItem[]
  try {
    mediaAssets = await fetchMediaAssets(signal, {
      includeOutputAssets,
      includeCloudAssets: isCloud
    })
  } catch (err) {
    if (signal?.aborted || isAbortError(err)) return
    throw err
  }

  if (signal?.aborted) return

  const inputAssetIdentifiers = new Set<string>()
  const outputAssetIdentifiers = new Set<string>()
  const addInputAssetIdentifier = (value?: string | null) => {
    if (!value) return
    for (const name of getMediaPathDetectionNames(value, pathOptions)) {
      inputAssetIdentifiers.add(name)
    }
  }
  const addOutputAssetIdentifier = (value?: string | null) => {
    if (!value) return
    for (const name of getMediaPathDetectionNames(value, pathOptions)) {
      outputAssetIdentifiers.add(name)
    }
  }
  for (const asset of mediaAssets) {
    const subfolder = asset.user_metadata?.subfolder
    if (asset.tags?.includes('output')) {
      addOutputAssetIdentifier(asset.asset_hash)
      addOutputAssetIdentifier(asset.name)
      if (typeof subfolder === 'string' && subfolder) {
        addOutputAssetIdentifier(`${subfolder}/${asset.name}`)
      }
    } else {
      addInputAssetIdentifier(asset.asset_hash)
      addInputAssetIdentifier(asset.name)
      if (typeof subfolder === 'string' && subfolder) {
        addInputAssetIdentifier(`${subfolder}/${asset.name}`)
      }
    }
  }

  for (const candidate of pending) {
    const detectionNames = getMediaPathDetectionNames(
      candidate.name,
      pathOptions
    )
    const type = getAnnotatedMediaPathTypeForDetection(
      candidate.name,
      pathOptions
    )
    const identifiers =
      type === 'output' || type === 'temp'
        ? outputAssetIdentifiers
        : inputAssetIdentifiers
    candidate.isMissing = !detectionNames.some((name) => identifiers.has(name))
  }
}

export async function verifyCloudMediaCandidates(
  candidates: MissingMediaCandidate[],
  signal?: AbortSignal,
  fetchMediaAssets?: MediaAssetFetcher
): Promise<void> {
  return await verifyMediaCandidates(candidates, {
    isCloud: true,
    signal,
    fetchMediaAssets
  })
}

async function fetchMissingMediaAssets(
  signal?: AbortSignal,
  {
    includeOutputAssets = false,
    includeCloudAssets = true
  }: MediaAssetFetcherOptions = {}
): Promise<AssetItem[]> {
  const inputAssets = includeCloudAssets
    ? await assetService.getInputAssetsIncludingPublic(signal)
    : []
  if (!includeOutputAssets) return inputAssets

  return [...inputAssets, ...(await fetchGeneratedHistoryAssets(signal))]
}

async function fetchGeneratedHistoryAssets(
  signal?: AbortSignal
): Promise<AssetItem[]> {
  const assets: AssetItem[] = []
  let offset = 0

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const historyPage = await api.getHistoryPage(
      HISTORY_MEDIA_ASSETS_PAGE_SIZE,
      {
        offset
      }
    )

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    assets.push(
      ...historyPage.jobs.map(mapHistoryJobToAsset).filter((a) => a !== null)
    )

    if (!historyPage.hasMore) {
      return assets
    }

    const nextOffset = historyPage.offset + historyPage.jobs.length
    if (nextOffset <= offset) return assets
    offset = nextOffset
  }
}

function mapHistoryJobToAsset(job: JobListItem): AssetItem | null {
  const output = job.preview_output
  if (job.status !== 'completed' || !output?.filename) return null

  return {
    id: `${job.id}-${output.filename}`,
    name: output.filename,
    display_name: output.display_name,
    mime_type: null,
    tags: ['output'],
    user_metadata: {
      subfolder: output.subfolder
    }
  }
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
