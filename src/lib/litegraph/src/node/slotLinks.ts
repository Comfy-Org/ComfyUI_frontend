import { useLinkStore } from '@/stores/linkStore'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import type { LGraph } from '../LGraph'
import type { LLink } from '../LLink'

/**
 * Store-backed reads over the links leaving a node's output slot.
 * These replace the `output.links[]` mirror: the link store is the source
 * of truth, and floating links are never included.
 */

/** True when at least one link leaves the output slot. */
export function outputHasLinks(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): boolean {
  return useLinkStore().isOutputSlotConnected(graph.rootGraph.id, nodeId, slot)
}

/** Ids of the links leaving an output slot, in ascending id order. */
export function outputLinkIds(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): LinkId[] {
  const ids = [
    ...useLinkStore().getOutputSlotLinks(graph.rootGraph.id, nodeId, slot)
  ].map((topology) => topology.id)
  return ids.sort((a, b) => a - b)
}

/**
 * Snapshot of the links leaving an output slot, resolved in the owning
 * graph. Safe to disconnect links while iterating the result.
 */
export function outputLinks(
  graph: LGraph,
  nodeId: NodeId,
  slot: number
): LLink[] {
  const links: LLink[] = []
  for (const id of outputLinkIds(graph, nodeId, slot)) {
    const link = graph.getLink(id)
    if (link) links.push(link)
  }
  return links
}
