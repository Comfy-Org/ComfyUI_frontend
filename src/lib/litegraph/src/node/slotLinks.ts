import { useLinkStore } from '@/stores/linkStore'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import type { LGraph } from '../LGraph'
import type { LLink } from '../LLink'

/**
 * Store-backed reads over the links attached to a node's slots.
 * These replace the `output.links[]` / `input.link` mirrors: the link
 * store is the source of truth, and floating links are never included.
 */

/** True when a link targets the input slot. */
export function inputHasLink(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): boolean {
  return useLinkStore().isInputSlotConnected(graph.rootGraph.id, nodeId, slot)
}

/** Id of the link targeting an input slot, if any. */
export function inputLinkId(
  graph: Pick<LGraph, 'rootGraph'>,
  nodeId: NodeId,
  slot: number
): LinkId | undefined {
  return useLinkStore().getInputSlotLink(graph.rootGraph.id, nodeId, slot)?.id
}

/** The link targeting an input slot, resolved in the owning graph. */
export function inputLink(
  graph: LGraph,
  nodeId: NodeId,
  slot: number
): LLink | undefined {
  const id = inputLinkId(graph, nodeId, slot)
  return id === undefined ? undefined : graph.getLink(id)
}

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
