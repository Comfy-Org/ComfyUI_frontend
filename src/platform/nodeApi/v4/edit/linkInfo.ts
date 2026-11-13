import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LLink } from '@/lib/litegraph/src/LLink'

import type { LinkInfo } from '@/platform/nodeApi/v4/types'

/** A link as frozen plain data. */
function linkInfoOf(link: LLink): LinkInfo {
  return Object.freeze({
    id: String(link.id),
    sourceNodeId: String(link.origin_id),
    sourceIndex: link.origin_slot,
    targetNodeId: String(link.target_id),
    targetIndex: link.target_slot,
    type: String(link.type)
  })
}

/** Every link in `graph`, in id order. */
export function linksIn(graph: LGraph): readonly LinkInfo[] {
  return Object.freeze(
    Array.from(graph.links.values())
      .sort((a, b) => a.id - b.id)
      .map(linkInfoOf)
  )
}
