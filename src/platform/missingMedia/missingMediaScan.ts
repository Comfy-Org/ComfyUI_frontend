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

interface InputVerifier {
  updateInputs: () => Promise<unknown>
  inputAssets: Array<{ asset_hash?: string | null; name: string }>
}

/**
 * Verify cloud media candidates against the input assets fetched from the
 * assets store. Mutates candidates' `isMissing` in place.
 */
export async function verifyCloudMediaCandidates(
  candidates: MissingMediaCandidate[],
  signal?: AbortSignal,
  assetsStore?: InputVerifier
): Promise<void> {
  if (signal?.aborted) return

  const pending = candidates.filter((c) => c.isMissing === undefined)
  if (pending.length === 0) return

  const store =
    assetsStore ?? (await import('@/stores/assetsStore')).useAssetsStore()

  await store.updateInputs()

  if (signal?.aborted) return

  const assetHashes = new Set(
    store.inputAssets.map((a) => a.asset_hash).filter((h): h is string => !!h)
  )

  for (const c of pending) {
    c.isMissing = !assetHashes.has(c.name)
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
