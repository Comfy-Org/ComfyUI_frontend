import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { isCloud } from '@/platform/distribution/types'
import { scanNodeMediaCandidates } from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'

import { findNodesReferencingValues } from './clearNodePreviewCacheForFilenames'

/**
 * After a successful asset deletion, surface the affected Load Image / Load
 * Video / Load Audio nodes through the missing-media store. Without this, UI
 * surfaces that filter against `missingMediaCandidates` (e.g. the Vue node
 * widget dropdown) keep listing the deleted asset because the verification
 * pipeline only runs on workflow load — there is no signal that the live
 * deletion just invalidated some references.
 *
 * Walks the full graph hierarchy (including subgraphs) and skips bypassed /
 * never-execute nodes, mirroring `scanAllMediaCandidates` so the live-delete
 * path stays in lockstep with the workflow-load verification.
 *
 * Comparison is full-string against the widget value, so two distinct assets
 * that share a basename across input/output sources do not cross-match.
 */
export function markDeletedAssetsAsMissingMedia(
  rootGraph: LGraph,
  deletedValues: ReadonlySet<string>
): void {
  if (deletedValues.size === 0) return

  const matchedNodes = findNodesReferencingValues(rootGraph, deletedValues)
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
