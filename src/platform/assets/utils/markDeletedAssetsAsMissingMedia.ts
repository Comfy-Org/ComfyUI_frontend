import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { scanNodeMediaCandidates } from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'

import {
  extractFilenameFromWidgetValue,
  findNodesReferencingFilenames
} from './clearNodePreviewCacheForFilenames'

/**
 * After a successful asset deletion, surface the affected Load Image / Load
 * Video / Load Audio nodes through the missing-media store. Without this, UI
 * surfaces that filter against `missingMediaCandidates` (e.g. the Vue node
 * widget dropdown) keep listing the deleted asset because the verification
 * pipeline only runs on workflow load — there is no signal that the live
 * deletion just invalidated some references.
 *
 * Candidates are emitted only for widgets whose value extracts to a deleted
 * filename, so unrelated widgets on the same node are not flagged.
 */
export function markDeletedAssetsAsMissingMedia(
  graph: LGraph,
  deletedFilenames: ReadonlySet<string>
): void {
  if (deletedFilenames.size === 0) return

  const matchedNodes = findNodesReferencingFilenames(graph, deletedFilenames)
  if (!matchedNodes.length) return

  const candidates: MissingMediaCandidate[] = []
  for (const node of matchedNodes) {
    for (const candidate of scanNodeMediaCandidates(graph, node, isCloud)) {
      const widget = node.widgets?.find((w) => w.name === candidate.widgetName)
      const filename = extractFilenameFromWidgetValue(widget?.value)
      if (filename === null || !deletedFilenames.has(filename)) continue
      candidates.push({ ...candidate, isMissing: true })
    }
  }

  if (candidates.length) {
    useMissingMediaStore().addMissingMedia(candidates)
  }
}
