import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { scanNodeMediaCandidates } from '@/platform/workflowErrors/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/types'

import {
  createDeletedValueMatcher,
  findNodesReferencingValues
} from './clearNodePreviewCacheForValues'

/** Flags active media widgets referencing deleted assets as missing. */
export function markDeletedAssetsAsMissingMedia(
  rootGraph: LGraph,
  deletedValues: ReadonlySet<string>
): void {
  if (deletedValues.size === 0) return

  const matchedNodes = findNodesReferencingValues(rootGraph, deletedValues, {
    includeSubgraphNodes: true
  })
  if (!matchedNodes.length) return

  const isDeleted = createDeletedValueMatcher(deletedValues)
  const candidates: MissingMediaCandidate[] = []
  for (const node of matchedNodes) {
    if (
      node.mode === LGraphEventMode.NEVER ||
      node.mode === LGraphEventMode.BYPASS
    )
      continue
    for (const candidate of scanNodeMediaCandidates(rootGraph, node, {
      includeTemp: true
    })) {
      if (!isDeleted(candidate.name)) continue
      candidates.push({ ...candidate, isMissing: true })
    }
  }

  if (candidates.length) {
    useMissingMediaStore().addMissingMedia(candidates)
  }
}
