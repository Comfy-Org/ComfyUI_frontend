import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LLink } from '@/lib/litegraph/src/LLink'

import type { LinkInfo } from '@/platform/nodeApi/v4/types'
import { slotIdOf } from './slotIds'

/** A link as frozen plain data, with its slots' ids as they are in `graph`. */
export function linkInfoOf(graph: LGraph, link: LLink): LinkInfo {
  const { output, input, subgraphInput, subgraphOutput } = link.resolve(graph)
  return Object.freeze({
    id: String(link.id),
    sourceNodeId: String(link.origin_id),
    sourceSlotId: slotIdOrNothing(output ?? subgraphInput),
    sourceIndex: link.origin_slot,
    targetNodeId: String(link.target_id),
    targetSlotId: slotIdOrNothing(input ?? subgraphOutput),
    targetIndex: link.target_slot,
    type: String(link.type)
  })
}

function slotIdOrNothing(slot: object | undefined): string | undefined {
  return slot && slotIdOf(slot)
}

/** Every link in `graph`, in id order. */
export function linksIn(graph: LGraph): readonly LinkInfo[] {
  return Object.freeze(
    Array.from(graph.links.values())
      .sort((a, b) => a.id - b.id)
      .map((link) => linkInfoOf(graph, link))
  )
}
