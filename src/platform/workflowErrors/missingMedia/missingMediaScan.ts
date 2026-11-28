import { groupBy } from 'es-toolkit'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  buildPromotedWidgetExecutionSources,
  hasActivePromotedWidgetConsumer,
  resolveActivePromotedWidgetConsumers
} from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { resolveWidgetValueAsset } from '@/platform/assets/integration/resolveWidgetValueAsset'
import { isComboInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { getMediaSelectionLimits } from '@comfyorg/object-info-parser'
import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type {
  MissingMediaCandidate,
  MissingMediaViewModel,
  MissingMediaGroup,
  MediaType
} from './types'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget, IComboWidget } from '@comfyorg/graph-model/widgets'
import {
  collectAllNodes,
  getExecutionIdByNode,
  getNodeByExecutionId,
  isExecutionPathActive
} from '@/utils/graphTraversalUtil'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { resolveComboValues } from '@/utils/litegraphUtil'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { toMediaSelection } from '@/utils/mediaUploadUtil'

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
  const { filepath, rootFolder } = parseAnnotatedPath(value)
  if (rootFolder !== 'input') return options.includes(value) ? false : undefined
  if (options.includes(value) || options.includes(filepath)) return false
  return filepath.includes('/') ? undefined : true
}

function mediaWidgetValues(
  spec: InputSpecV2 | undefined,
  widget: IComboWidget
): string[] {
  const values =
    spec && isComboInputSpec(spec) && getMediaSelectionLimits(spec)
      ? toMediaSelection(widget.value)
      : [widget.value]
  return values.filter(
    (value): value is string => typeof value === 'string' && !!value.trim()
  )
}

/** Scan media; includeTemp is only for known deletions, not verification. */
export function scanNodeMediaCandidates(
  rootGraph: LGraph,
  node: LGraphNode,
  { includeTemp = false }: { includeTemp?: boolean } = {}
): MissingMediaCandidate[] {
  if (!node.widgets?.length) return []

  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) return []

  if (node.isUploading) return []

  const nodeDefStore = useNodeDefStore()
  const candidates: MissingMediaCandidate[] = []
  for (const widget of node.widgets) {
    if (!isComboWidget(widget)) continue

    const spec = nodeDefStore.getInputSpecForWidget(node, widget.name)
    const mediaType = mediaTypeFromSpec(spec)
    if (!mediaType) continue
    if (!isEditableValueOwner(node, widget)) continue

    const scanned = mediaWidgetValues(spec, widget).filter(
      (value) => includeTemp || parseAnnotatedPath(value).rootFolder !== 'temp'
    )
    if (!scanned.length) continue

    const promotedSource = resolvePromotedWidgetSource(rootGraph, node, widget)
    const promotedSources = node.isSubgraphNode()
      ? buildPromotedWidgetExecutionSources(
          executionId,
          resolveActivePromotedWidgetConsumers(node, widget.name)
        )
      : undefined
    for (const value of scanned) {
      candidates.push({
        nodeId: executionId,
        nodeType: (promotedSource?.sourceNode ?? node).type,
        widgetName: widget.name,
        mediaType,
        name: value,
        isMissing: resolveMediaMissingState(widget, value),
        ...(promotedSources && { promotedSources })
      })
    }
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

  const value = widget.value
  const holdsCandidate = Array.isArray(value)
    ? value.includes(candidate.name)
    : value === candidate.name
  return holdsCandidate && isEditableValueOwner(node, widget)
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

/** Resolve pending candidates against the asset store, then a remote hash lookup when assets are enabled. */
export async function verifyMediaCandidates(
  candidates: MissingMediaCandidate[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<void> {
  if (signal?.aborted) return
  const pending = candidates.filter((c) => c.isMissing === undefined)
  const results = await Promise.allSettled(
    Object.entries(groupBy(pending, (p) => p.name)).map(
      async ([name, candidateGroup]) => {
        const asset = await resolveWidgetValueAsset(name, { signal })
        const isMissing = asset === undefined ? undefined : asset === null
        for (const candidate of candidateGroup) candidate.isMissing = isMissing
      }
    )
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
