import { groupBy } from 'es-toolkit'
import { hasActivePromotedWidgetConsumer } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'
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
  getExecutionIdByNode,
  getNodeByExecutionId,
  isExecutionPathActive
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

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/**
 * The widget a user can actually edit. A linked slot means the value comes
 * from upstream; a promoted host owns the value only while some interior
 * consumer is still live.
 */
function isEditableValueOwner(node: LGraphNode, widget: IBaseWidget): boolean {
  const input = node.getSlotFromWidget(widget)
  if (input?.link != null) return false
  if (!node.isSubgraphNode()) return true
  return !!input?.widgetId && hasActivePromotedWidgetConsumer(node, input.name)
}

function mediaTypeFromSpec(
  spec: InputSpecV2 | undefined
): MediaType | undefined {
  if (!spec || !isComboInputSpec(spec)) return undefined
  if (spec.video_upload) return 'video'
  if (spec.image_upload || spec.animated_image_upload) return 'image'
  if (spec.audio_upload) return 'audio'
  return undefined
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

  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) return []

  const nodeDefStore = useNodeDefStore()
  const candidates: MissingMediaCandidate[] = []
  if (node.isUploading) return []

  for (const widget of node.widgets) {
    if (!isComboWidget(widget)) continue
    if (!isEditableValueOwner(node, widget)) continue

    // getInputSpecForWidget projects a promoted host input to its interior
    // spec itself, so the scan reads schema through the store rather than
    // walking the subgraph.
    const mediaType = mediaTypeFromSpec(
      nodeDefStore.getInputSpecForWidget(node, widget.name)
    )
    if (!mediaType) continue

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

    // Label only, and leaf-derived to match missingModelScan: the overlay
    // formats nodeType directly and a SubgraphNode's own type is a UUID.
    const labelNode =
      resolvePromotedWidgetSource(rootGraph, node, widget)?.sourceNode ?? node

    candidates.push({
      nodeId: executionId,
      nodeType: labelNode.type,
      widgetName: widget.name,
      mediaType,
      name: value,
      isMissing
    })
  }

  return candidates
}

export function isMissingMediaCandidateScopeActive(
  rootGraph: LGraph | null | undefined,
  candidate: MissingMediaCandidate
): boolean {
  if (!rootGraph) return false

  const executionId = String(candidate.nodeId)
  if (!isExecutionPathActive(rootGraph, executionId)) return false

  const node = getNodeByExecutionId(rootGraph, executionId)
  if (!node) return false
  const widget = node.widgets?.find(
    (candidateWidget) => candidateWidget.name === candidate.widgetName
  )
  // Removed or renamed while verification was pending: nothing owns the value.
  if (!widget) return false

  return isEditableValueOwner(node, widget)
}

export function isMissingMediaCandidateActive(
  rootGraph: LGraph | null | undefined,
  candidate: MissingMediaCandidate
): boolean {
  return (
    candidate.isMissing === true &&
    isMissingMediaCandidateScopeActive(rootGraph, candidate)
  )
}

interface MediaVerificationOptions {
  isCloud: boolean
  signal?: AbortSignal
  resolveAssetSources?: MissingMediaAssetResolver
}

interface GeneratedCandidateMatchNames {
  names: Set<string>
  hashRequiredNames: Set<string>
}

/**
 * Verify media candidates against assets available to the current runtime.
 *
 * A candidate's `name` may be either a filename or an opaque asset hash.
 * Cloud-side `hash` is not guaranteed to follow a single shape, so we
 * match against the union of `asset.name` and `asset.hash`. Output
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
    isCloud,
    pathOptions
  )

  let inputAssets: AssetItem[]
  let generatedAssets: AssetItem[]
  try {
    const assetSources = await resolveAssetSources({
      signal,
      isCloud,
      includeGeneratedAssets: generatedMatchNames.names.size > 0,
      generatedMatchNames: generatedMatchNames.names,
      generatedHashRequiredNames: generatedMatchNames.hashRequiredNames,
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
  const outputAssetHashIdentifiers = new Set<string>()
  addAssetIdentifiers(inputAssetIdentifiers, inputAssets, pathOptions)
  addAssetIdentifiers(outputAssetIdentifiers, generatedAssets, pathOptions)
  addAssetHashIdentifiers(
    outputAssetHashIdentifiers,
    generatedAssets,
    pathOptions
  )

  for (const candidate of pending) {
    const type = getAnnotatedMediaPathTypeForDetection(
      candidate.name,
      pathOptions
    )
    const isOutputCandidate = type === 'output'
    const identifiers = isOutputCandidate
      ? outputAssetIdentifiers
      : inputAssetIdentifiers
    candidate.isMissing = !isCandidateResolved(
      candidate,
      identifiers,
      isOutputCandidate,
      isCloud,
      outputAssetHashIdentifiers,
      pathOptions
    )
  }
}

function getGeneratedCandidateMatchNames(
  candidates: MissingMediaCandidate[],
  isCloud: boolean,
  pathOptions: { allowCompactSuffix: boolean }
): GeneratedCandidateMatchNames {
  const names = new Set<string>()
  const hashRequiredNames = new Set<string>()

  for (const candidate of candidates) {
    if (!isGeneratedCandidate(candidate, pathOptions)) continue

    const normalized = normalizeAnnotatedMediaPathForDetection(
      candidate.name,
      pathOptions
    )
    const lookupName = isCloud ? getMediaPathBasename(normalized) : normalized
    names.add(lookupName)
    if (isCloud && lookupName !== normalized) {
      hashRequiredNames.add(lookupName)
    }
  }

  return { names, hashRequiredNames }
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

function isCandidateResolved(
  candidate: MissingMediaCandidate,
  identifiers: ReadonlySet<string>,
  isOutputCandidate: boolean,
  isCloud: boolean,
  outputAssetHashIdentifiers: ReadonlySet<string>,
  pathOptions: { allowCompactSuffix: boolean }
): boolean {
  const detectionNames = getMediaPathDetectionNames(candidate.name, pathOptions)
  if (detectionNames.some((name) => identifiers.has(name))) return true
  if (!isOutputCandidate || !isCloud) return false

  const normalized = normalizeAnnotatedMediaPathForDetection(
    candidate.name,
    pathOptions
  )
  const basename = getMediaPathBasename(normalized)
  return basename !== normalized && outputAssetHashIdentifiers.has(basename)
}

function getMediaPathBasename(value: string): string {
  const separatorIndex = Math.max(
    value.lastIndexOf('/'),
    value.lastIndexOf('\\')
  )
  return separatorIndex === -1 ? value : value.slice(separatorIndex + 1)
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

function addAssetHashIdentifiers(
  identifiers: Set<string>,
  assets: AssetItem[],
  pathOptions: { allowCompactSuffix: boolean }
) {
  for (const asset of assets) {
    if (!asset.hash) continue
    for (const name of getMediaPathDetectionNames(asset.hash, pathOptions)) {
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
        nodeType: c.nodeType,
        widgetName: c.widgetName
      })
    } else {
      map.set(c.name, {
        name: c.name,
        mediaType: c.mediaType,
        representative: c,
        referencingNodes: [
          { nodeId: c.nodeId, nodeType: c.nodeType, widgetName: c.widgetName }
        ]
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
