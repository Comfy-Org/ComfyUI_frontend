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
import { isAbortError } from '@/utils/typeGuardUtil'
import {
  getAnnotatedMediaPathTypeForDetection,
  getMediaPathDetectionNames,
  normalizeAnnotatedMediaPathForDetection
} from './mediaPathDetectionUtil'
import {
  getAssetDetectionNames,
  resolveMissingMediaAssetSources
} from './missingMediaAssetResolver'
import type { MissingMediaAssetResolver } from './missingMediaAssetResolver'

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
 * output annotation needs generated-history verification.
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
      if (type === 'output') {
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

interface MediaVerificationOptions {
  isCloud: boolean
  signal?: AbortSignal
  resolveAssetSources?: MissingMediaAssetResolver
}

/**
 * Verify media candidates against assets available to the current runtime.
 *
 * A candidate's `name` may be either a filename or an opaque asset hash.
 * Cloud-side `asset_hash` is not guaranteed to follow a single shape, so we
 * match against the union of `asset.name` and `asset.asset_hash`. Output
 * candidates are matched against Cloud output assets or Core generated-history
 * assets because Core resolves those annotations against output folders, not
 * input files.
 * Cloud accepts compact annotated media paths, so only Cloud verification
 * normalizes compact suffixes.
 */
export async function verifyMediaCandidates(
  candidates: MissingMediaCandidate[],
  {
    isCloud,
    signal,
    resolveAssetSources = resolveMissingMediaAssetSources
  }: MediaVerificationOptions
): Promise<void> {
  if (signal?.aborted) return

  const pending = candidates.filter((c) => c.isMissing === undefined)
  if (pending.length === 0) return

  // Core stores spaced annotations such as `file.png [output]`; Cloud also
  // accepts compact forms such as `file.png[output]`.
  const pathOptions = { allowCompactSuffix: isCloud }
  const generatedMatchNames = getGeneratedCandidateMatchNames(
    pending,
    pathOptions
  )

  let inputAssets: AssetItem[]
  let generatedAssets: AssetItem[]
  try {
    const assetSources = await resolveAssetSources({
      signal,
      isCloud,
      includeGeneratedAssets: generatedMatchNames.size > 0,
      generatedMatchNames,
      allowCompactSuffix: isCloud
    })
    inputAssets = assetSources.inputAssets
    generatedAssets = assetSources.generatedAssets
  } catch (err) {
    if (signal?.aborted || isAbortError(err)) return
    throw err
  }

  if (signal?.aborted) return

  const inputAssetIdentifiers = new Set<string>()
  const outputAssetIdentifiers = new Set<string>()
  addAssetIdentifiers(inputAssetIdentifiers, inputAssets, pathOptions)
  addAssetIdentifiers(outputAssetIdentifiers, generatedAssets, pathOptions)

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
      type === 'output' ? outputAssetIdentifiers : inputAssetIdentifiers
    candidate.isMissing = !detectionNames.some((name) => identifiers.has(name))
  }
}

function getGeneratedCandidateMatchNames(
  candidates: MissingMediaCandidate[],
  pathOptions: { allowCompactSuffix: boolean }
): Set<string> {
  const names = new Set<string>()
  for (const candidate of candidates) {
    if (!isGeneratedCandidate(candidate, pathOptions)) continue

    names.add(
      normalizeAnnotatedMediaPathForDetection(candidate.name, pathOptions)
    )
  }
  return names
}

function isGeneratedCandidate(
  candidate: MissingMediaCandidate,
  pathOptions: { allowCompactSuffix: boolean }
): boolean {
  const type = getAnnotatedMediaPathTypeForDetection(
    candidate.name,
    pathOptions
  )
  return type === 'output'
}

function addAssetIdentifiers(
  identifiers: Set<string>,
  assets: AssetItem[],
  pathOptions: { allowCompactSuffix: boolean }
) {
  for (const asset of assets) {
    for (const name of getAssetDetectionNames(asset, pathOptions)) {
      identifiers.add(name)
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
