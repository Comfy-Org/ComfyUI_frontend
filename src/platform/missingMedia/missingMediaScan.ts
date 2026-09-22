import { groupBy } from 'es-toolkit'
import { toValue } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  buildPromotedWidgetExecutionSources,
  hasActivePromotedWidgetConsumer,
  resolveActivePromotedWidgetConsumers
} from '@/core/graph/subgraph/resolveConcretePromotedWidget'
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
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  collectAllNodes,
  getExecutionIdByNode,
  getNodeByExecutionId,
  isExecutionPathActive
} from '@/utils/graphTraversalUtil'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { resolveComboValues } from '@/utils/litegraphUtil'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { encodeParams } from '@/utils/requestUtil'
import {
  getAnnotatedMediaPathTypeForDetection,
  getMediaPathDetectionNames
} from './mediaPathDetectionUtil'

function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/** The widget a user can actually edit. */
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
 * With the asset API enabled, `isMissing` is left `undefined` so
 * `verifyMediaCandidates` resolves it against the asset listing on every
 * backend. Without it, `isMissing` is resolved immediately from widget
 * options unless an output annotation needs generated-history verification.
 */
export function scanAllMediaCandidates(
  rootGraph: LGraph
): MissingMediaCandidate[] {
  const allNodes = collectAllNodes(rootGraph)
  const candidates: MissingMediaCandidate[] = []

  for (const node of allNodes) {
    if (!node.widgets?.length) continue
    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    )
      continue

    candidates.push(...scanNodeMediaCandidates(rootGraph, node))
  }

  return candidates
}

function resolveMediaMissingState(
  widget: IComboWidget,
  value: string
): boolean | undefined {
  if (useFeatureFlags().flags.assetsEnabled) return undefined
  const options = resolveComboValues(widget)
  if (getAnnotatedMediaPathTypeForDetection(value) === 'output') {
    return options.includes(value) ? false : undefined
  }
  return !getMediaPathDetectionNames(value).some((name) =>
    options.includes(name)
  )
}

/** Scan a single node for missing media candidates. */
export function scanNodeMediaCandidates(
  rootGraph: LGraph,
  node: LGraphNode
): MissingMediaCandidate[] {
  if (!node.widgets?.length) return []

  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) return []

  if (node.isUploading) return []

  const nodeDefStore = useNodeDefStore()
  const candidates: MissingMediaCandidate[] = []
  for (const widget of node.widgets) {
    if (!isComboWidget(widget)) continue

    const mediaType = mediaTypeFromSpec(
      nodeDefStore.getInputSpecForWidget(node, widget.name)
    )
    if (!mediaType) continue
    if (!isEditableValueOwner(node, widget)) continue

    const value = widget.value
    if (typeof value !== 'string' || !value.trim()) continue

    const isMissing = resolveMediaMissingState(widget, value)

    // Label only, and leaf-derived to match missingModelScan: the overlay
    // formats nodeType directly and a SubgraphNode's own type is a UUID.
    const promotedSource = resolvePromotedWidgetSource(rootGraph, node, widget)
    const labelNode = promotedSource?.sourceNode ?? node

    const candidate: MissingMediaCandidate = {
      nodeId: executionId,
      nodeType: labelNode.type,
      widgetName: widget.name,
      mediaType,
      name: value,
      isMissing
    }
    if (node.isSubgraphNode()) {
      const consumers = resolveActivePromotedWidgetConsumers(node, widget.name)
      candidate.promotedSources = buildPromotedWidgetExecutionSources(
        executionId,
        consumers
      )
    }
    candidates.push(candidate)
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
  if (!widget) return false

  return widget.value === candidate.name && isEditableValueOwner(node, widget)
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

/**
 * Verify media candidates against assets available to the current runtime.
 *
 * A candidate's `name` may be a filename, annotated path, or opaque asset
 * hash, so it is matched against the union of each asset's `file_path`,
 * `hash`, `name`, and `subfolder + name` (see `getAssetDetectionNames`). Output
 * candidates are matched against Cloud output assets or Core generated-history
 * assets because Core resolves those annotations against output folders, not
 * input files.
 * Cloud accepts compact annotated media paths, so only Cloud verification
 * normalizes compact suffixes.
 */
export async function verifyMediaCandidates(
  candidates: MissingMediaCandidate[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<void> {
  if (signal?.aborted) return
  const pending = candidates.filter((c) => c.isMissing === undefined)
  const { assetsEnabled } = useFeatureFlags().flags
  const assetsStore = useAssetsStore()

  const groupedPending = Object.entries(groupBy(pending, (p) => p.name))
  const re = /^(.+?) *(?:\[(\w+)\])?$/
  async function resolveCandidate(annotatedName: string) {
    const [, name] = annotatedName.match(re) ?? []
    const assetMatches = (asset: AssetItem) =>
      name === (asset.hash || asset.name)
    if (
      toValue(assetsStore.inputAssets.items).some(assetMatches) ||
      toValue(assetsStore.outputAssets.items).some(assetMatches)
    )
      return false

    if (!assetsEnabled) return undefined
    //FIXME: objectively correct, but 'temp' can be incorrectly annotated
    //intentionally left loose for now
    //const tags_any = annotation ? [annotation] : undefined
    const query = encodeParams({ limit: 1, hash: name })
    const resp = await api.fetchApi(`/assets?${query}`, { signal })
    const { assets } = await resp.json()
    return !assets.length
  }
  const results = await Promise.allSettled(
    groupedPending.map(async ([name, candidates]) => {
      const isMissing = await resolveCandidate(name)
      for (const candidate of candidates) candidate.isMissing = isMissing
    })
  )
  const firstRejection = results.find((r) => r.status === 'rejected')
  if (firstRejection && !signal?.aborted) throw firstRejection.reason
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
