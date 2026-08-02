import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { isCloud } from '@/platform/distribution/types'
import { scanNodeMediaCandidates } from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

import { findNodesReferencingValues } from './clearNodePreviewCacheForValues'

/**
 * Marks media candidates referencing deleted asset values as missing.
 *
 * Traverses the graph hierarchy, including subgraph nodes, and ignores bypassed
 * or never-execute nodes.
 *
 * @param rootGraph - The root graph containing the affected nodes
 * @param deletedValues - The deleted asset values to match exactly
 */
export function markDeletedAssetsAsMissingMedia(
  rootGraph: LGraph,
  deletedValues: ReadonlySet<string>
): void {
  if (deletedValues.size === 0) return

  const matchedNodes = [
    ...findNodesReferencingValues(rootGraph, deletedValues),
    ...collectAllNodes(rootGraph).filter(
      (node) =>
        node.isSubgraphNode?.() &&
        node.widgets?.some(
          (widget) =>
            typeof widget.value === 'string' && deletedValues.has(widget.value)
        )
    )
  ]
  if (!matchedNodes.length) return

  const candidates: MissingMediaCandidate[] = []
  for (const node of matchedNodes) {
    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    )
      continue
    for (const candidate of scanNodeMediaCandidates(rootGraph, node, isCloud)) {
      if (!deletedValues.has(candidate.name)) continue
      candidates.push({ ...candidate, isMissing: true })
    }
  }

  if (candidates.length) {
    useMissingMediaStore().addMissingMedia(candidates)
  }
}
